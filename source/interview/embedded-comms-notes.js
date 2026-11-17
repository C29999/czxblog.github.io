(function (root) {
  'use strict';

  function uartRate(baud, parity, stopBits) {
    if (!Number.isFinite(baud) || baud <= 0 || !['N', 'E', 'O'].includes(parity) || ![1, 2].includes(stopBits)) {
      throw new RangeError('无效的 UART 参数');
    }
    const bitsPerByte = 1 + 8 + (parity === 'N' ? 0 : 1) + stopBits;
    const bytesPerSecond = baud / bitsPerByte;
    return { bitsPerByte, bytesPerSecond, payloadBits: bytesPerSecond * 8, microseconds: bitsPerByte / baud * 1000000 };
  }

  function differential(commonNoise, differentialNoise) {
    const voltageA = 2.5 + commonNoise + differentialNoise / 2;
    const voltageB = 1.5 + commonNoise - differentialNoise / 2;
    return { voltageA, voltageB, difference: voltageA - voltageB };
  }

  function videoBudget(width, height, fps, bitrateMbps) {
    const rawMbps = width * height * 12 * fps / 1000000;
    return { rawMbps, megabytesPerMinute: bitrateMbps * 60 / 8, averageKilobytesPerFrame: bitrateMbps * 1000 / 8 / fps };
  }

  const rs485Steps = [
    ['总线空闲', '本机 DE=0、/RE=0；对端 DE=0、/RE=0。双方听线，等待主机发起请求。'],
    ['本机准备发送', '本机 GPIO 拉高：DE=1、/RE=1，打开驱动、关闭本机接收。等待收发器使能建立时间；对端继续接收。'],
    ['请求在路上 →', 'UART TX → D（DI）→ A/B → 对端 R（RO）→ UART RX。A/B 共同承载请求，对端 DE 必须为 0。'],
    ['DMA 完成，仍未交棒', 'DMA TC 只说明数据搬运结束；最后的串行位可能仍在移出。本机 DE 保持 1，继续等待 UART TC。'],
    ['UART TC，释放总线', '确认最后停止位发完，再按器件关闭延迟将本机 DE=/RE=0。遵守协议规定的帧间隔和响应时序后，对端才能接棒。'],
    ['对端响应 ←', '对端 DE=/RE=1；其 UART TX 经同一对 A/B 返回本机 R（RO）→ UART RX。本机 DE=0，不能抢发。'],
    ['响应结束', '对端也等待自身 UART TC，再把 DE=/RE 拉低。双方恢复接收，本轮请求应答结束。']
  ];
  const usbSteps = [
    ['连接与检测', '典型 USB 2.0 主机连接设备并提供 VBUS；设备按规范宣告连接。原生 USB 使用 USB 控制器与 PHY，不经过 UART。'],
    ['复位与识别', '主机复位设备，经端点 0 读取描述符并分配地址。像入校先登记身份；实际枚举会有多次请求，此处仅展示主线。'],
    ['配置与驱动', '主机选择配置，按接口的类/子类等信息匹配驱动。CDC ACM 可呈现虚拟串口，HID 可承载键鼠等输入。'],
    ['端点传输', '主机调度端点事务：OUT 是主机→设备，IN 是设备→主机。D+/D− 这一对线轮流承载两个方向，不能接到 UART TX/RX。']
  ];
  const videoSteps = [
    ['采集原始图像', '相机先输出像素。下方按 8-bit YUV 4:2:0、平均 12 bit/像素计算未压缩数据量，不含填充和传输开销。'],
    ['预测与残差', '先用邻近像素或已解码参考图像预测，再描述预测与当前图像的差。像“沿用背景，把小车往右挪，再修补细节”。'],
    ['编码为 H.264', '对预测残差进行变换、量化和熵编码，连同预测等语法组成码流。此处动画没有执行真实编码，码率由你假设。'],
    ['承载、解码与显示', '码流可写入 MP4 等容器，也可经网络传输；接收端按 H.264 解码，再显示像素。延迟还受缓存、传输和显示队列影响。']
  ];
  const diagnoses = {
    good: ['示例条件匹配', '假设供电、接地、端接和波形均正常：双方 19200、8E1，读取站号 1 的受支持寄存器，CRC 与间隔正确。示意应答正常；这不代表真实硬件已验证。'],
    baud: ['串行层：采样节拍不同', '主机 115200、设备 19200，即使 A/B 相同也不能正确还原字节。先测位宽并核对两端串口设置，别先修改寄存器地址。'],
    parity: ['字符格式：校验位不一致', '主机 8N1、设备 8E1，字符长度和校验规则不一致。核对数据位、校验、停止位；不能只对齐波特率。'],
    address: ['协议层：问错了设备', '主机请求站号 2，而设备站号为 1；非本机地址通常被忽略。检查请求帧首字节与设备配置，不要把无应答直接判为断线。'],
    register: ['应用层：寄存器不支持', '链路可能已经正常，但寄存器地址超出设备映射，可返回 0x02 非法数据地址异常。核对 03/04 功能码、地址基准及设备手册。'],
    crc: ['帧校验失败', 'CRC 不匹配的 RTU 帧应丢弃。对照原始十六进制报文复算 CRC，再检查丢字节、噪声及帧间时序。CRC 字段低字节先发。'],
    direction: ['电气层：没有及时释放总线', '本机 DE 一直为 1，设备开始应答时可能出现总线争用。示波器同时观察 DE、UART TX 与 A/B，检查 UART TC 后的方向切换。'],
    protocol: ['应用语言不同', '两端都是 RS485，但一端说 Modbus RTU，另一端说私有协议。波形与字节可以正常，含义仍不匹配；需实现一致协议或增加网关。']
  };

  function stepIndex(current, action, count) {
    if (action === 'reset') return 0;
    if (action === 'prev') return Math.max(0, current - 1);
    return Math.min(count - 1, current + 1);
  }

  const api = { uartRate, differential, videoBudget, stepIndex, rs485Steps, usbSteps, videoSteps, diagnoses };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root.document) return;

  function init() {
    const document = root.document;
    const format = (value, digits = 0) => value.toLocaleString('zh-CN', { maximumFractionDigits: digits });
    const motionPreference = root.matchMedia('(prefers-reduced-motion: reduce)');
    const pauses = [];

    document.querySelectorAll('[data-comms-sequence]').forEach((lab) => {
      const steps = { rs485: rs485Steps, usb: usbSteps, video: videoSteps }[lab.dataset.commsSequence];
      let current = 0;
      let timer = null;
      const play = lab.querySelector('[data-comms-action="play"]');
      const title = lab.querySelector('[data-comms-title]');
      const description = lab.querySelector('[data-comms-description]');
      const status = lab.querySelector('[data-comms-status]');
      function render() {
        title.textContent = `${current + 1} / ${steps.length} · ${steps[current][0]}`;
        description.textContent = steps[current][1];
        lab.querySelectorAll('[data-comms-step]').forEach((item, index) => {
          if (index === current) item.setAttribute('aria-current', 'step');
          else item.removeAttribute('aria-current');
        });
        lab.querySelector('[data-comms-action="prev"]').disabled = current === 0;
        lab.querySelector('[data-comms-action="next"]').disabled = current === steps.length - 1;
      }
      function pause() {
        if (timer !== null) root.clearInterval(timer);
        timer = null;
        play.textContent = '播放步骤';
        play.setAttribute('aria-pressed', 'false');
        status.setAttribute('aria-live', 'polite');
      }
      pauses.push(pause);
      lab.querySelectorAll('[data-comms-action]').forEach((button) => {
        button.addEventListener('click', () => {
          const action = button.dataset.commsAction;
          if (action === 'play') {
            if (timer !== null) { pause(); return; }
            if (current === steps.length - 1) current = 0;
            render();
            play.textContent = '暂停';
            play.setAttribute('aria-pressed', 'true');
            status.setAttribute('aria-live', 'off');
            timer = root.setInterval(() => {
              current = stepIndex(current, 'next', steps.length);
              render();
              if (current === steps.length - 1) pause();
            }, 2200);
          } else {
            pause();
            current = stepIndex(current, action, steps.length);
            render();
          }
        });
      });
      render();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauses.forEach((pause) => pause());
    });
    motionPreference.addEventListener('change', () => pauses.forEach((pause) => pause()));

    const rate = document.querySelector('[data-comms-rate]');
    function renderRate() {
      const baud = Number(rate.querySelector('[name="baud"]').value);
      const parity = rate.querySelector('[name="parity"]').value;
      const stopBits = Number(rate.querySelector('[name="stop-bits"]').value);
      const result = uartRate(baud, parity, stopBits);
      rate.querySelector('[data-comms-bits]').textContent = `${result.bitsPerByte} bit / 字节`;
      rate.querySelector('[data-comms-bytes]').textContent = `${format(result.bytesPerSecond, 2)} B/s`;
      rate.querySelector('[data-comms-time]').textContent = `${format(result.microseconds, 2)} μs / 字节`;
      rate.querySelector('[data-comms-rate-detail]').textContent = `${format(baud)} ÷ ${result.bitsPerByte} = ${format(result.bytesPerSecond, 2)} B/s；有效数据 ${format(result.payloadBits, 2)} bit/s。连续发送上限，未扣协议字段、空闲与应答等待。`;
      const labels = ['起', ...Array.from({ length: 8 }, (_, index) => `D${index}`), ...(parity === 'N' ? [] : ['校']), ...Array.from({ length: stopBits }, () => '停')];
      rate.querySelector('[data-comms-frame]').replaceChildren(...labels.map((label) => {
        const part = document.createElement('span');
        part.textContent = label;
        if (!label.startsWith('D')) part.className = 'overhead';
        return part;
      }));
    }
    if (rate) {
      rate.addEventListener('change', renderRate);
      rate.querySelector('[data-comms-rate-reset]').addEventListener('click', () => {
        rate.querySelector('[name="baud"]').value = '115200';
        rate.querySelector('[name="parity"]').value = 'N';
        rate.querySelector('[name="stop-bits"]').value = '1';
        renderRate();
      });
      renderRate();
    }

    const signal = document.querySelector('[data-comms-signal]');
    function renderSignal() {
      const common = Number(signal.querySelector('[name="common-noise"]').value);
      const error = Number(signal.querySelector('[name="differential-noise"]').value);
      const result = differential(common, error);
      ['A', 'B'].forEach((line) => {
        const value = result[`voltage${line}`];
        signal.querySelector(`[data-comms-meter="${line}"]`).value = value;
        signal.querySelector(`[data-comms-voltage="${line}"]`).textContent = `${value.toFixed(1)} V`;
      });
      signal.querySelector('[data-comms-signal-result]').textContent = `同向干扰 ${common.toFixed(1)} V，额外差模扰动 ${error.toFixed(1)} V；A−B=${result.difference.toFixed(1)} V。${Math.abs(error) < 0.001 ? '两线一起抬升时，电压差不变。' : '两线受到的干扰不同，电压差也会变化。'}`;
    }
    if (signal) {
      signal.addEventListener('input', renderSignal);
      signal.querySelector('[data-comms-signal-reset]').addEventListener('click', () => {
        signal.querySelector('[name="common-noise"]').value = '0';
        signal.querySelector('[name="differential-noise"]').value = '0';
        renderSignal();
      });
      renderSignal();
    }

    const fault = document.querySelector('[data-comms-fault]');
    if (fault) {
      const select = fault.querySelector('select');
      const render = () => {
        const result = diagnoses[select.value];
        fault.querySelector('strong').textContent = result[0];
        fault.querySelector('[data-comms-fault-result]').textContent = result[1];
      };
      select.addEventListener('change', render);
      fault.querySelector('button').addEventListener('click', () => { select.value = 'good'; render(); });
      render();
    }

    const video = document.querySelector('[data-comms-video-budget]');
    function renderVideo() {
      const fps = Number(video.querySelector('[name="video-fps"]').value);
      const bitrate = Number(video.querySelector('[name="video-bitrate"]').value);
      const movement = Number(video.querySelector('[name="video-motion"]').value);
      const result = videoBudget(1920, 1080, fps, bitrate);
      video.querySelector('[data-comms-raw]').textContent = `${format(result.rawMbps, 3)} Mbit/s`;
      video.querySelector('[data-comms-storage]').textContent = `${format(result.megabytesPerMinute, 1)} MB / 分钟`;
      video.querySelector('[data-comms-frame-budget]').textContent = `${format(result.averageKilobytesPerFrame, 2)} kB / 帧`;
      video.querySelector('.comms-motion').style.setProperty('--comms-shift', `${movement * 2}px`);
      video.querySelector('[data-comms-motion-result]').textContent = `小块向右移动 ${movement} 个示意像素：用位移预测位置，再补残差。滑块不计算编码码率；真实运动估计还需处理遮挡、纹理和噪声。`;
    }
    if (video) {
      video.addEventListener('input', renderVideo);
      video.querySelector('[data-comms-video-reset]').addEventListener('click', () => {
        video.querySelector('[name="video-fps"]').value = '30';
        video.querySelector('[name="video-bitrate"]').value = '4';
        video.querySelector('[name="video-motion"]').value = '40';
        renderVideo();
      });
      renderVideo();
    }
  }
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window === 'undefined' ? globalThis : window);

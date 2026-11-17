(function () {
  'use strict';

  function applyMask(value, mask, operation) {
    if (operation === 'set') return (value | mask) & 255;
    if (operation === 'clear') return (value & ~mask) & 255;
    if (operation === 'toggle') return (value ^ mask) & 255;
    throw new Error('Unknown operation');
  }

  function counterTrace(protectedMode) {
    return protectedMode ? [
      { count:0, text:'主循环保存中断屏蔽状态，进入临界区。' },
      { count:0, text:'主循环读取 count = 0，放入临时值。' },
      { count:0, text:'中断请求到达；本例中的可屏蔽中断暂不执行，保持待处理。' },
      { count:0, text:'主循环把自己的临时值加一，得到 1。' },
      { count:1, text:'主循环写回 count = 1。' },
      { count:1, text:'恢复原来的中断屏蔽状态；本例原先允许中断，待处理中断开始执行。' },
      { count:2, text:'ISR 读取 1、加一、写回 2。两次递增都保留下来。' }
    ] : [
      { count:0, text:'主循环读取 count = 0，临时值是 0。' },
      { count:0, text:'中断到达，主循环暂停。' },
      { count:1, text:'ISR 读取 0、加一、写回 count = 1，然后返回。' },
      { count:1, text:'主循环继续：把之前读到的临时值 0 加一，得到 1。' },
      { count:1, text:'主循环写回 1，覆盖 ISR 的结果。两次递增，最终却只有 1。' }
    ];
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { applyMask, counterTrace };
  if (typeof document === 'undefined') return;

  const registerHost = document.getElementById('register');
  const concurrencyHost = document.getElementById('concurrency');
  if (!registerHost || !concurrencyHost) return;

  function createLab(host, markup) {
    const panel = document.createElement('section');
    panel.className = 'foundation-lab';
    panel.innerHTML = markup;
    host.appendChild(panel);
    return panel;
  }

  function transport(panel, advance, resetState) {
    let timer = null;
    const play = panel.querySelector('[data-play]');
    function stop() {
      clearInterval(timer);
      timer = null;
      play.textContent = '播放';
      play.setAttribute('aria-pressed', 'false');
    }
    panel.querySelector('[data-step]').addEventListener('click', () => { stop(); advance(); });
    panel.querySelector('[data-reset]').addEventListener('click', () => { stop(); resetState(); });
    play.addEventListener('click', () => {
      if (timer !== null) return stop();
      if (!advance()) return;
      play.textContent = '暂停';
      play.setAttribute('aria-pressed', 'true');
      timer = setInterval(() => { if (!advance()) stop(); }, 900);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
    const observer = new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); });
    observer.observe(panel);
    return stop;
  }

  const registerPanel = createLab(registerHost, `
    <h4>实验：像操作一排开关一样修改寄存器</h4>
    <p><strong>解决什么问题：</strong>只修改目标位，保留其他位。把一个字节想成八盏灯，掩码就是“允许操作哪些灯”的清单；它不是要直接写入的最终值。</p>
    <p><strong>先预测：</strong>初值 0xA5，选中 bit 3 再置位，其他七位会变吗？</p>
    <div class="lab-controls"><label>初值 <select data-initial><option value="165">0xA5 / 10100101</option><option value="0">0x00 / 00000000</option><option value="255">0xFF / 11111111</option></select></label>
    <label>操作 <select data-operation><option value="set">置位 OR</option><option value="clear">清位 AND NOT</option><option value="toggle">翻转 XOR</option></select></label></div>
    <p>点击选择掩码位（蓝色表示选中）；修改参数后实验回到起点。</p>
    <div class="bit-grid" aria-label="选择掩码位">${Array.from({length:8}, (_, index) => `<button type="button" data-bit="${7-index}" aria-pressed="${7-index === 3}"><small>bit ${7-index}</small><span>${7-index === 3 ? 1 : 0}</span></button>`).join('')}</div>
    <output aria-live="polite" data-result></output>
    <div class="lab-controls"><button type="button" data-step>单步</button><button type="button" data-play aria-pressed="false">播放</button><button type="button" data-reset>重置</button></div>
    <ol class="lab-trace"><li>读取寄存器</li><li>在临时值上执行位运算</li><li>写回寄存器</li></ol>
    <p data-explanation></p>
    <details><summary>对应 C 代码与适用边界</summary><pre>uint32_t mask = 1u &lt;&lt; 3;
REG |= mask;
REG &amp;= ~mask;
REG ^= mask;</pre><p>三行分别演示置位、清位、翻转，不是必须一起执行。这里用 8 位普通可读写寄存器说明过程；真实寄存器宽度和访问规则以芯片手册为准。</p><p>写一清零状态位、只写寄存器、有读副作用的寄存器不能照搬读改写。并发修改同一寄存器也可能覆盖别人的修改，应检查专用置位/清位寄存器或适当的互斥机制。</p></details>
  `);
  let mask = 8;
  let registerPhase = 0;
  const initial = registerPanel.querySelector('[data-initial]');
  const operation = registerPanel.querySelector('[data-operation]');
  const format = value => `0x${value.toString(16).toUpperCase().padStart(2, '0')} / ${value.toString(2).padStart(8, '0')}`;
  function renderRegister() {
    const original = Number(initial.value);
    const result = applyMask(original, mask, operation.value);
    const symbols = { set:'|', clear:'& ~', toggle:'^' };
    registerPanel.querySelector('[data-result]').textContent = `REG：${format(registerPhase === 3 ? result : original)}；掩码：${format(mask)}`;
    registerPanel.querySelector('[data-explanation]').textContent = [
      '等待开始：先选择掩码，再单步观察。重置保留所选参数。',
      `读取：临时值 = ${format(original)}，此时寄存器未改变。`,
      `计算：${format(original).split(' / ')[0]} ${symbols[operation.value]} ${format(mask).split(' / ')[0]} = ${format(result)}；尚未写回。`,
      `写回完成：${format(result)}。掩码为 0 的位保持原样；点击重置可重做。`
    ][registerPhase];
    registerPanel.querySelectorAll('.lab-trace li').forEach((item, index) => item.setAttribute('aria-current', index === registerPhase - 1 ? 'step' : 'false'));
    registerPanel.querySelectorAll('[data-step], [data-play]').forEach(button => { button.disabled = registerPhase === 3; });
  }
  const stopRegister = transport(registerPanel, () => {
    registerPhase = Math.min(3, registerPhase + 1);
    renderRegister();
    return registerPhase < 3;
  }, () => { registerPhase = 0; renderRegister(); });
  function resetRegister() { stopRegister(); registerPhase = 0; renderRegister(); }
  initial.addEventListener('change', resetRegister);
  operation.addEventListener('change', resetRegister);
  registerPanel.querySelectorAll('[data-bit]').forEach(button => button.addEventListener('click', () => {
    mask ^= 1 << Number(button.dataset.bit);
    const selected = Boolean(mask & (1 << Number(button.dataset.bit)));
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('span').textContent = selected ? '1' : '0';
    resetRegister();
  }));
  renderRegister();

  const concurrencyPanel = createLab(concurrencyHost, `
    <h4>实验：为什么写了 volatile，计数仍然少一次？</h4>
    <p><strong>解决什么问题：</strong>主循环和中断都想更新同一个计数。像两个人同时抄一份库存表，各自在旧数字上加一，后交的表可能覆盖先交的表。</p>
    <p><strong>正式区别：</strong>volatile 影响编译器对访问的处理；互斥决定谁能在这段时间修改数据。一次 count++ 可以包含读取、加法、写回多个步骤。</p>
    <p><strong>先预测：</strong>count 初值为 0，主循环与 ISR 各加一次，结果一定是 2 吗？</p>
    <div class="lab-controls"><label>保护方式 <select data-protection><option value="none">只有 volatile</option><option value="critical">短临界区保护</option></select></label></div>
    <output data-result aria-live="polite"></output>
    <div class="lab-controls"><button type="button" data-step>单步</button><button type="button" data-play aria-pressed="false">播放</button><button type="button" data-reset>重置</button></div>
    <ol class="lab-trace"></ol>
    <p data-explanation></p>
    <details><summary>工程中怎么判断和排查？</summary><p>先找所有读写 count 的位置，确认是否同时出现在任务和 ISR 中，再检查反汇编与实际抢占点。不要因为单次读写可能是一条指令，就认为“读、加、写”的整体是原子的。</p><p>临界区像短暂锁门：应保存并恢复原屏蔽状态，保持足够短，不能包住延时、等待外设或整个通信过程。RTOS 中应按内核提供的任务/ISR 接口和中断优先级规则处理；队列也可以把数据交给单个任务统一更新。</p><p>本实验只模拟单核、一个可屏蔽 ISR、一次待处理中断、初始中断已使能。它不表示所有中断都可屏蔽，也不模拟多核、DMA、真实中断延迟或编译器指令。网页结果不等于板上验证。</p></details>
  `);
  const protection = concurrencyPanel.querySelector('[data-protection]');
  let counterPhase = 0;
  function renderCounter() {
    const steps = counterTrace(protection.value === 'critical');
    const current = steps[counterPhase - 1];
    concurrencyPanel.querySelector('[data-result]').textContent = `共享 count = ${current ? current.count : 0}；进度 ${counterPhase}/${steps.length}；目标：两次递增后得到 2`;
    concurrencyPanel.querySelector('.lab-trace').innerHTML = steps.map((step, index) => `<li aria-current="${index === counterPhase - 1 ? 'step' : 'false'}">${index < counterPhase ? step.text : '等待单步执行…'}</li>`).join('');
    concurrencyPanel.querySelector('[data-explanation]').textContent = current ? current.text : '先预测，再点击单步；切换保护方式可对比相同请求下的结果。';
    concurrencyPanel.querySelectorAll('[data-step], [data-play]').forEach(button => { button.disabled = counterPhase === steps.length; });
  }
  const stopCounter = transport(concurrencyPanel, () => {
    const total = counterTrace(protection.value === 'critical').length;
    counterPhase = Math.min(total, counterPhase + 1);
    renderCounter();
    return counterPhase < total;
  }, () => { counterPhase = 0; renderCounter(); });
  protection.addEventListener('change', () => { stopCounter(); counterPhase = 0; renderCounter(); });
  renderCounter();
})();

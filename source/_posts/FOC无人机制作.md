---
title: 无感 FOC 无人机\BLDC无刷电机学习
description: 四轴飞控
categories: 四轴飞控
sticky: 4
top_img: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/0de60eacdcda934f26a88a2fd97b802d.jpeg'
cover: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/0de60eacdcda934f26a88a2fd97b802d.jpeg'
tags: Plan
abbrlink: 20377
date: 2025-08-17 12:00:00
---

## 项目说明

 有两个项目1.无刷电机控制驱动的学习2.四轴无人机的制作

## FOC驱动学习

### 项目开源

#### 软件开源

本项目软件部分基于开源工程[FOC-Study](https://github.com/mielnicz/dgm_BLDC)，并对其进行修改。

#### 硬件原理图

![FOC 硬件原理图](/images/foc-hardware-schematic.png)

#### 电机驱动模块：dgm 驱动器

电机驱动采用 **dgm 驱动器**（高度集成的无刷马达驱动器，固件开源）。

**主要特点**

- 超小尺寸：长 4 cm × 宽 4 cm
- 宽压供电：12V ~ 50V
- 工作效率高达 95%
- 内置 6 颗 60V/170A MOSFET
- 主控：Cortex-M4 带硬件浮点运算器
- 控制方式：SVPWM
- 控制频率：电流、转速、位置环均达 20 kHz
- 电流检测：12bit ADC 三相电流检测，相电流范围 -50 ~ +50A，满量程分辨率 22 mA
- 板载 18bit 绝对值磁编码器，精确位置控制，无需上电校准
- 支持磁编码器与磁铁同心度偏移补偿、马达齿槽转矩脉动补偿
- 支持自动测量电机参数并生成电流环控制增益
- 通讯：CAN 总线（配置、控制、固件升级）
- 配套 dgm tool 可视化调参软件

**典型应用**：协作机器人关节、机器人末端执行器、机器人外骨骼、AGV、高集成度伺服电机、航模 BLDC 电机。

**关键参数**

| 关键参数 | 单位 | 参数 |
|---------|------|------|
| 输入电压 | V | 12 ~ 50 |
| 持续相电流 | A | 30 @ 60℃ |
| 峰值相电流 | A | 50 @ 1 秒 |
| PWM 频率 | kHz | 20 |
| 待机功耗 | W | 0.72 @ 24V |
| 支持电机类型 | — | 三相无刷永磁电机 |
| 编码器类型 | — | 驱动板内部集成单圈绝对值磁编码器（18 bit） |
| 通讯接口 | — | CAN 总线、UART、IO |
| 控制模式 | — | 转矩爬升、转速爬升、位置过滤、轨迹 |

> 以上参数非特殊说明即表示极限参数，超过将可能造成驱动器损坏。

<details>
<summary>原始规格截图</summary>

![dgm 驱动器主要特点](/images/dgm-driver-features.png)

![dgm 驱动器关键参数](/images/dgm-driver-params.png)

</details>

#### CAN协议的使用

##### 什么是 CAN协议？

CAN（Controller Area Network，控制器局域网）是博世 1986 年为汽车电子设计的串行总线协议，让多个控制器挂在一对双绞线上互相通信，不需要主机逐一询问。后来凭借抗干扰强、可靠性高的特点，广泛用于工业设备、机器人和无人机。

**物理层：差分信号抗干扰**

CAN 用 CANH 和 CANL 一对双绞线传输，靠两条线的**电压差**表示 0/1（显性/隐性电平），而不是单根线对地的高低。电机、电调产生的大电流干扰会同时耦合到两根线上，但差值基本不变，所以总线在强电磁环境里依然可靠。收发器负责把 MCU 的逻辑电平转成差分信号，MCU 的 CAN 控制器只处理数据帧。总线两个物理末端各放一颗 120Ω 终端电阻吸收反射。

**总线仲裁：ID 越小优先级越高**

CAN 是**多主**结构，任何节点想发就发。两个节点同时发时，靠"非破坏性仲裁"解决：逐位比较各自的报文 ID，ID 里出现 0（显性）的一方继续，出现 1（隐性）的一方自动退出发送、改作接收。所以 ID 越小的报文优先级越高，且高优先级报文不会因为冲突而延迟或丢失——这对电机控制这种实时性场景非常关键。

**报文结构**

一帧标准 CAN 报文包含：ID（11 位或扩展 29 位）、DLC（数据长度）、最多 8 字节数据、CRC 校验和 ACK 应答位。没有源地址和目的地址——节点靠 ID 过滤器自己决定收哪些帧。经典 CAN 一帧最多 8 字节，常用波特率 125k ~ 1Mbit/s。

**错误处理**

CAN 控制器自动做 CRC 校验、错误重发和故障隔离：一个节点出错次数太多会被强制"离线"（Bus-off），防止它拖垮整条总线。这是 CAN 在可靠性要求高的场景胜出的原因之一。

##### 工程中的CAN代码实现

dgm 驱动器的固件（GD32C10x）在 `can.c` 中实现了一个简洁但完整的 CAN 应用层。下面按调用顺序从底层到上层，逐行拆解每个函数。

###### 帧 ID 编码：节点 + 命令

11 位标准 ID 被拆成两段：高 5 位是节点地址（nodeID，1~31，0 为广播），低 6 位是命令号。一帧报文同时表达"发给谁"和"做什么"：

```c
#define NODE_ID_BIT  0x7C0U   // 高5位
#define CMD_BIT      0x03FU   // 低6位

// 发送时拼接 ID
tx_frame.id = (mNodeID << 6) | CAN_CMD_HEARTBEAT;
```

###### 命令集：覆盖电机控制全流程

命令枚举按功能分组，共 30+ 条：

| 分组 | 命令 | 作用 |
|------|------|------|
| 状态切换 | `MOTOR_ENABLE` / `MOTOR_DISABLE` | 进入 RUN / IDLE |
| 目标下发 | `SET_TORQUE` / `SET_VELOCITY` / `SET_POSITION` | 写入目标值到控制器缓冲 |
| 同步 | `SYNC` | 开启同步模式后，统一触发多轴同时执行 |
| 校准 | `CALIB_START` / `CALIB_REPORT` / `CALIB_ABORT` | 编码器零偏校准 |
| 消齿槽 | `ANTICOGGING_START/REPORT/ABORT` | 齿槽转矩补偿表标定 |
| 状态读取 | `GET_STATUSWORD` / `GET_TORQUE` / `GET_VELOCITY` / `GET_POSITION` / `GET_I_Q` / `GET_VBUS` / `GET_IBUS` / `GET_POWER` | 遥测 |
| 配置 | `SET_CONFIG` / `GET_CONFIG` / `SAVE_ALL_CONFIG` / `RESET_ALL_CONFIG` | 在线调参和保存 |
| 固件 | `WRITE_APP_BACK` / `DFU_START` | CAN 远程升级固件 |
| 心跳 | `HEARTBEAT`（CMD=63） | 链路保活 |

###### `can_tx` — 发送一帧

```c
static bool can_tx(CanFrame *tx_frame)
{
    uint8_t mailbox_number;
    
    // 检查三个发送邮箱哪个是空的（TME = Transmit Mailbox Empty）
    if(CAN_TSTAT_TME0 == (CAN_TSTAT(CAN0)&CAN_TSTAT_TME0)){
        mailbox_number = CAN_MAILBOX0;       // 邮箱0空，用它
    }else if(CAN_TSTAT_TME1 == (CAN_TSTAT(CAN0)&CAN_TSTAT_TME1)){
        mailbox_number = CAN_MAILBOX1;       // 邮箱1空，用它
    }else if(CAN_TSTAT_TME2 == (CAN_TSTAT(CAN0)&CAN_TSTAT_TME2)){
        mailbox_number = CAN_MAILBOX2;       // 邮箱2空，用它
    }else{
        mailbox_number = CAN_NOMAILBOX;      // 三个都忙，没空位
    }
    if(CAN_NOMAILBOX == mailbox_number){
        return false;                        // 发不了，返回失败
    }
    
    // 写入 11 位标准帧 ID
    // TMI = Transmit Mailbox Identifier 寄存器
    // SFID = Standard Frame ID，取低 11 位
    CAN_TMI(CAN0, mailbox_number) = (uint32_t)(TMI_SFID(tx_frame->id & 0x7FF));
    
    // 写入 DLC（数据长度码），同时清掉 CAN FD 相关位
    // TMP = Transmit Mailbox Property 寄存器
    CAN_TMP(CAN0, mailbox_number) &= ~(CAN_TMP_DLENC|CAN_TMP_ESI|CAN_TMP_BRS|CAN_TMP_FDF);
    CAN_TMP(CAN0, mailbox_number) |= tx_frame->dlc & 0x0F;   // DLC 4 位，0~8
    
    // 写入 8 字节数据，分两个 32 位寄存器
    // TMDATA0 存 data[3:0]，TMDATA1 存 data[7:4]
    CAN_TMDATA0(CAN0, mailbox_number) = TMDATA0_DB3(tx_frame->data[3]) | \
                                        TMDATA0_DB2(tx_frame->data[2]) | \
                                        TMDATA0_DB1(tx_frame->data[1]) | \
                                        TMDATA0_DB0(tx_frame->data[0]);
    CAN_TMDATA1(CAN0, mailbox_number) = TMDATA1_DB7(tx_frame->data[7]) | \
                                        TMDATA1_DB6(tx_frame->data[6]) | \
                                        TMDATA1_DB5(tx_frame->data[5]) | \
                                        TMDATA1_DB4(tx_frame->data[4]);
    
    // 拉高 TEN 位（Transmit Enable）→ 硬件开始发送
    // 之后仲裁、CRC、位填充、ACK 等待全部由 CAN 控制器自动完成
    CAN_TMI(CAN0, mailbox_number) |= CAN_TMI_TEN;
    
    CAN_reset_tx_timeout();    // 记录本次发送时间戳，用于心跳超时判断
    
    return true;
}
```

> 核心流程：找空邮箱 → 填 ID、DLC、数据 → 拉高 TEN → 返回。发送过程软件不参与，仲裁、CRC、位填充全是 CAN 控制器硬件做的。

###### `can_rx` — 读一帧

```c
static bool can_rx(CanFrame *rx_frame)
{
    // RFL = Receive FIFO Length，检查 FIFO0 里有没有帧
    if ((CAN_RFIFO0(CAN0) & CAN_RFIF_RFL_MASK) != 0) {
        
        // 从 FIFO 读 ID（标准帧）
        rx_frame->id = GET_RFIFOMI_SFID(CAN_RFIFOMI(CAN0, 0));
        
        // 读 DLC（数据长度）
        rx_frame->dlc = (uint8_t)(GET_RFIFOMP_DLENC(CAN_RFIFOMP(CAN0, 0)));
        
        // 读 8 字节数据，同样分两个 32 位寄存器
        rx_frame->data[0] = (uint8_t)(GET_RFIFOMDATA0_DB0(CAN_RFIFOMDATA0(CAN0, 0)));
        rx_frame->data[1] = (uint8_t)(GET_RFIFOMDATA0_DB1(CAN_RFIFOMDATA0(CAN0, 0)));
        rx_frame->data[2] = (uint8_t)(GET_RFIFOMDATA0_DB2(CAN_RFIFOMDATA0(CAN0, 0)));
        rx_frame->data[3] = (uint8_t)(GET_RFIFOMDATA0_DB3(CAN_RFIFOMDATA0(CAN0, 0)));
        rx_frame->data[4] = (uint8_t)(GET_RFIFOMDATA1_DB4(CAN_RFIFOMDATA1(CAN0, 0)));
        rx_frame->data[5] = (uint8_t)(GET_RFIFOMDATA1_DB5(CAN_RFIFOMDATA1(CAN0, 0)));
        rx_frame->data[6] = (uint8_t)(GET_RFIFOMDATA1_DB6(CAN_RFIFOMDATA1(CAN0, 0)));
        rx_frame->data[7] = (uint8_t)(GET_RFIFOMDATA1_DB7(CAN_RFIFOMDATA1(CAN0, 0)));
        
        // RFD = Release FIFO Depth，释放 FIFO 让硬件收下一帧
        // 不释放的话 FIFO 满了之后新帧会被丢弃
        CAN_RFIFO0(CAN0) |= CAN_RFIFO0_RFD0;
        
        return true;
    } else {
        return false;    // FIFO 空，没帧可读
    }
}
```

> 核心流程：检查 FIFO 非空 → 读 ID、DLC、数据 → 释放 FIFO → 返回。不释放 FIFO 的话新帧会被丢弃。

###### `parse_frame` — 收到帧后干什么

这是应用层核心，每收到一帧就调用一次。

```c
static void parse_frame(CanFrame *frame)
{
    int ret;
    bool echo = false;    // 标记本帧是否需要应答
    
    // 从 11 位 ID 里提取 nodeID（高 5 位）
    uint8_t nodeID = (frame->id & NODE_ID_BIT) >> 6;
    
    // 地址过滤：不是发给我的、也不是广播（nodeID=0），直接丢
    if(nodeID != mNodeID && nodeID != 0){
        return;
    }
    
    CAN_reset_rx_timeout();    // 收到有效帧，重置心跳超时计时
    
    // 提取命令号（低 6 位），switch 分发
    switch(frame->id & CMD_BIT){
```

挑几个有代表性的 case：

```c
        // ===== 状态切换类：dlc=0，无数据，只改状态 =====
        case CAN_CMD_MOTOR_ENABLE:
            if(frame->dlc == 0){                    // 使能命令不带数据
                ret = MCT_set_state(RUN);           // 切到 RUN 状态
                int32_to_data(ret, &frame->data[0]); // 把结果写进 data[0..3]
                frame->dlc = 4;                     // 应答带 4 字节返回值
                echo = true;                        // 标记要回发
            }
            break;
```

```c
        // ===== 目标下发类：dlc=4，带一个 float =====
        case CAN_CMD_SET_VELOCITY:
            if(frame->dlc == 4){                              // 必须带 4 字节 float
                if(UsrConfig.invert_motor_dir){
                    // 反向安装：取负
                    Controller.input_velocity_buffer = -data_to_float(&frame->data[0]);
                }else{
                    Controller.input_velocity_buffer = +data_to_float(&frame->data[0]);
                }
                // 非同步模式：立即生效
                if(!UsrConfig.sync_target_enable){
                    CONTROLLER_sync_callback();
                }
                // 同步模式：只写缓冲，等 SYNC 命令统一触发
            }
            break;
```

```c
        // ===== 遥测读取类：dlc=0，回发 float =====
        case CAN_CMD_GET_VELOCITY:
            if(frame->dlc == 0){                     // 读取命令不带数据
                if(UsrConfig.invert_motor_dir){
                    float_to_data(-Encoder.vel, &frame->data[0]);
                }else{
                    float_to_data(+Encoder.vel, &frame->data[0]);
                }
                frame->dlc = 4;                      // 应答带 4 字节
                echo = true;
            }
            break;
```

```c
        // ===== 同步触发 =====
        case CAN_CMD_SYNC:
            if(frame->dlc == 0){
                if(UsrConfig.sync_target_enable){
                    CONTROLLER_sync_callback();    // 所有缓冲的目标值同时生效
                }
            }
            break;
```

```c
        // ===== 配置读写：dlc=8（4字节索引 + 4字节值） =====
        case CAN_CMD_SET_CONFIG:
            if(frame->dlc == 8){
                config_callback(frame->data, true);   // isSet=true
                frame->dlc = 8;
                echo = true;
            }
            break;
        
        case CAN_CMD_GET_CONFIG:
            if(frame->dlc == 4){                      // 只带索引
                config_callback(frame->data, false);  // isSet=false
                frame->dlc = 8;                       // 回发 索引+值
                echo = true;
            }
            break;
```

```c
        // ===== 固件升级：dlc=0~8，写入 Flash 备份区 =====
        case CAN_CMD_WRITE_APP_BACK:
            DFU_write_app_back(&frame->data[0], frame->dlc);  // 不带回显，连续写
            break;
        
        case CAN_CMD_DFU_START:
            if(frame->dlc == 0){
                watch_dog_feed();          // 先喂狗，防止跳转时复位
                DFU_jump_bootloader();     // 跳到 bootloader
            }
            break;
    }
    
    // switch 结束后统一处理应答
    if(echo){
        can_tx(frame);    // 把原帧的数据区填上返回值，ID 不变，发回去
    }
}
```

> 设计亮点：`echo` 标志把所有需要应答的命令统一在函数末尾回发，不用每个 case 都写一遍 `can_tx`。

###### `CAN_comm_loop` — 主循环里跑的后台任务

```c
void CAN_comm_loop(void)
{
    // 接收心跳超时检查：上位机多久没发任何帧了？
    if(UsrConfig.heartbeat_consumer_ms){
        if(get_ms_since(mRxTick) > UsrConfig.heartbeat_consumer_ms){
            MCT_set_state(IDLE);    // 超时 → 停机，回到 IDLE
        }
    }
    
    // 发送心跳超时检查：我多久没发过帧了？
    if(UsrConfig.heartbeat_producer_ms){
        if(get_ms_since(mTxTick) > UsrConfig.heartbeat_producer_ms){
            CanFrame tx_frame;
            tx_frame.id = (mNodeID << 6) | CAN_CMD_HEARTBEAT;  // CMD=63
            tx_frame.dlc = 0;        // 心跳不带数据
            can_tx(&tx_frame);       // 发出去证明还活着
        }
    }
    
    // CAN 总线错误检查
    can_error_check();
}
```

> 每次主循环都跑一遍——上位机失联就停机，自己太久没说话就发心跳，同时检查总线有没有出错。这就是"CAN 断了不能让电机继续转"的固件级实现。

###### `config_callback` — 配置项读写

```c
static void config_callback(uint8_t *data, bool isSet)
{
    // data[0..3] = 配置项索引（从 1 开始），data[4..7] = 值
    int32_t idx = data_to_int32(data) - 1;    // 转成 0 起始
    int32_t config_number = sizeof(tUsrConfig)/4 - 132;  // 可在线改的参数个数
    
    // 索引越界检查
    if(idx >= config_number){
        int32_to_data(-1, &data[0]);   // 返回错误
        int32_to_data( 0, &data[4]);
        return;
    }
    
    // 把 UsrConfig 结构体当 uint32_t 数组，按索引访问
    uint32_t *pConfig = &(((uint32_t*)(&UsrConfig))[idx]);
    
    if(isSet){
        // 写配置：只能在 IDLE 状态下改，RUN 中拒绝
        if(MCT_get_state() != IDLE){
            int32_to_data(-1, &data[0]);
            int32_to_data( 0, &data[4]);
            return;
        }
        memcpy(pConfig, &data[4], 4);    // 写入新值
        
        // 改了带宽参数要立刻更新 PI 增益
        FOC_update_current_ctrl_gain(UsrConfig.current_ctrl_bw);
        CONTROLLER_update_input_pos_filter_gain(UsrConfig.position_filter_bw);
    }else{
        // 读配置：把当前值拷到 data[4..7] 回发
        memcpy(&data[4], pConfig, 4);
    }
}
```

> 设计亮点：把 `UsrConfig` 结构体直接当 `uint32_t` 数组按索引访问，上位机只需要发"第几个参数 + 新值"，不需要为每个参数定义单独的命令号。

###### `can_error_check` — 总线错误处理

```c
static void can_error_check(void)
{
    mCanBusErrNew = CAN_ERR(CAN0);       // 读错误寄存器
    if(mCanBusErrOld != mCanBusErrNew){  // 状态有变化才处理
        mCanBusErrOld = mCanBusErrNew;
        
        if(mCanBusErrNew & CAN_ERR_WERR){
            // 警告错误（错误计数器接近阈值），暂不处理
        }
        
        if(mCanBusErrNew & CAN_ERR_PERR){
            // 被动错误：本节点出错太多，先清空发送邮箱和接收 FIFO
            can_transmission_stop(CAN0, CAN_MAILBOX0);
            can_transmission_stop(CAN0, CAN_MAILBOX1);
            can_transmission_stop(CAN0, CAN_MAILBOX2);
            CAN_RFIFO0(CAN0) |= CAN_RFIFO0_RFD0;
        }
        
        if(mCanBusErrNew & CAN_ERR_BOERR){
            // Bus-off：彻底离线，同样清空所有邮箱和 FIFO
            can_transmission_stop(CAN0, CAN_MAILBOX0);
            can_transmission_stop(CAN0, CAN_MAILBOX1);
            can_transmission_stop(CAN0, CAN_MAILBOX2);
            CAN_RFIFO0(CAN0) |= CAN_RFIFO0_RFD0;
        }
        
        // 错误类型分类（fill/format/ack/bit/crc），目前只记录不处理
        switch (can_error_get(CAN0)) { ... }
        
        CAN_ERR(CAN0) = CAN_ERR_ERRN;    // 清错误标志位
    }
}
```

> 出错了就把发送邮箱和接收 FIFO 全清掉，防止脏数据堆积，等总线恢复后重新开始。

###### 辅助函数

```c
// 收到任何发给我的帧 → 重置接收超时计时
void CAN_reset_rx_timeout(void) { mRxTick = SystickCount; }

// 发出任何帧 → 重置发送超时计时
void CAN_reset_tx_timeout(void) { mTxTick = SystickCount; }

// 上电时设置本节点地址（从 Flash 读的配置）
void CAN_set_node_id(uint8_t nodeID) { mNodeID = nodeID; }
```

###### 调用关系总结

```
中断触发（FIFO0 非空）
  └─ CAN_receive_callback()
       └─ while(can_rx())        ← 把 FIFO 里的帧全读完
            └─ parse_frame()      ← 逐帧分发
                 └─ can_tx()      ← 需要应答的回发

主循环
  └─ CAN_comm_loop()
       ├─ 心跳超时检查 → 可能调 MCT_set_state(IDLE)
       ├─ 心跳发送     → can_tx(HEARTBEAT)
       └─ can_error_check()
```

> **对本项目的参考意义**：这套 ID 编码（nodeID+CMD）、心跳超时停机、目标缓冲+sync 触发的模式，可以直接移植到四合一电调的 G431 固件上。区别只是四合一板有两颗 MCU，每颗要过滤出自己负责的两个电机 ID，dgm 是单节点所以只需匹配一个 nodeID。


## 飞控部分
> **代码仓库**：[FOC-Study](https://github.com/C29999/FOC-Study) — 纯开环强拖验证代码
> **上位机**：[host-computer](https://github.com/C29999/host-computer) — 串口调试上位机

## FOC驱动的第一步

### 为什么第一步先做开环强拖？

完整的 FOC 并不是上电后直接输出三路 PWM 就能实现的。无论使用编码器、霍尔传感器，还是反电动势观测器获取转子位置，后续都需要电流采样来完成电流环，并通常需要速度环来稳定转速和响应负载变化。

但在项目初期，这些环节还没有建立起来：电流采样电路、ADC 同步采样、坐标变换、PI 参数整定、转子角度获取和速度闭环都需要逐步验证。若一开始就尝试闭环 FOC，一旦相序、PWM、驱动使能或角度方向存在问题，电机只会抖动、堵转或过热，很难定位故障来源。

因此，我们先从开环强拖开始。程序不读取电流和转子角度，而是人为生成一个缓慢旋转的电角度，并据此输出三相正弦 PWM。定子磁场按设定方向旋转后，转子会在磁力作用下跟随转动。

开环强拖的目的不是实现最终的飞行控制，而是先验证最底层的功率驱动链路是否正确，包括三相接线与相序、DRV8313 的 EN/nSLEEP/nRESET 控制、TC264D 的三路 PWM 输出、供电稳定性以及电机的基本转向。

只有先让电机在拆桨、限流、低功率条件下稳定开环转动，后续加入电流采样、转子位置估算和速度闭环时，才能明确每一步新增功能是否正常。最终流程为：

开环定位与强拖 → 获取或估算转子角度 → 电流采样与电流环 → 速度环 → 无感/有感闭环 FOC。

### 开环驱动电机：硬件说明

![开环无刷电机驱动电路](/images/open-loop-foc-circuit.png)

<p align="center">开环无刷电机验证电路（SimpleFOC Mini / DRV8313PWPR）</p>

开环强拖的核心思路是：程序不依赖任何传感器反馈，人为生成一个匀速递增的电角度，根据这个角度计算出三相正弦电压，输出三路 PWM 即可让定子磁场旋转起来，带动转子跟随。这种方式对硬件的要求很低——只需要一块能输出三相可调电压的功率驱动板，以及一个能生成三路 PWM 的主控。

SimpleFOC Mini 正好满足这个最低需求。核心芯片 DRV8313PWPR 内部集成了三相半桥功率级，不需要额外焊接 MOSFET 或栅极驱动电阻。原版板提供三个独立的 IN 输入（IN1/IN2/IN3）和一个共用的 EN 使能脚：TC264D 的 CCU61 输出三路同步 PWM 接到 IN1~IN3，分别控制 U/V/W 相的占空比；EN 拉高后 DRV8313 使能输出，三相电压即可加到电机端子上。nSLEEP 和 nRESET 用于芯片休眠和复位，nFAULT 在过流、过温或欠压时拉低，可供主控检测故障。

开环强拖不需要转子位置传感器（编码器、霍尔、反电动势观测都不需要），也不需要电流采样。DRV8313 的 VM 范围 8V–60V 覆盖 3S 锂电，峰值电流能力约 2.5A，对于拆桨空载的 1104 小电机来说，输出能力足够让转子跟随旋转。因此这套硬件虽然离完整 FOC 闭环还很远，但已经足以完成最基础的开环转动验证。

> **局限**：原版 SimpleFOC Mini 不带相电流采样电路，后续若要实现电流闭环或无感 FOC，必须外接采样电阻和运放。

#### 纯开环驱动无感FOC的动态实现

为了把开环驱动的过程讲清楚，这里直接嵌入一个可交互的演示。点击 `START` 可以观看完整启动流程；打开“自动播放”后会连续运行，关闭后可以使用“单步推进”逐阶段观察。页面中的代码窗口、I/O 状态、三相占空比和原理解释会随状态机同步变化。

<details open>
<summary><strong>展开观看：TC264 + DRV8313 开环三相驱动演示</strong></summary>

<div style="margin:16px 0 22px; padding:8px; border:1px solid rgba(128,160,190,.28); border-radius:14px; background:rgba(12,28,46,.35);">
<iframe src="/open_loop_foc_visualizer.html" title="TC264 与 DRV8313 开环三相驱动动态演示" loading="lazy" style="display:block; width:100%; min-height:1120px; border:0; border-radius:10px; background:#07111f;"></iframe>
</div>

</details>

这个演示对应工程中的实际控制思路：程序先保持 `EN=0`，完成 DRV8313 复位和唤醒，再预装载三路 PWM；确认 `nFAULT=1` 后才使能功率级。随后用低幅值固定电角度完成定位，再逐渐增加电频率和调制系数。三相占空比由相差 120° 的正弦量计算得到，但开环程序不知道转子实际位置，因此动画里的箭头表示“指令电压矢量”，不代表实测转子角度。

如果主题或部署环境不允许嵌入页面，也可以[单独打开动态演示](/open_loop_foc_visualizer.html)。

#### 软件实现

> **代码仓库**：[FOC-Study](https://github.com/C29999/FOC-Study) — 基于 TC264D 的 DRV8313 开环三相正弦驱动实验工程

工程的核心逻辑在 `foc.c` 中实现，平台层（PWM、GPIO、中断）在 `foc_port.c` 中封装。控制以 100 μs（10 kHz）定时中断为节拍，状态机驱动整个启动和运行流程。

**1. 状态机**

电机控制不是上电直接输出 PWM，而是通过一个状态机逐步推进：

| 状态 | 说明 |
|------|------|
| `STOPPED` | 停机，EN=0，PWM 关闭 |
| `RESET_WAIT` | 拉低 nRESET/nSLEEP，等待 2 ms |
| `WAKE_WAIT` | 释放 nRESET/nSLEEP，等待 5 ms |
| `PWM_WAIT` | 启动 PWM 写入固定角度，等待 1 ms |
| `ALIGN` | 低幅值固定电角度定位 200 ms |
| `RAMP` | 缓慢增加电频率和幅值 |
| `RUNNING` | 达到目标频率和幅值，稳定运行 |
| `FAULT` | 故障锁存，必须显式 `CLEAR_FAULT` 才能恢复 |

只有收到 `START` 命令后，状态机才从 `STOPPED` 进入 `RESET_WAIT`，按顺序执行。`STOP` 命令则首先拉低 EN，再关闭 PWM，确保不会进入低侧制动。

**2. 三相正弦 PWM**

控制中断中，每个周期按当前电角度 `theta_e` 计算三相占空比：

```c
theta_e += 2 * PI * frequency_hz * dt;
A = 0.5 + 0.5 * amplitude * sinf(theta_e);
B = 0.5 + 0.5 * amplitude * sinf(theta_e - 2*PI/3);
C = 0.5 + 0.5 * amplitude * sinf(theta_e + 2*PI/3);
```

三相占空比经过防御限幅（0.05~0.95）后，通过影子寄存器在同一 PWM 边界同步更新，避免相序错位。

**3. 斜坡与限幅**

电频率和调制系数不是阶跃变化，而是按固定斜率缓慢逼近目标值：

- 电频率变化斜率：2 Hz/s
- 调制系数变化斜率：0.02/s

```c
// approach：向目标值靠近，但每步不超过 step 上限
frequency_hz = approach(frequency_hz, target_frequency, 2.0f * dt);
amplitude = approach(amplitude, target_amplitude, 0.02f * dt);
```

**4. 故障保护**

nFAULT 接到 ERU0 下降沿中断（优先级 255，最高）。中断 ISR 的第一项动作永远是拉低 EN，然后进入临界区锁存故障、关闭 PWM。

```c
static void latch_fault(void)
{
    foc_port_disable_driver_immediate();  // 第一时间拉低 EN
    if (!motor.fault_latched) ++motor.fault_count;
    motor.fault_latched = true;
    motor.enabled = false;
    motor.state = FOC_FAULT;
    motor.frequency_hz = motor.amplitude = 0.0f;
    foc_port_disable();
}
```

> 注意：原版 SimpleFOC Mini 没有 nFAULT 直接关 EN 的硬件门电路，关断依赖固件响应，中断延迟需要实测。

**5. 启动顺序**

收到 `START` 后的时序：

1. EN=0，拉低 nRESET/nSLEEP，等待 2 ms
2. 释放 nRESET/nSLEEP，等待 5 ms（DRV8313 唤醒时间）
3. 确认 nFAULT 高 → 启动 PWM → 写入固定角度定位 → EN 仍为低
4. 等待 1 ms PWM 稳定 → 再次确认 nFAULT → 拉高 EN
5. 固定电角度低幅定位 200 ms → 进入 `RAMP` 缓慢增加频率和幅值

**6. 串口命令**

通过 UART0（115200）发送命令，不区分大小写：

| 命令 | 作用 |
|------|------|
| `START` | 启动电机（AMP=0 时拒绝） |
| `STOP` | 停机（先拉 EN 再停 PWM） |
| `FREQ <Hz>` | 设置目标电频率（0.1~100 Hz） |
| `AMP <0~0.15>` | 设置目标调制系数 |
| `STATUS` | 查询状态、EN、故障计数、实际/目标频率和幅值 |
| `CLEAR_FAULT` | 清除故障锁存（EN=0 时复位/唤醒复核 nFAULT） |

> 本工程只实现到开环三相正弦调制。没有电流采样、没有转子位置估算、没有速度闭环，电频率 Hz 不等于电机机械转速，也不能证明转子已经跟随。

## 从开环验证到四合一无感 FOC 电调

目前，TC264D 配合 SimpleFOC Mini 的开环强拖已经让 1104 电机转了起来，验证了基本的三相驱动链路。下一步准备把四台电机的驱动电路集成到一块板上，并补齐电流采样、故障关断和通信接口，为无感闭环控制提供硬件基础。

这里的“四合一”是指一块板上有四套独立的三相功率级，每套驱动一台电机。飞控负责姿态解算和四台电机的目标分配，电调负责执行电机控制，两者通过 CAN 交换指令与状态。TC264D 继续作为验证平台，电调的接口设计不绑定某一种飞控主控。

> **当前进度**：单电机开环转动已验证；四合一电调已在嘉立创 EDA 完成 Rev E 原理图绘制，尚未完成 PCB、双电机无感固件和带桨测试。下面记录的是设计方案，不能视为已验证的飞行电调。

### 总体方案：两颗 G431，每颗控制两台电机

四合一板采用两颗 **STM32G431CBT6（LQFP48）**，分别控制电机 1、2 和电机 3、4；四套功率级继续使用 **DRV8313PWPR**。

选择 G431，是因为它具备适合电机控制的高级定时器、双 ADC、浮点运算单元及 FDCAN 外设。相较于原先考虑的 F103C8T6，它为同步采样和无感算法提供了更多资源。但“一颗控制两台”是否能满足最终转速，仍要看 PWM 频率、观测器复杂度和中断执行时间，不能只凭主频判断。

```text
外部飞控 / 测试主控 + CAN 收发器
                 │
           CANH / CANL
                 │
       四合一电调板内共用总线
          ┌──────┴──────┐
      CAN 收发器 A    CAN 收发器 B
          │              │
       G431-A          G431-B
        ├─ DRV8313 → 电机1
        └─ DRV8313 → 电机2
                         ├─ DRV8313 → 电机3
                         └─ DRV8313 → 电机4
```

图中只画通信和控制关系，电源、共地及硬件许可线见后面的接口表。两颗 G431 都能收到总线上的广播指令，各自取出负责的两个电机目标，不需要先由一颗 MCU 转发给另一颗。

### 四合一驱动板原理图

![四合一无感 FOC 电调 Rev E 原理图](/images/foc-quad-revd.png)

<p align="center">四合一无感 FOC 电调 Rev E：双 STM32G431CBT6 + 四 DRV8313PWPR，嘉立创 EDA 绘制</p>

原理图在嘉立创 EDA 中绘制并导出，网页缩略图用于查看整体结构，器件数值和引脚建议下载 PDF 放大阅读。

- [查看 / 下载原理图 PDF](/downloads/foc-revd/schematic.pdf)
- [下载器件 BOM（CSV）](/downloads/foc-revd/bom.csv)
- [下载引脚连接清单（JSON）](/downloads/foc-revd/connections.json)


| 模块 | 本版设计 | 作用 |
|---|---|---|
| 电机控制 | 2 × STM32G431CBT6 | 每颗执行两台电机的控制算法 |
| 三相功率级 | 4 × DRV8313PWPR | 将 PWM 转换为电机三相驱动电压 |
| 电流采样 | 每台电机 2 个 10mΩ 分流电阻、2 个 INA181A1 | 测量两相电流，重构第三相电流 |
| 采样参考 | 每个控制域一个 TLV9001 缓冲参考电压 | 为双向电流采样提供约 1.65V 中点 |
| CAN 接口 | 2 × TCAN1042HGVDR | 将 MCU 的 TX/RX 转换为 CANH/CANL 差分信号 |
| 关断逻辑 | GLOBAL_ARM、每路 RUN、nFAULT 与门 | 硬件禁止对应功率级输出 |
| 供电 | TPS563202 降压、两路 TLV75533 | 产生约 5V 和两组 3.3V |
| 辅助测量与调试 | 母线分压、NTC、独立 SWD/UART | 电压温度监测、下载及调试 |

#### 电源模块解释

![电源模块原理图](/images/power-module.png)

<p align="center">电源模块：VCC 降 5V + 两路 5V 降 3.3V</p>

电源部分为三级结构，把电池电压逐步降到各模块需要的电压轨：

- **VCC → 5V（TPS563202DDCR）**：U2 为同步降压转换器，C9（100nF）为 BOOT 自举电容，L2（4.7uH）为功率电感，R2/R1（100K/9.53K）构成 FB 反馈分压设定输出电压，C1/C2（22uF）输出滤波。输入端并联 C5（100uF）+ C7（10uF）吸收电池侧波动，LED1 作 5V 电源指示。
- **5V → 3.3VA（TLV75533PDBVR）**：U3 为 LDO，输出标注为 3.3VA 的独立 3.3V 轨，配 10uF 输入 / 4.7uF 输出电容，LED2（绿）作指示。
- **5V → 3.3VB（TLV75533PDBVR）**：U4 为同样的 LDO，输出标注为 3.3VB 的另一路 3.3V 轨，LED3 作指示。

两组 3.3V 轨（3.3VA / 3.3VB）相互独立，分别对应板上的两个控制域，与 CAN 接口原理图中的 3.3VA / 3.3VB 标号一一对应；模拟域和数字域分开供电可以减少开关噪声互相耦合。

#### 主控模块解释

![主控模块原理图](/images/mcu-module.png)

<p align="center">A/B 双主控最小系统 + 母线电压/温度采样 + 电流采样参考</p>

主控部分由两颗完全对称的 STM32G431CBT6（U5 = A 域，U6 = B 域）组成，各自独立的最小系统包括：

- **烧录与调试**：每颗 MCU 配一个 1×05 SWD 接口（SWDIO / SWCLK / 3.3V / GND）和一个 1×03 串口调试接口（UART TX / RX），两个域的下载调试互不干扰。
- **复位与去耦**：NRST 复位按键配 10K 上拉；电源引脚就近放置多路 100nF 去耦电容加 10uF 储能电容。
- **供电域隔离**：A 域挂 3.3VA、B 域挂 3.3VB，与电源模块的两路 TLV75533 输出一一对应。
- **电机控制信号**：每颗 MCU 引出各自的两台电机信号——三相 PWM（A/B_IN1/2/3_OUT）、使能 EN、nSLEEP、nRESET，对应 M1~M4 四台电机的驱动接口。
- **CAN 与外设**：A_CAN_TX/RX、B_CAN_TX/RX 分别接到各自域的 CAN 收发器，与飞控通信。

同一张图下部还有两个辅助采样电路，A/B 域各一份：

- **母线电压/温度采样**：电阻分压从 VCC 取样（输出 A_BATV / B_BATV 送 ADC），NTC 热敏电阻配合分压测温，100nF 滤波稳定采样点。
- **电流采样参考**：TLV9001 运放为每个控制域缓冲出约 1.65V 的零电流中点参考，供 INA181A1 低侧采样输出做双向偏置用，详细原理见下文「无感 FOC 为什么还需要电流采样」。

#### 电机驱动模块解释

![电机驱动模块原理图 M1/M2](/images/motor-driver-m1-m2.png)

<p align="center">M1/M2 电机驱动（A 域）：DRV8313 + INA181 相电流采样</p>

![电机驱动模块原理图 M3/M4](/images/motor-driver-m3-m4.png)

<p align="center">M3/M4 电机驱动（B 域）：结构与 M1/M2 完全对称</p>

四台电机的驱动电路完全相同，每台电机对应一片 DRV8313PWPR（U10 = M1、U12 = M2 归 A 域，U14 = M3、U20 = M4 归 B 域）：

- **功率级**：DRV8313 集成三相半桥，MCU 的三路 PWM 直接接 IN1/IN2/IN3，OUT1/OUT2/OUT3 经 1×3 2.54mm 排针（H5~H8）接电机三相线。电荷泵（CP1/CP2 配 10nF）、V3P3OUT（470pF）和 VCC 去耦（多路 100nF + 10uF）都是数据手册推荐的标准接法。
- **控制与故障**：每片驱动有独立的 EN、SLEEP_N、RESET_N 控制脚和 FAULT_N 故障输出，全部连回本域 MCU，对应前文 48 引脚分配表。
- **硬件关断**：每台电机配一片 SN74AVC1T17DBVR 电平转换器（U8/U11/U15/U19），把 GLOBAL_ARM、本域 RUN（A_RUN/B_RUN）和本路 FAULT_N 组合成 Mx_GATE 后接到驱动的 EN——任何一路故障或全局未武装时，硬件直接禁止对应功率级输出，不依赖固件。
- **相电流采样**：每台电机在 U、V 两相低侧各放一个 10mΩ 分流电阻（R20/R24/R30/R35），经 100R + 220pF/10nF 滤波后送 INA181A1IDBVR（增益 20 倍）放大，REF 引脚接 TLV9001 缓冲的约 1.65V 中点参考，输出 A_MxU/A_MxV（A 域）或 B_MxU/B_MxV（B 域）到各自 MCU 的 ADC。第三相电流由 `iW = -iU - iV` 重构。

#### CAN接口模块解释

![CAN 总线接口原理图](/images/can-interface.png)

<p align="center">CAN 总线接口：双收发器 + ESD 保护 + 安全信号电平转换</p>

CAN 模块按功能可以分为三部分：

- **总线接口（ZP1 + D2）**：ZP1 是 5 pin 对外接插件，引出 CANH、CANL、ARM_EXT 和 GND。D2 为 PESD2CAN 双向 ESD 保护管，直接跨接在 CANH/CANL 上，防止插拔线缆或静电把收发器打坏。
- **双 CAN 收发器**：板上有两路 CAN 收发器（3.3V 供电，配 10uF 去耦），分别服务不同的 CAN 通道，收发器把 MCU 的 TX/RX 逻辑电平转换成总线上的差分信号。
- **安全信号电平转换（U7/U8）**：ARM_EXT、ARM_SAFE、B_ARM_FB 等安全使能信号由 SN74AVC1T17DBVR 单通道电平转换器隔离，配合 R4/R5/R6/R7 上拉与 100nF 滤波，保证两套供电域之间安全信号可靠传递。

### 48 引脚如何安排双电机控制

每颗 G431 使用 TIM1 和 TIM8 各输出一组三相 PWM。DRV8313 内部已经集成功率 MOSFET 及其驱动逻辑，因此这里给每台电机提供三路 IN 信号，并单独控制 EN、nSLEEP 和 nRESET。

| 功能 | 本颗 MCU 的第一台电机 | 本颗 MCU 的第二台电机 |
|---|---|---|
| 对应编号 | A：M1；B：M3 | A：M2；B：M4 |
| 三相 PWM | PA8 / PA9 / PA10，TIM1_CH1/2/3 | PA15 / PB8 / PB9，TIM8_CH1/2/3 |
| U 相电流 | PA0，ADC1_IN1 | PB0，ADC1_IN15 |
| V 相电流 | PA1，ADC2_IN2 | PA6，ADC2_IN3 |
| 故障输入 | PB12，TIM1_BKIN | PB7，TIM8_BKIN |

此外还保留 PA11/PA12 用于 CAN、PA2/PA3 用于串口、PA13/PA14 用于 SWD。按当前接口需求，48 引脚可以安排下这些功能；后续仍需在 EDA 和固件配置中逐项核对复用关系，尤其是 PA15 的默认调试功能和 PB8 的启动配置。

### 无感 FOC 为什么还需要电流采样

“无感”主要指不使用编码器或霍尔位置传感器，并不意味着不测量电流。计划采用的观测器需要根据相电流、施加的电压以及电机参数估算转子电角度，电流环也需要实际电流作为反馈。

原版 SimpleFOC Mini 没有提供完整的相电流采样链路。新板为每台电机的 U、V 两相分别增加低侧分流电阻，再由 INA181A1 放大后送入 ADC；对于本项目的三线电机，第三相电流可由 `iW = -iU - iV` 重构。

10mΩ 分流电阻配合 20 倍增益，灵敏度为 `0.01Ω × 20 = 0.2V/A`。输出以约 1.65V 为零电流参考，从而测量正、反两个方向的电流。图中的正方向定义为电流从低侧 PGND 经分流电阻流向 GND；若控制算法把“驱动输出流向电机”定义为相电流正方向，则有效采样时应使用 `i_phase = (V_zero - V_adc) / 0.2`，并逐通道校准零点。

低侧采样不能在任意时刻读取。只有被测两相的低侧开关导通，并等待开关干扰衰减、放大器输出稳定后，采样值才有意义。两台电机的 PWM 与 ADC 触发需要错时安排；高占空比下如果有效窗口不足，就必须限制调制深度或采用经过验证的重构方法。

因此，本版计划使用 ADC1、ADC2 的双注入同步采样，并配合 TIM1、TIM8 的触发与通道上下文队列。**这部分仍待固件与示波器验证，原理图连通不代表采样时序已经成立。**

### 飞控为什么通过 CAN 控制电调

飞控与电调之间也可以使用 PWM、DShot 等接口。本项目选择 CAN，是希望同时学习总线通信，并通过同一对信号线完成四台电机的指令下发与运行状态回传。

这里要区分两种信号：飞控通过 CAN 发送电机目标，G431 在板内实时计算并输出驱动电机所需的三相 PWM。CAN 不负责传输每一个功率开关脉冲，电流环和位置估算在电调本地运行。

CANH、CANL 是一对差分总线线缆，需要连接 **CAN 收发器**，不能直接接到 MCU 的普通 GPIO 或 CAN_TX/CAN_RX 引脚。MCU 的 CAN 控制器负责处理数据帧，收发器负责总线电气信号。

| 对外接口 | 功能 | 是否必需 |
|---|---|---|
| CANH、CANL | 指令与状态的双向通信 | 必需 |
| GND | 非隔离 CAN 的公共参考地 | 必需 |
| ARM_EXT | 3.3V 硬件运行许可，高有效 | 本版必需 |
| 5V_OUT | 电调向外部设备供电 | 可选，SJ2 默认不装 |
| BAT+、GND | 电池功率输入，使用独立电源接口 | 必需 |

因此，本版飞控与电调之间至少有 **CANH、CANL、GND、ARM_EXT 四根线**。如果还需要电调给飞控供电，再接可选的 5V 输出。整条 CAN 总线只在两个物理末端各放一颗 120Ω 终端电阻，不是每颗 G431 都各放一颗。

初步协议采用经典 CAN、11 位 ID、1Mbit/s。控制帧计划使用 `0x100`，8 字节载荷安排为“四个 12 位目标值 + 一个字节序号 + 一个字节标志”。每颗 G431 提取自己负责的两个目标，遥测使用不同 ID 返回。

计划约每 1ms 更新目标，约 10ms 未收到有效的新序号控制帧时停机并锁存。具体目标单位、速度满量程和超时参数还需在固件阶段统一并验证。使用 CAN 并不代表已经兼容某个现成飞控协议，飞控与电调必须约定相同的应用层格式。

### GLOBAL_ARM 与故障关断

GLOBAL_ARM 是外部主控给整块电调的硬件运行许可。本版每一路驱动使能满足以下关系：

```text
驱动 EN = ARM_SAFE && 本路 MCU_RUN && 本路 nFAULT
```

其中 nFAULT 为高表示当前没有芯片故障报告。只有全局许可有效、本路软件允许运行且驱动没有报告故障时，功率级才能输出。

ARM、RUN、EN 以及驱动休眠和复位信号均安排了明确的默认状态。上电、复位或许可线悬空时保持关断；nFAULT 同时进入硬件与门和定时器 Break 输入。软件还要锁存故障，禁止故障消失后直接恢复旧指令。

GLOBAL_ARM 是静态许可，无法识别外部主控死机后引脚一直保持高电平的情况，因此仍需要 CAN 指令超时和 MCU 独立看门狗。本版也没有独立的精密硬件过流比较器及外部故障锁存器，不能把 DRV8313 的内部 OCP 当成精密电流限制。

### 供电与驱动能力的边界

本版按 **3S 电池**设计，VM 稳态约 9～12.6V。DRV8313 的推荐工作电压下限为 8V，而 2S 电池标称只有 7.4V，无法覆盖正常放电范围。因此本版不标称支持 2S，也没有加入升压电路；如果后续必须使用 2S，需要重新选择低压功率级。

DRV8313 的 2.5A 是峰值能力，持续电流受封装散热、铜皮和环境温度影响。1104 电机的尺寸与 KV 值不能直接确定带桨电流，开环空载能转也不能说明它能带着 2 寸桨长期运行。需要实际测量相电流、温升和母线尖峰，再决定是否保留这套功率级。

高转速还会压缩无感控制的采样余量。例如仅作估算，4300KV 电机在 12.6V 下的理想空载转速约为 5.42 万 rpm；**若为 7 极对**，电频率约 6.32kHz。此时 20kHz PWM 每个电周期只有约 3.2 个 PWM 周期，因此 20kHz 只能作为初期调试起点，不能据此保证最高转速可用。实际极对数、负载转速、采样建立时间和双电机 CPU 余量都需要实测。

### 接下来的验证顺序

硬件直接制作四合一板，调试仍按通道逐步推进，便于定位问题：

1. 在 EDA 中重画并核对封装、执行 ERC，完成电源回流、采样 Kelvin 走线及散热布局审查。
2. 拆桨、限流上电，确认电源、参考电压和四路默认关断状态。
3. 在新板上复现单电机开环，校准电流方向和零点，测量 PWM 与有效采样窗口。
4. 加入电流环和无感观测器，验证从开环启动到闭环接管；再加入速度环。
5. 验证一颗 G431 同时驱动两台电机时的采样调度、中断最坏执行时间及异常关断。
6. 四路联合运行，验证 CAN 超时、复位与故障恢复、母线扰动和温升，之后再做有防护的目标负载测试。

目前完成的是“开环驱动跑通”和“四合一硬件方案形成”。无感 FOC 闭环、四路满负载运行及实际飞行，仍是后续需要分别验证的阶段。

## 无感FOC软件设计

### 无感电流FOC闭环和纯开环的动态对比

前面的开环演示里，程序只按自己生成的电角度输出三相正弦电压，完全不关心转子转到哪了——这就是"开环"的本质：指令发出去，听天由命。而无感 FOC 闭环的核心区别是引入了**反馈**：通过采样相电流，用观测器实时估算转子位置，再让磁场始终领先转子 90° 电角度输出。

下面这个可交互演示把两种控制方式放在一起对比。可以分别观察：开环下"指令矢量"和"实际转子"逐渐脱节、负载扰动后转速跌落无法恢复；闭环下观测器持续跟踪转子角度、电流环自动补偿，负载变化后转速能拉回目标值。

<details open>
<summary><strong>展开观看：无感 FOC 闭环 vs 纯开环动态对比</strong></summary>

<div style="margin:16px 0 22px; padding:8px; border:1px solid rgba(128,160,190,.28); border-radius:14px; background:rgba(12,28,46,.35);">
<iframe src="/sensorless_vs_openloop.html" title="无感 FOC 闭环与纯开环动态对比演示" loading="lazy" style="display:block; width:100%; min-height:1120px; border:0; border-radius:10px; background:#0a0f16;"></iframe>
</div>

</details>

对比要抓住三个观察点：

- **转子跟踪**：开环的指令角度按固定频率递增，转子是否真跟上无从得知，负载稍大就失步；闭环的磁场方向由观测器估算的转子位置决定，磁场和转子之间的夹角始终被锁住。
- **电流意义**：开环的幅值只是一个"占空比系数"，不知道实际电流多大；闭环有电流反馈，d/q 轴电流被分别控制，q 轴电流直接对应转矩。
- **抗扰能力**：开环遇到负载波动没有任何补偿手段；闭环检测到转速/电流偏差后由 PI 调节器自动纠偏。

如果主题或部署环境不允许嵌入页面，也可以[单独打开对比演示](/sensorless_vs_openloop.html)。

> 注意：演示里的闭环是教学模型，用来直观理解"反馈带来什么不同"，不代表工程中的观测器已经实现。真实无感 FOC 还需要处理低速反电动势太弱、采样噪声、参数漂移等问题。







---
title: 基于FROTS的无感FOC无人机制作
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

目标是自制一台约 2 英寸机架的四轴无人机，准备制作一台无感FOC控制的四轴无人机，电机选用 1104、4300KV 小型无刷电机。然后自制四合一无感FOC驱动板。ESP32S3作为主控制器。当前开环验证阶段使用 TC264D 开发板驱动 SimpleFOC Mini。

> **代码仓库**：[FOC-Study](https://github.com/C29999/FOC-Study) — 纯开环强拖验证代码

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





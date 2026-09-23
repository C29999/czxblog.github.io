---
title: FOC无人机制作
description: 四轴飞控
categories: 四轴飞控
sticky: 4
top_img: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/0de60eacdcda934f26a88a2fd97b802d.jpeg'
cover: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/0de60eacdcda934f26a88a2fd97b802d.jpeg'
tags: Plan
abbrlink: 20377
date: 2025-08-17 12:00:00
---


## 本项目所使用到的技术栈

结构设计：
软件：FOC控制算法，FRTOS操作系统、

所使用到的硬件:主控未定



### 软件

#### FOC驱动板

本项目使用 SimpleFOC Mini 驱动板作为无刷电机的功率驱动模块。

> **SimpleFOC Mini 是什么？**
> 可以把它想象成电机和主控之间的「翻译官 + 肌肉」。主控（ESP32）只会输出 3.3V 的微弱 PWM 信号，而电机需要几十伏、几安的大电流才能转动。SimpleFOC Mini 的作用就是把主控的控制信号「翻译并放大」成足以驱动电机的三相交流电。

**核心芯片：DRV8313PWPR**

DRV8313 是德州仪器（TI）出品的三相无刷电机栅极驱动器，集成了三个半桥 MOSFET 驱动器，单芯片即可驱动一台三相 BLDC 电机。

![SimpleFOC Mini 驱动板原理图](/images/simplefoc-mini-sch.png)
<p align="center">SimpleFOC Mini 驱动板原理图（核心芯片：DRV8313PWPR）</p>

**关键参数：**

- ***供电电压 VM：8V ~ 60V***，可直接用 3S~14S 锂电池供电
- ***峰值输出电流：2.5A***，适合小型穿越机/四轴的无刷电机
- 支持 **6-PWM** 和 **3-PWM** 两种控制模式，配合 SimpleFOC 库使用
- 内置过流保护（OCP）、过温保护（OTP）、欠压锁定（UVLO）

**原理图要点解读：**

1. **电源滤波**：VM 输入端并联了 C3（100uF 电解电容），用来吸收电机启停时的电流尖峰，防止电源电压跌落导致主控复位——这就像给电机装了一个「蓄水桶」，急加速时不至于把管网压力抽干。
2. **电荷泵**：CP1/CP2/VCP 配合外部电容 C1、C2（100nF）生成高侧 MOSFET 的栅极驱动电压，让上桥臂能正常导通。
3. **保护电路**：nFAULT、nRESET、nSLEEP 引脚通过 R1~R3（10kΩ）上拉到 3.3V，默认使能；当芯片检测到过流或过温时，nFAULT 会被拉低，主控可据此做紧急停机。
4. **状态指示**：LED1 串联 R5（1kΩ）接在电源上，上电即亮，直观判断板子是否正常供电。

#### FOC控制算法



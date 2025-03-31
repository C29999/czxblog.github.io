---
title: Stm32单片机
date : 2025-2-18 10:00:00
categories: 单片机学习
description : stm32单片机学习笔记
top_img : https://cdn.jsdelivr.net/gh/C29999/P.bed/f8922ce33d5c47d7934843f712156d91.png
cover : https://cdn.jsdelivr.net/gh/C29999/P.bed/f8922ce33d5c47d7934843f712156d91.png
tags : 单片机学习
---

## STM32F103CBT6

### STM32串口通信

串口通信比较好的学习链接：[串口通信](https://www.lxlinux.net/e/stm32/stm32-usart-receive-data-using-rxne-time-out.html#_3-%E7%A1%AC%E4%BB%B6%E5%87%86%E5%A4%87)

串口通信通常是1V1通信，一段发送一段接受，也可以双向通信

常见串口通信的模式：

1.全双工：即可以接受又可以发送

2.半双工：即可以接受又可以发送，但是不能同时进行

3.单工：只能单向传输数据，只有一方能够发送数据，另外一方只能接受数据

#### 串口通信的数据格式

串口通信的数据格式有：起始位，数据位，校验位，停止位，数据帧位，波特率

比喻:

可以把串口通信比喻成邮递包裹的过程

数据位就如图快递包裹的标签中的信息，起始位则是邮递员的开场白，告诉另一个设备说我要传输数据了，而停止位就想邮递员确认签收，，而校验位则是确认包裹内容有没有被篡改或丢失

***在串口通信中，数据位就像是包裹中的“数字标签”，它们承载着实际的信息内容。在一个数据帧中，起始位和停止位则是运输包裹的“标记”，校验位是确保包裹完好无损的“安全封条***

#### 关于串口通信中的中断

接受中断(RX Interrupt): 每当串口接收到一个字节的数据时，就会触发接收中断。

发送中断：当串口发送缓冲区空闲时触发。即，当数据寄存器可以再发送一个字节时，会触发中断。

#### 串口通信中的USART模块

 ![UASRT模块引脚分配](https://cdn.jsdelivr.net/gh/C29999/P.bed/a3f655f646eafb23337476746ca3f68f.png)

### 定时器

### 关于定时器的基础简绍

**定时器的频率**：是指一秒钟执行的次数

### HAL库TIM中的一些函数

``` C++

HAL_TIM_PWM_Start();//用于输出PWM信号
HAL_TIM_PWM_Start_IT();//用于开启PWM输出中断
HAL_TIM_IC_CaptureCallback();//输入输出捕获
HAL_TIM_Base_Start_IT();//以中断的方式开启定时器
```

### 定时器中的中断回调函数


基本定时器：

#### 基本定时器中断

>void HAL_TIM_PeriodElapsedCallback(TIM_HandleTypeDef *htim)函数的中断设置

### 中断优先级的设置

#### 中断优先级的设置


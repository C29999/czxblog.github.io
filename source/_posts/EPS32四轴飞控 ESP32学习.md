---
title: 四轴飞控学习ESP32入门
description: 四轴飞控
categories: 四轴飞控
sticky: 4
top_img: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/0de60eacdcda934f26a88a2fd97b802d.jpeg'
cover: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/0de60eacdcda934f26a88a2fd97b802d.jpeg'
tags: Plan
abbrlink: 20377
date: 2025-08-17 12:00:00
---


## 学习链接

1. [ESP32入门](https://blog.csdn.net/qq_33964936/article/details/133777605)
2. [ESP32入门学习2](https://www.bilibili.com/video/BV1tv411w74d?spm_id_from=333.788.videopod.episodes&vd_source=35e34a8c020f6931dec5585c4482ad05&p=4)
3. [ESP32开发环境配置](https://blog.csdn.net/weixin_43842462/article/details/123295842)
4. [ESP32学习视频](https://www.bilibili.com/video/BV1JS4y1H7Rm/?spm_id_from=333.337.search-card.all.click&vd_source=35e34a8c020f6931dec5585c4482ad05)
5. [arduino入门](https://www.bilibili.com/video/BV1yp421274U/?spm_id_from=333.337.search-card.all.click&vd_source=35e34a8c020f6931dec5585c4482ad05)
6. [立创ESP32开源](https://oshwhub.com/liguanxi/si-zhou-fei-xing-qi-ESP-Liguanxi)
7. [遥控器开源](https://oshwhub.com/a1077/ESP32yao-kong-qi-WIFI-MQTT-ESPNO)
8. [神书.四旋翼飞行器设计与实现](https://zh.z-library.sk/book/18259743/fab4eb/%E5%9B%9B%E6%97%8B%E7%BF%BC%E9%A3%9E%E8%A1%8C%E5%99%A8%E8%AE%BE%E8%AE%A1%E4%B8%8E%E5%AE%9E%E7%8E%B0.html)
7.[卡尔曼滤波在智能车中的应用](https://blog.csdn.net/m0_53966219/article/details/126806419)
8.[MPU6050与磁力计融合：攻克Z轴角度漂移的血泪史](https://blog.csdn.net/qq_45217381/article/details/149421958)
9.[逻辑分析仪的使用和安装](https://blog.csdn.net/qq_50930131/article/details/145970151)
10.[虚拟机的使用](https://blog.csdn.net/weixin_48384182/article/details/109693775)

## 基础编译学习

Arduino IDE 的三个主要函数的作用：
  ![esp32界面](https://cdn.jsdelivr.net/gh/C29999/P.bed/10f82368316651ff74288577f5287119.png)

setup() 初始化一次，loop()

``` C++
void setup() {
  // 初始化设置，只运行一次
  pinMode(LED_BUILTIN, OUTPUT);
  int result = calculateSum(2, 3); // 调用自定义函数
}

void loop() {
  // 主循环，重复执行
  blinkLED(); // 调用自定义函数
  delay(1000);
}

// 自定义函数
int calculateSum(int a, int b) {
  return a + b;
}

void blinkLED() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
}
```

## 四旋翼飞行器学习

### 卡尔曼滤波算法

#### 一个笑话

一片绿油油的草地上有一条曲折的小径，通向一棵大树。一个要求被提出：从起点沿着小径走到树下。

“很简单。”A说，于是他丝毫不差地沿着小径走到了树下。

现在，难度被增加了：蒙上眼。

“也不难，我当过特种兵。”B说，于是他歪歪扭扭地走到了树旁。“唉，好久不练，生疏了。”（只凭自己的预测能力）

“看我的，我有DIY的GPS！”C说，于是他像个醉汉似地歪歪扭扭的走到了树旁。“唉，这个GPS没做好，漂移太大。”（只依靠外界有很大噪声的测量）

“我来试试。”旁边一也当过特种兵的拿过GPS，蒙上眼，居然沿着小径很顺滑的走到了树下。（自己能预测+测量结果的反馈）

“这么厉害！你是什么人？”

“卡尔曼！”

“卡尔曼？！你就是卡尔曼？”众人大吃一惊。

“我是说这个GPS卡而慢。”

#### 卡尔曼滤波算法简介

>引入协方差，协方误差，协方误差
>>方差 是特殊的协方差（一个变量与自身的协方差），均方误差 是评估预测效果的重要指标，而协方差 是理解多个变量间关系的关键。
>>**均方误差 (MSE - Mean Squared Error)**
核心： 衡量 估计值 (或测量值) 与 真实值 之间的偏差程度。
特点： 评估的是“估计的准确性”或“测量的精确度”。误差越大，均方误差越大，说明估计或测量结果越不准确。
**方差 (Variance)**
核心： 描述 单个随机变量 自身的离散程度或波动大小。
特点： 衡量的是变量值围绕其 期望值（均值） 的波动情况。方差越大，数据越分散。
**协方差 (Covariance)**
核心： 描述 两个随机变量 之间的变化趋势及相关性。
特点：
正值 表示两变量变化趋势一致（你大我也大）。
负值 表示两变量变化趋势相反（你大我小）。
零 表示两变量没有线性相关关系
>>

#### 卡尔曼滤波的应用场景

1.当不能直接测量得到想要的数据时，应用卡尔曼滤波来间接测量
2.在有噪音情况下结合不同传感器来找到的最佳估计值

>如在飞控上的应用
>>姿态角估计
>>通过建立含有姿态角，角速度，加速度等状态量的模型，通过IMU的数据进行卡尔曼滤波，重新估计出状态量，间接得到姿态角的数据
>>位置估计（组合导航）：
>>加速度一次，二次积分可以得到速度，位置，GPS测量可以得到位置，通过卡尔曼滤波可以融合加速度计和GPS数据得到更精确的位置

智能车在卡尔曼滤波算法中的应用：

``` C++
/*************************************************************************
*  功能说明：卡尔曼滤波
*  修改时间：2021年5月26日
*************************************************************************/
int kalman_filter(kalman_param *kfp, int input)
{
     kfp->Now_P = kfp->LastP + kfp->Q;
     //卡尔曼增益方程差
     kfp->Kg = kfp->Now_P / (kfp->Now_P + kfp->R);
     //更新最优值方程
     kfp->out = kfp->out + kfp->Kg * (input-kfp->out);
     //更新协方差方程
     kfp->LastP = (1-kfp->Kg) * kfp->Now_P;
     return kfp->out;
}
```

### 四轴飞控发展历史

### 四轴飞控飞行原理

 四旋翼飞行器通过改变四个旋翼的转速，依据力的合成与扭矩平衡原理实现灵活飞行；其相邻旋翼转向相反、对角转向相同，并分别配以正、反螺旋桨来共同产生向上的升力，且所有旋翼均需向下吹风以确保提供向上的拉力。
  ![四轴飞控](https://cdn.jsdelivr.net/gh/C29999/P.bed/0b596ef9f5956c88caaa87a0b9d79e3a.png)

### 四轴飞控硬件

  四轴飞控硬件大致框架：
  ![四轴飞控硬件](https://cdn.jsdelivr.net/gh/C29999/P.bed/6098bbe8a7d82ff8afe518dec9eb15f9.png)

### 如何解决MPU6050零漂问题？

1.**我的想法是MPU6050加一个磁力技基础上在加一个滤波算法读出6050的值**

### 关于ESP32

ESP32是一款ESP32是一款高性能、低功耗的**Wi-Fi/蓝牙双模物联网芯片**，集成了丰富的外设和强大的计算能力。

>使用ESP32进行四轴飞控的开发，作为四轴飞控核心，凭借双核处理、硬件PWM和Wi-Fi/蓝牙一体化，可实现低成本高响应的无人机控制；适合轻量级应用，但复杂环境需优化实时性

### 机械方面

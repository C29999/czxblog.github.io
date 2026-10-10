---
title: 基于龙芯2K0300的纯视觉巡线小车
tags: 智能车竞赛
categories: 学习
description: 基于龙芯2K0300的纯视觉巡线小车
top_img: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/1404c9ee1a2bd34fd968d63b90c87a0e.png'
cover: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/1404c9ee1a2bd34fd968d63b90c87a0e.png'
type: 竞赛
abbrlink: 16631
date: 2026-09-20 18:00:00
---

## 该项目已经全部开源至GitHub

[龙芯2K0300纯视觉巡线小车](https://github.com/C29999/longxingcoding)
## 项目介绍

本工程以龙芯 2K0300 为主控，运行嵌入式 Linux。程序使用 C++ 编写，通过 UVC 灰度摄像头识别赛道，经过二值化、边线搜索、逆透视、中线与前瞻点计算得到转向误差，再结合 IMU 与双轮编码器，控制两个电机以差速方式巡线。


整体数据流如下：

```text
UVC 灰度图（160×120）
  → 大津法阈值、二值化
  → 近端/远端左右边线搜索
  → 鸟瞰映射、重采样、左右边线配对
  → 中线与前瞻点
  → 转向目标角速度
  → IMU 角速度反馈、左右轮目标速度差
  → 编码器速度反馈、双电机 PWM
```

### 龙芯架构

ARM、x86-64、RISC-V 和 LoongArch 都是 CPU 指令集架构（ISA），规定了处理器能够直接执行的指令。不同架构的机器码不能直接通用：Windows 开发机通常是 x86-64，板端为 LoongArch，因此工程需要用对应的交叉编译器生成板端可执行文件。

| 架构 | 典型使用场景 | 与本工程的关系 |
| --- | --- | --- |
| x86-64 | Windows 开发机、Ubuntu 虚拟机所在的电脑 | 编写源码并运行交叉编译器 |
| LoongArch | 龙芯处理器 | 运行最终编译出的 Linux 程序 |
| ARM、RISC-V | 其他嵌入式和通用计算平台 | 机器码不能直接拿到龙芯板端运行 |

#### 本工程所使用的编译链

```text
Windows 修改源码
  → VMware Ubuntu 通过共享目录同步工程
  → CMake + LoongArch 交叉编译
  → SCP 上传到板端 /home/root/project
  → SSH 运行并连接 Windows 上位机
```

交叉编译的意义是：编译过程在开发电脑上完成，生成的程序却面向另一种指令集和板端 Linux 运行环境。工程的一键脚本串联了同步、编译、上传与远程运行。上传时先写入临时程序，再替换正式可执行文件，避免直接覆盖运行中的程序。

## 项目架构

### 硬件资源

| 模块 | 本工程配置 |
| --- | --- |
| 主控 | 龙芯 2K0300，嵌入式 Linux |
| 摄像头 | UVC USB 灰度摄像头，160×120 |
| 显示 | IPS200 屏幕 |
| 姿态传感器 | IMU660RB，Z 轴角速度用于角速度反馈和航向积分 |
| 轮速传感器 | 左、右轮编码器，每 10 ms 读取一次增量 |
| 执行机构 | 两个直流电机；左轮为电机 2，右轮为电机 1 |
| 通信 | 板端 TCP 客户端连接 Windows 上位机，上传图像和运行状态，接收调参命令 |

### 主循环与周期任务

视觉和网络通信由 Linux 应用主循环处理。主循环等待摄像头的新图像，执行图像算法，读取上位机命令并发送调试数据。编码器、IMU 与闭环控制由独立周期回调更新：

| 周期 | 工作内容 |
| --- | --- |
| 2 ms | 根据前瞻点横向误差计算目标角速度 |
| 5 ms | 根据 IMU Z 轴角速度计算左右轮目标速度差 |
| 10 ms | 更新编码器和 IMU，执行双轮速度环与 PWM 输出 |
| 1 s | 统计帧率并通知主循环刷新运行状态 |
| 125 ms | 主循环发送一组完整图传数据，约 8 FPS |

通信可能受网络状态影响，因此 TCP 发送放在主循环，不放进 2/5/10 ms 周期回调。周期回调读取最近一次有效的视觉结果；摄像头每产生新帧时，主循环更新中线和前瞻点。

## 图像处理

下面既说明当前车端正在执行的算法，也保留可供对照的其他算法代码。标为“备选”的示例尚未接入当前工程，示例中的旧尺寸常量和舵机量纲不能直接用于这辆差速车。

### 大津法二值化

摄像头输出 160×120 灰度图。赛道以白色为主，背景以黑色为主；程序用全局大津法寻找把两类像素分开的灰度阈值，再将图像转成黑白二值图。

大津法对每个候选阈值计算前景和背景的类间方差，选取方差最大者。工程中对应的核心计算为：

```cpp
double w0 = (double)cnt_fg / total;
double w1 = 1.0 - w0;
double mu0 = (double)sum_fg / cnt_fg;
double mu1 = (double)sum_bg / cnt_bg;
double var = w0 * w1 * (mu0 - mu1) * (mu0 - mu1);

if (var > max_var) {
    max_var = var;
    best_t = (uint8)t;
}
```

这里 `w0`、`w1` 是两类像素所占比例，`mu0`、`mu1` 是各自平均灰度。两类分得越开，类间方差越大。得到阈值后按以下规则二值化：

```cpp
binary[i] = (gray[i] > threshold) ? 255 : 0;
```

![灰度图与大津法二值化对比](/images/otsu-before-after.png)

<p align="center">左：摄像头灰度原图；右：大津法二值化结果</p>

为减少边线因曝光和反光逐帧闪烁，主循环对大津阈值先限制每帧变化量，再做低通平滑。二值图还会清除少量孤立白色散斑。全局阈值无法单独处理每处阴影，因此调试时需要同时看灰度原图、二值图及边线叠加结果。

```cpp
int16 delta = (int16)raw_t - (int16)filtered_t;
if (delta > 8) delta = 8;
if (delta < -8) delta = -8;
const int16 limited_t = (int16)filtered_t + delta;
filtered_t = (uint8)(((int16)filtered_t * 3 + limited_t + 2) / 4);
```


#### 阈值算法的备选实现

##### 类间方差的等价计算

数学形式，用于说明大津法为什么要最大化类间方差。

```c
// 类间方差 = wB * wF * (μB - μF)²
// 用 sumB*N - sum*wB 避免除法
float diff = sum_back * pixel_count - sum_total * w_back;
float var = (diff * diff) / (w_back * w_fore);
```

##### 两次迭代的全局阈值示例

备选阈值流程。当前工程使用单次全局大津法，并对逐帧阈值做限速和平滑。

```c
void image_threshold(const uint8 image[MT9V03X_H][MT9V03X_W])
{
    uint32 histogram[256] = {0};
    uint32 pixel_count = 0;

    // 隔行采样统计直方图
    for (y = 0; y < MT9V03X_H; y += 2)
        for (x = 0; x < MT9V03X_W; x += 2)
            histogram[image[y][x]]++, pixel_count++;

    uint8 threshold = otsu_compute(histogram, pixel_count);   // 第一次 T1

    // 把 T1 以下的直方合并到 T1 桶
    uint32 low_sum = 0;
    for (level = 0; level < threshold; level++)
        low_sum += histogram[level], histogram[level] = 0;
    histogram[threshold] += low_sum;

    threshold = otsu_compute(histogram, pixel_count);          // 第二次 T2
    for (y = 0; y < MT9V03X_H; y++)
        for (x = 0; x < MT9V03X_W; x++)
            image_binary[y][x] = (image[y][x] < threshold) ? 0 : 255;
}
```

##### 分块阈值示例

备选阈值流程。当前工程没有启用分块大津法。

```c
void image_threshold_block(const uint8 image[MT9V03X_H][MT9V03X_W])
{
    // 1. 每块独立算阈值，写入 image_threshold_map
    for (block_y = 0; block_y < IMAGE_OTSU_BLOCK_ROWS; block_y++) {
        y_top    = block_y * IMAGE_OTSU_BLOCK_H;
        y_bottle = y_top + IMAGE_OTSU_BLOCK_H;
        for (block_x = 0; block_x < IMAGE_OTSU_BLOCK_COLS; block_x++) {
            x_left  = block_x * IMAGE_OTSU_BLOCK_W;
            x_right = x_left + IMAGE_OTSU_BLOCK_W;
            image_threshold_map[block_y][block_x] =
                otsu_local_threshold(image, x_left, x_right, y_top, y_bottle);
        }
    }
    // 2. 逐像素查对应块的阈值二值化
    for (y = 0; y < MT9V03X_H; y++)
        for (x = 0; x < MT9V03X_W; x++) {
            block_x = x / IMAGE_OTSU_BLOCK_W;
            block_y = y / IMAGE_OTSU_BLOCK_H;
            image_binary[y][x] =
                (image[y][x] < image_threshold_map[block_y][block_x]) ? 0 : 255;
        }
}
```

### 迷宫法搜索左右边线

在靠近图像中部的位置分别向左、向右扫描黑白跳变，取得左右边线起点。然后根据当前行进方向检查“正前方”和“斜前方”像素，沿着黑白边界逐点追踪。近端、远端分别搜索，避免远端轨迹向下回爬到车头附近。

搜索使用灰度图和当前大津阈值判断黑白。边线结果保存在左右轨迹数组中，也按图像行记录有效点；找不到边线的行用 `-1` 表示，方便统计丢线位置。迷宫法对起点和局部噪声敏感，不能仅凭一条线“有点”就认定它是赛道边界，后续还需要检查左右线的相对位置与连续性。


#### 起点、逐行跟踪与贴边搜索的对照代码

##### 按行寻找完整白色区间

按行找线的示意代码；当前工程分别从中部向两侧寻找起点。

```c
for (yy = PERS_H - 2; yy >= 2; yy--) {
    // 找完整白段：左/右边界外侧必须是黑像素
    if (run_left > 1 && run_right < PERS_W - 2 &&
        binary[yy][run_left - 1]  < THRESH &&
        binary[yy][run_right + 1] < THRESH) {
        score = abs(center - previous_center) * 3
              + abs(width - previous_width);   // 与上一帧越连续分越低
        if (score < best_score) 记最佳左右边界;
    }
    if (best_left >= 0) return 1;   // 找到第一行就返回
}
```

##### 按行跟踪的连续性评分

按行追踪的示意代码；当前工程采用左右独立的迷宫法。

```c
score = center_jump * 4 + abs(width - previous_width);
if (score < best_score) { best_left = run_left; best_right = run_right; }
// 连续丢 2 行就停止，不硬补
if (best_left < 0) { if (++miss_count >= 2) break; continue; }
```

##### 迷宫法方向查找表

方向查表的基本思想；当前工程有自己的方向数组。

```c
// 正前方、左前方、右前方的坐标增量
static const int16 edge_dir_front[4][2]     = { {0,-1}, {1,0}, {0,1}, {-1,0} };
static const int16 edge_dir_frontleft[4][2] = { {-1,-1}, {1,-1}, {1,1}, {-1,1} };
static const int16 edge_dir_frontright[4][2] = { {1,-1}, {1,1}, {-1,1}, {-1,-1} };
```

##### 左手边界追踪示例

左手追踪的原理示例，具体判黑规则以当前 image.cpp 为准。

```c
while (step < max_points - 1 && turn < 4) {
    fx  = x + edge_dir_front[dir][0];       // 正前方
    fy  = y + edge_dir_front[dir][1];
    flx = x + edge_dir_frontleft[dir][0];   // 左前方
    fly = y + edge_dir_frontleft[dir][1];

    if (binary[fy][fx] >= THRESH) {
        if (binary[fly][flx] >= THRESH) {
            dir = (dir + 3) % 4;            // 左转 90°
            x = flx; y = fly;               // 斜走左前方
        } else {
            x = fx; y = fy;                 // 直行
        }
        turn = 0;
        points[++step][0] = x; points[step][1] = y;
    } else {
        dir = (dir + 1) % 4;                // 前方不通，右转 90°
        turn++;
    }
}
```

##### 右手边界追踪示例

右手追踪的原理示例，具体判黑规则以当前 image.cpp 为准。

```c
if (binary[fy][fx] >= THRESH) {
    if (binary[fry][frx] >= THRESH) {
        dir = (dir + 1) % 4;                // 右转 90°
        x = frx; y = fry;
    } else { x = fx; y = fy; }              // 直行
} else {
    dir = (dir + 3) % 4;                    // 左转 90°
    turn++;
}
```

### 逆透视、重采样与中线

原图中同样的赛道宽度会随远近产生透视变化。工程使用标定脚本生成的查找表，把原图轨迹映射到 160×120 鸟瞰坐标。当前标定比例为 40 px/m，约 2.5 cm/px。标定文件由脚本生成，改变相机位置或标定点后需要重新打表。

映射后的轨迹经过平滑和等距重采样。近端中线要求左右边线都有效：以一侧轨迹的点为基准，在另一侧寻找鸟瞰纵坐标接近的点，再取两侧横坐标的平均值。对应点纵向相差超过 1 px 或左右顺序不成立时，不生成该处中点。

```cpp
if (nearest < 0 || nearest_dy > 1.0f) continue;

const float lx = reference_is_left ? reference[i][0] : opposite[nearest][0];
const float rx = reference_is_left ? opposite[nearest][0] : reference[i][0];
const float mx = (lx + rx) * 0.5f;
const float my = (y + opposite[nearest][1]) * 0.5f;
```

中线再按约 1 px 的路径间距重采样。前瞻点取中线第 15 个点；控制误差是前瞻点的鸟瞰横坐标与车体基准 `x=80` 的差：

```cpp
const float lateral_error = debug_lookahead_point[0] - 80.0f;
```

例如显示 `1.6 px` 时，按当前标定约为 4 cm。判断车辆是否位于赛道中央时，还应查看左右边线和中线的实际位置，不能只看误差数字。


#### 前瞻点的几何控制备选方案

##### Pure Pursuit 曲率示例

备选几何控制方式；当前车的转向外环直接生成目标角速度，没有使用这段舵机角度换算。

```c
dx = mx - cx;                          // 前瞻点相对车头的横向偏差
dy = cy - my + 0.2f;                   // 纵向距离
dn = sqrtf(dx * dx + dy * dy);
pure_rad = -atanf(2.0f * 0.3f * dx / (dn * dn));   // Pure Pursuit 曲率
pure_angle = pure_rad * 57.2958f / SMOTOR_RATE;    // 转成舵机量纲
```

## 特殊赛道元素

现阶段的主流程输出近端、远端的左右边线和近端中线。十字、环岛等特殊元素会改变边线的连续性与宽度，不能仅靠某一行的两个边界点判断类型。本文保留边线断点、起始点和鸟瞰轨迹作为调试依据；独立的特殊元素状态识别与补线规则尚未在当前主流程中完成。
## 闭环控制

这辆车通过左右轮差速转向，控制链为“视觉横向误差 → 目标角速度 → 左右轮速度差 → 双轮 PWM”。三个环的输入和输出单位不同，调参时需要逐层检查。

### 转向外环

转向外环读取前瞻点误差，并结合当前双轮平均速度生成目标角速度。车速为零时，该速度缩放项为零。为避免较大的死区忽略真实横向偏移，当前只保留较小的误差滞回：超过 0.5 px 启动修正，进入 0.25 px 内停止修正。

```cpp
const float speed_true =
    ((float)motor_left_speed_filtered + (float)motor_right_speed_filtered) * 0.5f;
const float speed_factor = speed_true > 0.0f ? speed_true / 250.0f : 0.0f;
const float expect_gyro_raw =
    lateral_error * speed_factor * steering_pid.kp * 100.0f;
```


#### 复合方向控制的备选示例

##### 复合 PD 与角速度阻尼示例

备选复合方向控制器；当前工程采用图像外环和 IMU 角速度内环。

```c
float quadradic_pid_solve(pid_param_t *pid, float error)
{
    // P：线性 + 平方（小误差温和，大误差自动加力）
    pid->out_p = pid->kp * error + pid->kp2 * error * fabsf(error);
    // D：一阶低通微分，抑制噪声
    float diff = error - pid->pre_error;
    pid->out_d = diff * pid->low_pass + pid->out_d * (1.f - pid->low_pass);
    pid->pre_error = error;

    return MINMAX(pid->out_p, -pid->p_max, pid->p_max)
         + MINMAX(pid->kd * pid->out_d, -pid->d_max, pid->d_max)
         - gyro_z * pid->kgyro;          // 陀螺阻尼
}
```

### IMU 角速度环

IMU660RB 读取 Z 轴原始角速度，按 `raw_z / 131.0f` 换算成 `deg/s`。初始化后先采集静止样本估计零偏，再用实际角速度和目标角速度的差计算左右轮目标速度差。航向角由角速度按采样周期积分得到。


#### 角速度零偏、滤波与积分示例

##### 角速度零偏、低通与积分

角速度处理的示例；当前工程以 10 ms 采样并使用自己的零偏与滤波参数。

```c
float calibrated = raw - gyro_z_offset;
gyro_z = calibrated * 0.3f + gyro_z * 0.7f;   // 低通
z_angle += gyro_z * 0.005f;                    // 积分（5ms 周期）
```

### 双轮速度环

左、右编码器每 10 ms 取得一次计数增量。速度环以最近采样值的滑动平均作为反馈，为两轮分别执行增量式 PID，再对 PWM 输出做滤波。转向速度差参与左右轮目标混控：

```cpp
int32 left_target_mixed  = (int32)motor_left_speed_target  + turn_speed_delta;
int32 right_target_mixed = (int32)motor_right_speed_target - turn_speed_delta;
```

车辆只允许向前，混控目标和最终 PWM 均限制为非负值。若电机 PWM 持续达到堵转阈值，而相应编码器在设定时间内一直为零，控制器停止双轮并置位保护状态。


#### 速度分配与 PID 的补充示例

##### 按弯道角度动态降速

备选弯道降速策略；当前工程的基础速度由上位机设置。

```c
float factor = 1.3f - fabsf(pure_angle) * corner_speed_slope;
if (factor < 0.4f) factor = 0.4f;        // 最低保留 40%
dynamic_speed = corner_speed * factor;
```

##### 弯道内外轮差速分配

差速混控的通用例子；当前工程实际采用 left=base+delta、right=base-delta。

```c
int16 diff = differential_add_speed2(dynamic_speed, angle);
int16 diff_outer = diff * turn_diff_outer;
if (angle > 0) { l_goal -= diff; r_goal += diff_outer; }  // 右转
else           { r_goal -= diff; l_goal += diff_outer; }  // 左转
```

##### 增量式 PID 示例

增量式 PID 的公式示例；当前工程的实现位于 pid.cpp。

```c
float increment_pid_solve(pid_param_t *pid, float error)
{
    pid->out_p = kp * (error - pid->pre_error);
    pid->out_i = ki * error;
    pid->out_d = kd * (error - 2*pid->pre_error + pid->pre_pre_error);
    pid->output = pid->out_p + pid->out_i + pid->out_d;

    if (pid->pre_output > 10000 && pid->output > 0) pid->output = 0;
    if (pid->pre_output < -10000 && pid->output < 0) pid->output = 0;
    return pid->output;
}
```

## 上位机与调试

板端作为 TCP 客户端连接 Windows 上位机。主循环发送灰度图、二值图、鸟瞰图和边线、中线等叠加数据；状态数据包括编码器、IMU、速度目标与 PWM。上位机可以下发 PID 参数、速度目标和发车停车命令。

视觉调试应沿着“灰度原图 → 二值图 → 原图边线 → 鸟瞰边线 → 中线 → 前瞻点”的顺序排查。若车辆明显贴边而误差很小，先检查两条边线是否确实对应赛道两侧、中线是否位于两线之间，以及车体基准与标定坐标是否一致；若视觉位置正确，再检查转向目标、角速度反馈和左右轮目标是否产生预期差值。

## 踩坑记录

### 横向误差很小，车却明显贴边

当前标定约为 40 px/m，1.6 px 约对应 4 cm。早期转向环设置了约 1～2 px 的滞回死区，这类误差会被直接清零。现将介入阈值收窄到 0.5 px、退出阈值收窄到 0.25 px。若仍贴边，需要核对左右鸟瞰边线、中点和车体基准 x=80 是否一致，再检查目标角速度与轮速差，不能仅靠提高 PID 增益。

### 边线闪烁和远端串线

大津阈值随反光变化会让起点跳动；远端独立爬线也可能跟到另一条轮廓。阈值限速与二值散斑清理针对前一种情况；近远端搜索区域和左右半幅限制针对后一种情况。判定改动效果时，应同时看灰度原图、二值图、各边线起点及鸟瞰图。

### 图传与控制周期互相影响

完整图传限定约 125 ms 一组。TCP 发送在主循环进行，2/5/10 ms 回调只更新控制状态，避免网络拥塞把周期控制阻塞住。
## 编译与运行

Ubuntu 虚拟机通过共享目录同步 Windows 工程，再执行一键脚本完成交叉编译、上传和远程运行：

```bash
cd ~/Desktop
bash /mnt/hgfs/lonxing/sync_build.sh
```

板端可以通过 SSH 登录，程序位于 `/home/root/project`。这种方式便于把图像处理、控制算法和协议修改快速部署到真机，再利用上位机图像与波形验证效果。

---
title: 龙芯 Linux 学习笔记
tags: 龙芯
categories: 学习
description: 从零开始折腾龙芯 2K0300 上的 Linux：环境搭建、驱动开发到应用编程
sticky: 2
top_img: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/1404c9ee1a2bd34fd968d63b90c87a0e.png'
cover: 'https://cdn.jsdelivr.net/gh/C29999/P.bed/1404c9ee1a2bd34fd968d63b90c87a0e.png'
type: 学习
abbrlink: 2K0300
date: 2026-10-24 12:00:00
---

## 为什么写这篇

之前做巡线小车项目时，第一次在龙芯 2K0300 上跑 Linux，从烧录系统、交叉编译到驱动摄像头，踩了不少坑。项目文章里只写了和巡线直接相关的部分，但很多通用的东西——比如环境怎么搭、内核怎么编、设备树怎么改——散落在各处，没有一个系统记录。

这篇笔记把龙芯平台上的 Linux 学习过程单独整理出来，按「用起来 → 改驱动 → 写应用」的顺序展开。和项目文章的关系是：那一篇讲「做了什么」，这一篇讲「龙芯 Linux 本身怎么玩」。

## 平台与工具链

- **芯片**：龙芯 2K0300，LoongArch32 架构，LA264 单核，约 1GHz
- **开发方式**：Windows 写代码 → VMware Ubuntu 交叉编译 → 通过共享目录/网络传到开发板运行
- **系统**：Buildroot 构建的 Linux（内核 + 根文件系统）

## linux 基础命令

**man：查看命令手册**

`man` 是 manual 的缩写，用来查任何命令的用法。`man ls` 就是查看 `ls` 命令的说明，同样可以 `man cd`、`man mkdir`、`man rm`。

**ls -l：查看目录详情**

```bash
ls -l    # 查看当前目录下的文件和目录，显示详细信息

seekfree@seekfree:~/Desktop$ ls -l
总计 48
-rw-rw-r-- 1 seekfree seekfree    58  1月 30  2026 使用gitee拉取开源库.txt
-rw-rw-r-- 1 seekfree seekfree    41  1月  6  2026 用户密码.txt
-rw-rw-r-- 1 seekfree seekfree 39744  9月  5 16:33 install.sh
```

每一行开头的 `-rw-rw-r--` 就是文件类型和权限位，分两部分看：

1. **第一个字符 `-`**：普通文件，不是目录、不是链接（`d` 表示目录，`l` 表示链接）
2. **后面 9 位分三组**：`rw-` / `rw-` / `r--`
   - 属主（seekfree）：可读、可写，不能执行
   - 同组用户（seekfree 组）：可读、可写，不能执行
   - 其他人：**只能读**，不能写、不能执行

### mkdir / cp / mv：建目录、复制、移动

- `mkdir 文件夹名`：新建目录，加 `-p` 可一次创建多级嵌套（`mkdir -p a/b/c`）
- `cp 源文件 目标`：复制，拷目录要加 `-r`
- `mv 源 目标`：移动或重命名

用 `ls -l` 验证，新建的目录会以 `d` 开头显示。

**实操案例**：建一个 `linux-demo` 文件夹，把脚本复制进去，再建嵌套目录并移动文件：

```bash
# 1. 创建文件夹
mkdir linux-demo
# 2. 复制脚本进去
cp install.sh linux-demo/
# 3. 新建嵌套目录
mkdir -p linux-demo/code/app
# 4. 把密码文本移动进去
mv "用户密码.txt" linux-demo/
# 5. 查看文件夹里面内容
ls linux-demo
```

这 5 步把 `mkdir`、`cp`、`mv` 三个命令串成了一个完整流程：先建容器（`mkdir`），再往里面放东西（`cp` 复制文件、`mv` 移动文件），最后用 `ls` 验证结果。

### 设备树

#### 为什么需要设备树

x86 平台有 ACPI/PCI，硬件可以自描述，内核启动时自己枚举设备。但 ARM / LoongArch / RISC-V 这类嵌入式平台没有这套机制——引脚复用、外设地址、中断号都由板级设计决定，内核不可能为每一块板子写死代码。

所以把"硬件描述"从内核代码里剥离出来，变成一份数据文件，由 bootloader 在启动时传给内核。这份数据就是设备树。

#### 三个文件后缀

| 后缀 | 说明 |
|------|------|
| `.dts` | 板级描述，文本格式，人可读 |
| `.dtsi` | SoC 级公共部分，被 dts 用 `#include` 引入，类似头文件 |
| `.dtb` | 由 dtc 编译出的二进制，内核实际读取的形式 |

#### 启动与匹配流程

```text
dts --(dtc 编译)--> dtb --(u-boot 加载)--> 内核展开成 device_node
  --> 生成 platform_device --> 匹配驱动 of_match_table 里的 compatible
  --> driver probe() --> 注册 /dev/xxx
```

#### 常用属性

| 属性 | 说明 |
|------|------|
| `compatible` | 兼容性字符串，用来和驱动的 `of_match_table` 匹配 |
| `reg` | 寄存器起始地址和长度 |
| `status` | `"okay"` 启用该节点，`"disabled"` 禁用 |
| `interrupts` | 中断号及触发方式 |
| `gpios` | 引用的 GPIO（控制器句柄 + 引脚号 + 有效电平） |
| `pinctrl-0` | 引脚复用配置，指向 pinctrl 节点 |
| `clocks` | 引用的时钟源 |

#### 我板子上的真实例子

设备树文件：`arch/loongarch/boot/dts/loongson/seekfree_2k0300_coreboard.dts`，其中一个蜂鸣器节点：

```dts
zf_gpio_beep {
    status = "okay";
    compatible = "seekfree,gpio_out";
    gpios = <&gpa1 10 GPIO_ACTIVE_HIGH>;
};
```

对应驱动 `drivers/seekree_libraries/zf_driver/zf_driver_gpio.c`，其 `of_match_table` 里有：

```c
{ .compatible = "seekfree,gpio_in" },
{ .compatible = "seekfree,gpio_out" }
```

驱动 probe 成功后生成 `/dev/zf_gpio_beep`，应用层直接当文件操作：

```c
int fd = open("/dev/zf_gpio_beep", O_RDWR);
write(fd, "1", 1);
```

> dts 里那 5 行是整个链路（设备树 → 驱动 → /dev → 应用）的起点。

#### 和 STM32 裸机的对比

| | STM32 裸机 | Linux |
|---|---|---|
| 硬件信息在哪 | 写死在 C 代码里（`HAL_GPIO_Init(GPIOA, ...)`） | 运行时可替换的数据（dtb） |
| 适配范围 | 编译进固件，只服务一块板 | 一份内核镜像适配多种板卡 |
| 类比 | 量身定做的衣服 | 通用衣服 + 身材数据表（设备树） |

#### 在板子上查看设备树

```sh
ls /proc/device-tree/
cat /proc/device-tree/model
dtc -I fs -O dts /sys/firmware/devicetree/base | less
```

#### 面试考点

- **设备树和驱动的关系？** 设备树说"有什么、在哪"，驱动说"怎么操作"，两者靠 `compatible` 字符串绑定。
- **.dts 和 .dtb 的区别？** .dts 是人可读的文本源码，.dtb 是 dtc 编译出的二进制，内核读的是后者。
- **status = "disabled" 的作用？** 保留节点但禁用，内核不会为它生成设备，常用于同一份 dts 适配不同配置。
- **compatible 怎么匹配？** 内核把节点的 compatible 字符串和驱动 `of_match_table` 里的条目做精确匹配，命中就调用 probe()。
- **为什么 x86 不用设备树？** x86 有 ACPI/PCI 自描述机制，硬件能被内核自动枚举，不需要额外的硬件描述文件。

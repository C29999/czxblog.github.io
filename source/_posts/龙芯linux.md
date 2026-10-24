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
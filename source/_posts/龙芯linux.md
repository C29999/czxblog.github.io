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

```  c++
man ls //manual手册 `man ls` 的意思：查看 ls 命令的使用方法
例如还有
man cd //manual手册 `man cd` 的意思：查看 cd 命令的使用方法
man mkdir //manual手册 `man mkdir` 的意思：查看 mkdir 命令的使用方法
man rm //manual手册 `man rm` 的意思：查看 rm 命令的使用方法
```
``` bash

ls -l //查看当前目录下的文件和目录，显示详细信息
seekfree@seekfree:~/Desktop$ ls -l
总计 48
-rw-rw-r-- 1 seekfree seekfree    58  1月 30  2026 使用gitee拉取开源库.txt
-rw-rw-r-- 1 seekfree seekfree    41  1月  6  2026 用户密码.txt
-rw-rw-r-- 1 seekfree seekfree 39744  9月  5 16:33 install.sh
```

每一行开头的 `-rw-rw-r--` 就是文件类型和权限位，拆开看：

![ls -l 权限位解读](/images/linux-ls-l-permission.png)

- **第一个字符 `-`**：普通文件（`d` 表示目录，`l` 表示链接）
- **后面 9 位分三组**：`rw-`（属主）、`rw-`（同组用户）、`r--`（其他人），分别表示可读（r）、可写（w）、可执行（x），`-` 表示没有该权限

---
title: FRTOS学习
date : 2025-10-29 12:00:00
description : FRTOS
categories: 关于我
top_img : https://cdn.jsdelivr.net/gh/C29999/P.bed/0832c767e6558a3be965a14286e016f3.png
cover : https://cdn.jsdelivr.net/gh/C29999/P.bed/0832c767e6558a3be965a14286e016f3.png
tags : FRTOS
---

## 什么是FRTOS？

将FRTOS想象成一个超级高效的"任务管家"，它核心的工作就是让你的单片机能够同时“一心多用”，通过任务调度、消息队列、信号量等机制，来合理地安排多个任务（比如同时读取传感器、刷新屏幕、进行网络通信）的执行顺序和时间，确保那些最紧急的任务能得到优先处理，从而让你的嵌入式项目运行得更可靠、更有序。


***FRTOS实现任务跳转，只会执行主函数前半部分，后面只会执行RTOS中的任务***

## FRTOS基础

### 什么是任务栈

>什么是栈？
栈就是单片机RAM里面一段连续的内存空间，大小一般在启动文件里面或者连接脚本里面定义，通过外在的调用初始化
>
>>什么是任务栈？
>>在江湖中、各路豪杰英雌距地分割。每个人都有自己的地盘。那我内部的吃喝开销不是我自己负责？
同样，栈也是一个个独立的，每个栈都有自己的独立栈空间，只是这个栈空间需要提前定义好，就是一个全局数组

``` C++
/*定义任务栈的大小*/
#define TASK1_STACK_SIZE 128
StackType_t Task1Stack[TASK1_STACK_SIZE];

#define TASK2_STACK_SIZE 128
StackType_t Task2Stack[TASK2_STACK_SIZE];

#define TASK3_STACK_SIZE 128
StackType_t Task3Stack[TASK3_STACK_SIZE];
```

### 任务函数

任务函数是一个独立的线程，一个完整的嵌入式应用，就是由多个这样的任务函数所组成的

任务函数有两个关键特征：

***1.永不返回：通常，任务函数内部是一个无限的循环（for(;;) 或 while(1)），使得这个任务能够持续运行，永远不会return。***

***必须具有特定的原型：它的返回值必须是 void，并且接受一个 void * 类型的参数。***

代码框架：

``` C++

void myTaskFunction(void *pvParameters) // 必须符合这个函数原型
{
    // 可选的初始化代码
    

    for(;;) // 无限循环，永不返回
    {
        // 任务的主体工作代码...
        
        
        // 通常需要调用一个延迟或阻塞函数，如 vTaskDelay(),
        // 以便将CPU控制权主动交还给调度器，让其他任务有机会运行。
        vTaskDelay(1000 / portTICK_PERIOD_MS); // 延迟1000毫秒
    }
    
    // 理论上，如果任务被删除，才会执行到这里。
    // 良好的习惯是在这里调用 vTaskDelete(NULL) 来清理任务。
    vTaskDelete(NULL);
}

```


任务函数和普通FRTOS的区别：

>**1.调用方式：**
。普通函数是通过程序中的显式调用来执行的，执行完后返回到调用点。
。FreeRTOS任务在创建后由操作系统调度器管理，并在特定条件下被运行，任务间的切换由操作系统完成。
**2.运行方式：**
。普通函数的执行是顺序且阻塞的。
。任务是非阻塞的，支持多任务并发。操作系统会根据任务优先级和时间片调度机制在不同任务之间切换。
**3.上下文管理：**
普通函数与调用点共享相同的堆栈和上下文。
每个任务有独立的堆栈空间和上下文信息，操作系统在任务切换时会保存和恢复这些信息。
>

> 任务函数就是你在FreeRTOS中为实现特定功能而写的“灵魂”，而之前你提供的“任务栈”则是这个灵魂运行时所必需的“身体和记忆空间”。调度器负责管理所有这些“灵魂”，让它们和谐地共享一个CPU。

### 什么是TCB？

>TCB可以把它想象成一个任务的 “身份证” 或 “个人档案”。

TCB 是一个数据结构（一个 struct），由 FreeRTOS 内核在创建任务时自动分配。它包含了管理和调度一个任务所需要的 所有信息。

>>TCB里面有什么？
任务状态：当前任务是就绪、运行、阻塞还是挂起状态。

任务优先级：决定了调度器先运行哪个任务。

栈指针：指向任务的栈顶（就是你之前代码里定义的 Task1Stack 等数组），用于记录任务运行时和切换时的上下文（如变量、返回地址等）。

任务入口函数指针：指向你写的那个任务函数，告诉内核这个任务要执行什么代码。

任务名：用于调试时识别任务。

事件列表：记录任务正在等待什么事件（比如信号量、消息队列等）。

其他用于链表、时间戳等的内核管理信息。

>>>TCB 是 FreeRTOS 用来代表一个任务的内核对象，是系统感知和管理任务的唯一依据。 你创建一个任务时，系统就会为它分配一个 TCB；删除一个任务时，就会释放它的 TCB

## 采用STM32F104(蓝桥杯开发板)＋ CUBEMX学习STM32

### CUBEMX中生成的FRTOS架构

``` C

  //用于开启任务调度，初始化调度器
  osKernelInitialize();  /* Call init function for freertos objects (in freertos.c) */


/*FRTOS.c的架构*/
//创建的两个任务
  defaultTaskHandle = osThreadNew(StartDefaultTask, NULL, &defaultTask_attributes);

  /* creation of myTask02 */
  myTask02Handle = osThreadNew(StartTask02, NULL, &myTask02_attributes);


  //osThreadNew(StartTask02, NULL, &myTask02_attributes);函数怎么用？

  osThreadNew (osThreadFunc_t func, void *argument, const osThreadAttr_t *attr)

  
   osThreadFunc_t func：任务函数 一个函数指针typedef void ，指向任务函数(*osThreadFunc_t) (void *argument);

    void *argument：传递给任务函数的参数
    const osThreadAttr_t *attr 设置任务属性，可以设置为空
    返回值：osThreadId_t任务的ID，通过任务的ID找到对应的ID

```

任务函数是一个死循环，因为任务需要一直保持运行
``` C++

void StartDefaultTask(void *argument)
{
  /* USER CODE BEGIN StartDefaultTask */
  /* Infinite loop */\
	
  for(;;)
  {
    osDelay(1);
  }
  /* USER CODE END StartDefaultTask */
}

  osDelay(10)//休眠函数，释放CPU资源

```

### 使用FRTOS实现串口发送


配置链接：[STM32CubeMX生成第一个freeRTOS工程](https://blog.csdn.net/LC_8575/article/details/142781687)
蓝桥杯嵌入式原理图：

![点亮一个LED](https://cdn.jsdelivr.net/gh/C29999/P.bed/ca3479b74e8483c35070d97aaec84e0e.png)


CUBEMX配置：![FRTOS第一次配置](https://cdn.jsdelivr.net/gh/C29999/P.bed/49d7f1793924dfb764077d8c76ae91af.png)


如果出现以下错误找不到头文件错误

  ![STM32错误](https://cdn.jsdelivr.net/gh/C29999/P.bed/7f5d087659d444bb7c7bb7ffe51ec0d6.png)

 那么多半是在FRTOS设置使用的新的库，我只需要把这一项关闭就行

   ![2](https://cdn.jsdelivr.net/gh/C29999/P.bed/7865b41b1e66147f547f971f5bcb83be.png)

``` C++

void StartDefaultTask(void *argument)
{
  /* USER CODE BEGIN StartDefaultTask */
  /* Infinite loop */\
	HAL_UART_Transmit(&huart1, (uint8_t *)"hello wi99ndows!\r\n", 16 , 0xffff);
  for(;;)
  {
    osDelay(50);
  }
  /* USER CODE END StartDefaultTask */
}
//直接在任务轮询里面添加即可

```

  ![STM](https://cdn.jsdelivr.net/gh/C29999/P.bed/4c8595b619fd56ac7f1c132be98fe50b.png)


   #### CUBEMX任务名介绍
   ![STM](https://cdn.jsdelivr.net/gh/C29999/P.bed/b37e8a422d73b1573121be1905237a8c.png)

  第二行Priority用来设置任务优先级
  第三行：任务栈大小
  第四行:任务的入口函数
  第六行：传递给任务函数的参数
  第七行：任务创建的方式

  ``` c++

typedef struct {
  const char                   *name;   ///< name of the thread
  uint32_t                 attr_bits;   ///< attribute bits
  void                      *cb_mem;    ///< memory for control block
  uint32_t                   cb_size;   ///< size of provided memory for control block
  void                   *stack_mem;    ///< memory for stack
  uint32_t                stack_size;   ///< size of stack
  osPriority_t              priority;   ///< initial thread priority (default: osPriorityNormal)
  TZ_ModuleId_t            tz_module;   ///< TrustZone module identifier
  uint32_t                  reserved;   ///< reserved (must be 0)
} osThreadAttr_t;

  ```

>使用osThreadNew函数传参
我们看到osThreadNew函数第二参数, 是传入任务函数的参数

实现功能:利用串口发送六次后停止

``` C++

  int c=6;
  defaultTaskHandle = osThreadNew(StartTask02, (void*)&c, &defaultTask_attributes);
void StartTask02(void *argument)
{
  /* USER CODE BEGIN StartTask02 */
  /* Infinite loop */
	int i=0;
	int* cnt =(int*)argument;
  for(;;)
  {
		for(i;i<*cnt;i++)
		{
			printf("hello world");
			printf("%d", i);
			osDelay(1000);
		}
    osDelay(1000);
  }
  /* USER CODE END StartTask02 */
}


```

### 任务优先级的使用

和中断不同的是FRTOS中的优先级越高,越先使用

### 任务的栈


#### 函数调用栈

每当一个函数被调用时，函数的返回地址，参数以及局部变量会被保持在栈上，函数执行完后，栈会恢复道调用之前的状态


### 创建任务

#### 动态创建任务与静态创建任务

动态和静态两种创建任务的方式这是在FreeRTOS 中创建任务的两种内存管理方式。

>动态创建任务：FreeRTOS 内核自动分配任务栈和 TCB 所需的内存
>> 优点不需要手动管理内存，适合任务数量不确定或频繁变化的情况。
缺点可能会生成内存碎片

>静态创建任务：用户手动分配内存，包括 TCB 和 栈空间
>>无内存碎片，适合内存受限系统
>>要手动管理内存

CUBEMX生成的动态底层代码:

``` C++

 (xTaskCreate ((TaskFunction_t)func, name, (uint16_t)stack, argument, prio, &hTask) != pdPASS)


BaseType_t xTaskCreate(	TaskFunction_t pxTaskCode,
							const char * const pcName,		/*lint !e971 Unqualified char types are allowed for strings and single characters only. */
							const configSTACK_DEPTH_TYPE usStackDepth,
							void * const pvParameters,
							UBaseType_t uxPriority,
							TaskHandle_t * const pxCreatedTask )

//(TaskFunction_t)func 任务函数指针
//const char * const pcName 任务名称
//const configSTACK_DEPTH_TYPE usStackDepth 任务栈大小
//void * const pvParameters 任务参数
//UBaseType_t uxPriority 任务优先级
//TaskHandle_t * const pxCreatedTask 任务句柄，通过任务句柄可以找到对应的任务
//BaseType_t 返回值，表示函数是否调用成功 成功返回pdPASS，失败返回pdFAIL

```
##### 如何动态创建任务函数

``` C++

TaskHandle_t MyTaskHandle;
xTaskCreate(StartMyTask, "MyTask", 256, (void*)&task_parameter, tskIDLE_PRIORITY + 2, &MyTaskHandle);

StartMyTask(void *pvParameters)
{
  for(;;)
  {

    osdelay();
  }
}
```

#### 静态创建任务

``` C++


StaticTask_t MyTaskTCB;
StackType_t MyTaskStack[256];

TaskHandle_t MyTaskHandle = xTaskCreateStatic(
    StartMyTask,           // 任务函数指针
    "MyTask",              // 任务名称  
    256,                   // 任务栈大小
    (void*)&task_parameter,// 任务参数
    tskIDLE_PRIORITY + 2,  // 任务优先级
    MyTaskStack,           // 栈缓冲区
    &MyTaskTCB             // TCB缓冲区
);

```

静态创建任务和动态创建任务的区别：
动态创建只需指定栈大小，系统自动分配内存；静态创建必须额外提供栈和任务控制块的具体内存地址，由开发者预先分配好所有内存空间。

### 如何实现任务轮询

FreeRTOS 通过 基于优先级的抢占式调度 实现任务轮询：调度器借助硬件定时器中断周期性地触发，检查所有任务状态，始终让 最高优先级的就绪任务 获得 CPU 使用权；每个任务必须 主动调用如 osDelay 等阻塞函数 来让出 CPU，从而保证同等优先级的任务能通过 时间片轮转 公平共享处理器，实现多任务的并发执行与平滑切换

>比喻：FreeRTOS 就像一个永不疲倦的超级指挥家，它手握一个精准的节拍器（系统心跳），指挥着整个乐队（多个任务）。每一位乐手（任务）都必须在演奏完自己的一个小节后，主动停下来（调用如 osDelay 这样的函数），把舞台让给指挥。指挥则遵循一条黄金法则：谁的任务更紧急、谁等得最久，就让谁接下来表演。通过这种方式，指挥家确保了所有乐手都能轮流上场，既不会有人一直霸占麦克风，也不会有人被彻底冷落，从而奏出一曲和谐流畅的多任务交响乐

### 任务调度算法

#### 抢占式任务调度

***抢占式任务调度***运行在任务执行期间，基于任务优先级动态抢占CPU资源，暂停当前任务并切换到其他任务，FROTS可以在任何时候根据任务优先级来决定哪个任务应当运行


抢占式任务调度实验：
``` C++

void StartDefaultTask(void *argument)
{
  /* USER CODE BEGIN StartDefaultTask */
  /* Infinite loop */\
	//HAL_UART_Transmit(&huart1, (uint8_t *)"hello wi99ndows!\r\n", 16 , 0xffff);
  for(;;)
  {
    printf("text\n\r");
    myTask02Handle = osThreadNew(StartTask02, NULL, &myTask02_attributes);
    printf("11212\n\r");
    osDelay(2000);
  }
  /* USER CODE END StartDefaultTask */
}

/* USER CODE BEGIN Header_StartTask02 */
/**
* @brief Function implementing the myTask02 thread.
* @param argument: Not used
* @retval None
*/
/* USER CODE END Header_StartTask02 */
void StartTask02(void *argument)
{
  /* USER CODE BEGIN StartTask02 */
  /* Infinite loop */
	int i=0;
	int* cnt =(int*)argument;
  for(;;)
  {
		printf("hello world\n\r");
	  osDelay(2000);
  }
  /* USER CODE END StartTask02 */
}
```


#### 关于FreeRTOSConfig.h

FreeRTOSConfig.h文件是FreeRTOS的配置文件，它允许用户根据具体的应用需求来定制和优化FreeRTOS的运行时行为。

``` C++

 /* 调度模式配置 */
#define configUSE_PREEMPTION                     1       /* 1=启用抢占式调度，0=协作式调度 */

/* 内存分配方式配置 */
#define configSUPPORT_STATIC_ALLOCATION          1       /* 1=支持静态内存分配（用户提供内存） */
#define configSUPPORT_DYNAMIC_ALLOCATION         1       /* 1=支持动态内存分配（系统自动分配） */

/* 钩子函数配置 */
#define configUSE_IDLE_HOOK                      0       /* 1=启用空闲任务钩子函数，0=禁用 */
#define configUSE_TICK_HOOK                      0       /* 1=启用系统心跳钩子函数，0=禁用 */

/* 系统时钟配置 */
#define configCPU_CLOCK_HZ                       ( SystemCoreClock )  /* CPU时钟频率，通常等于系统核心时钟 */
#define configTICK_RATE_HZ                       ((TickType_t)1000)   /* 系统心跳频率=1000Hz，即1个tick=1ms */

/* 任务系统配置 */
#define configMAX_PRIORITIES                     (56)    /* 最大优先级数量，范围1-255 */
#define configMINIMAL_STACK_SIZE                 ((uint16_t)128)      /* 空闲任务的最小栈大小（字） */
#define configTOTAL_HEAP_SIZE                    ((size_t)3072)       /* 动态内存分配的总堆大小=3KB */
#define configMAX_TASK_NAME_LEN                  ( 16 )  /* 任务名称最大长度 */

/* 调试和跟踪配置 */
#define configUSE_TRACE_FACILITY                 1       /* 1=启用可视化跟踪调试功能 */

/* 时间系统配置 */
#define configUSE_16_BIT_TICKS                   0       /* 0=使用32位tick计数器，1=使用16位（已过时） */

/* 内核对象配置 */
#define configUSE_MUTEXES                        1       /* 1=启用互斥锁功能 */
#define configQUEUE_REGISTRY_SIZE                8       /* 队列注册表大小，用于调试 */
#define configUSE_RECURSIVE_MUTEXES              1       /* 1=启用递归互斥锁 */
#define configUSE_COUNTING_SEMAPHORES            1       /* 1=启用计数信号量 */

/* 任务选择优化 */
#define configUSE_PORT_OPTIMISED_TASK_SELECTION  0       /* 1=使用端口优化的任务选择（依赖硬件），0=通用C代码 */

```


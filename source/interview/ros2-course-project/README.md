# ROS 2 实操课程源码：从第一条消息到激光导航

目标环境：**Ubuntu 24.04 Noble + ROS 2 Jazzy + Gazebo Harmonic**。这是两个可构建的 ROS 2 源码包及配套参数、世界、启动文件和验收流程。它把“消息通信 → 机器人模型 → 差速运动 → 传感器 → 建图 → 定位 → 导航”接成一条可实践的路线。

**验证状态：源码在 Windows 环境编写，目前仅做 XML、YAML、Python 语法和接口一致性静态检查；没有在 ROS 2/Gazebo 中编译、启动或测量过，不宣称已运行成功。** 下文“应看到”的内容都是运行验收目标。真实地图、rosbag 和录像必须由你执行后产生，项目不附带伪造结果。

## 1. 先理解各部分怎样接力

把机器人想成一位在陌生教室送资料的同学：URDF 是身体结构图；Gazebo 是可碰撞的练习教室；激光像伸出去量距离的一圈尺子；里程计像默数自己走了多少步；SLAM 是边走边画地图；AMCL 是拿着已有地图猜自己站在哪里；Nav2 是决定怎么走的领路员；差速控制器把“向前走、向左转”翻译成左右轮转速。

```text
teleop 或 Nav2
  /cmd_vel [Twist]
       ↓ twist_stamper（每来一条消息打一次仿真时间戳）
  /diff_drive_controller/cmd_vel [TwistStamped]
       ↓ diff_drive_controller
  左右轮 velocity 接口 → gz_ros2_control → Gazebo 物理世界
       ↑ position / velocity 反馈
       ├─ /odom + odom → base_footprint
       └─ joint_state_broadcaster → /joint_states

Gazebo /scan、/imu、/clock → ros_gz_bridge → ROS /scan、/imu/data、/clock
robot_state_publisher + /joint_states → 身体内部各段 TF
SLAM 或 AMCL（一次只开一个）→ map → odom
```

本例的 IMU 用于观察与录制，**没有接入 EKF 融合**。里程计完全来自轮关节反馈；`open_loop: false` 表示不拿发出去的速度指令冒充反馈。Nav2 的输入接口、坐标系和传感器参数已针对这个模型配置，但运动稳定性与导航参数仍需在目标机器实测。

## 2. 源码目录与阅读顺序

```text
ros2-course-project/
├─ src/course_cpp/
│  ├─ package.xml、CMakeLists.txt
│  ├─ src/talker.cpp、src/listener.cpp
│  └─ launch/demo.launch.py
├─ src/course_bot/
│  ├─ package.xml、CMakeLists.txt
│  ├─ src/twist_stamper.cpp
│  ├─ urdf/course_bot.urdf.xacro
│  ├─ worlds/classroom.sdf
│  ├─ config/controllers.yaml、bridge.yaml、slam.yaml、nav2.yaml、bag_qos.yaml
│  ├─ launch/sim.launch.py、rviz.launch.py、slam.launch.py、navigation.launch.py
│  └─ rviz/course.rviz
├─ tools/validate_static.py
├─ evidence/README.md、ACCEPTANCE_TEMPLATE.md
└─ README.md
```

先看 C++ talker/listener，再读 `controllers.yaml` 与 `course_bot.urdf.xacro` 的轮半径/轮距，之后沿启动文件阅读。`navigation.launch.py` 只启动本课程所需的 Nav2 核心官方节点，明确管理它们的生命周期；没有把与本项目无关的对接充电、路线图服务器等功能一起启动。

## 3. 安装 Ubuntu / ROS / 仿真依赖

所有 Bash 命令都在 **Ubuntu 24.04 的终端**执行，不是在 Windows PowerShell 执行。优先使用有正常图形驱动的原生 Ubuntu；WSL2/虚拟机需先确认 Gazebo 的 OpenGL/EGL 可用。初学者不要同时安装 Gazebo Classic 插件和 Harmonic 插件后混用。

先检查环境：

```bash
cat /etc/os-release
uname -m
locale
```

`VERSION_CODENAME` 应为 `noble`，支持的常见架构为 `x86_64`/`aarch64`。已有正确的 Jazzy 安装可跳过下面的仓库设置。新系统按 ROS 官方 deb 安装路线设置：

```bash
sudo apt update
sudo apt install -y locales software-properties-common curl python3
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8
sudo add-apt-repository universe

course_apt_version=$(curl -fsSL https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest | python3 -c 'import json,sys; print(json.load(sys.stdin)["tag_name"])')
curl -fL -o /tmp/course-ros2-apt-source.deb "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${course_apt_version}/ros2-apt-source_${course_apt_version}.noble_all.deb"
sudo dpkg -i /tmp/course-ros2-apt-source.deb
sudo apt update
sudo apt install -y ros-jazzy-desktop ros-dev-tools
sudo apt install -y ros-jazzy-ros-gz ros-jazzy-gz-ros2-control \
  ros-jazzy-ros2-controllers ros-jazzy-xacro \
  ros-jazzy-slam-toolbox ros-jazzy-navigation2 ros-jazzy-nav2-bringup \
  ros-jazzy-teleop-twist-keyboard ros-jazzy-rosbag2-storage-mcap \
  python3-yaml liburdfdom-tools
source /opt/ros/jazzy/setup.bash
```

若网络无法访问 GitHub release，应先按文末官方安装文档解决软件源问题，不要忽略失败继续执行安装。`ros-jazzy-ros-gz` 使用 Jazzy 对应的 Gazebo 配套发行版本；不要自行混入 Rolling、Kilted 或 Gazebo Classic 的教程命令。

## 4. 创建工作区并编译

将下载解压后的 `ros2-course-project` **整个文件夹复制或重命名为 `~/course_ws`**，使 `~/course_ws/src/course_cpp/package.xml` 确实存在。不要再套一层 `src/ros2-course-project/src`。以下约定工作区位置为 `~/course_ws`，路径尽量不含空格。

```bash
cd ~/course_ws
source /opt/ros/jazzy/setup.bash
mkdir -p evidence/logs evidence/bags evidence/videos evidence/screenshots maps
test -f /etc/ros/rosdep/sources.list.d/20-default.list || sudo rosdep init
rosdep update
rosdep install --from-paths src --ignore-src -r -y --rosdistro jazzy
python3 tools/validate_static.py
set -o pipefail
colcon build --symlink-install --event-handlers console_direct+ 2>&1 | tee evidence/logs/build.txt
source install/setup.bash
ros2 pkg executables course_cpp
ros2 pkg executables course_bot
```

预期发现 `course_cpp talker`、`course_cpp listener`、`course_bot twist_stamper`。`rosdep` 负责系统依赖，`colcon` 负责构建工作区，`source install/setup.bash` 才让当前终端认识刚编译的包：就像先安装厨房设备，再做好菜，最后把菜单交给服务员。每次打开新终端都执行：

```bash
source /opt/ros/jazzy/setup.bash
source ~/course_ws/install/setup.bash
```

在 Ubuntu 进一步展开并检查机器人模型：

```bash
ros2 run xacro xacro ~/course_ws/src/course_bot/urdf/course_bot.urdf.xacro > /tmp/course_bot.urdf
check_urdf /tmp/course_bot.urdf
gz sdf -p /tmp/course_bot.urdf > /tmp/course_bot.sdf
```

`validate_static.py` 不会假装导入 ROS，它只检查可在普通 Python 中验证的结构。`check_urdf`/`gz sdf` 也不能证明物理与导航正确；它们帮助把问题分层定位。

## 5. 第一课：自己编译的 C++ 节点通信

```bash
ros2 launch course_cpp demo.launch.py
```

另一终端执行：

```bash
ros2 topic list -t
ros2 topic info /chatter -v
ros2 topic echo /chatter
ros2 topic hz /chatter
```

目标：每约 0.5 秒收到一个递增序号，频率约 2 Hz。`create_publisher` 像申请一个广播频道，`create_subscription` 像把收音机调到同一频道；频道名相同仍不够，消息类型也必须相同。队列深度 10 是接收不过来时的缓冲容量，不是“只发十次”。`spin` 让执行器持续处理回调，否则程序建好订阅后马上结束，就像收音机插上电又立刻拔掉。

按 Ctrl+C 停止 launch，再分别启动可以看清通信双方：

```bash
ros2 run course_cpp talker --ros-args -p prefix:="My first robot"
```

另一个终端执行 `ros2 run course_cpp listener`。`prefix` 在构造函数里读取一次，本例没有动态参数回调；运行中用 `ros2 param set` 更改参数值，不代表已缓存的 `prefix_` 会自动刷新。尝试把 talker 重映射为 `--ros-args -r chatter:=robot_news`，listener 也需要同样重映射才能重新收到数据。

## 6. 启动机器人与物理世界

```bash
ros2 launch course_bot sim.launch.py
```

默认打开 Gazebo 和 RViz。模型从教室中央上方 2 cm 生成并落地；世界有四面墙和两个障碍物，不依赖联网下载模型。启动先生成机器人，再激活 `joint_state_broadcaster`，成功后激活 `diff_drive_controller`，关键进程失败会停止本次启动。控制器管理器由 Gazebo 插件创建，**不要另外启动一份 `ros2_control_node`**。

仅启动仿真而不打开 RViz：`ros2 launch course_bot sim.launch.py rviz:=false`。无 GUI 模式：`ros2 launch course_bot sim.launch.py gui:=false rviz:=false`，这会启用服务器模式和 headless rendering；GPU 激光仍需要能工作的 EGL/渲染环境，无 GUI 不等于无需显卡驱动。

另一个终端依次观察：

```bash
ros2 control list_controllers
ros2 control list_hardware_interfaces
ros2 topic echo /clock --once
ros2 topic hz /scan
```

`hz` 持续运行，记录后 Ctrl+C，再运行下一项：

```bash
ros2 topic echo /scan --once --field header
ros2 topic hz /imu/data
ros2 topic echo /imu/data --once --field header
ros2 topic hz /odom
ros2 run tf2_ros tf2_echo odom base_footprint
```

预期两个控制器均 `active`，轮关节 velocity 接口被占用；激光目标频率 10 Hz、IMU 50 Hz、里程计 50 Hz。实际速率受仿真实时因子影响。激光 frame 为 `laser_link`，IMU 为 `imu_link`。RViz 初始固定坐标系为 `odom`，此时尚无 `/map`，Map 显示未收到地图属于预期。

## 7. 用键盘控制，理解差速运动

```bash
ros2 run teleop_twist_keyboard teleop_twist_keyboard --ros-args \
  -p speed:=0.15 -p turn:=0.5
```

保持键盘焦点在该终端，按提示使用 `i` 前进、`j` 左转、`l` 右转、`k` 停止，Ctrl+C 退出。Jazzy 版按键节点收到按键才发布，连续运动需按住运动键并启用系统按键重复；轻按一次后会因命令超时停车。它没有 ROS 1 教程里常见的 `repeat_rate`/`key_timeout` 参数，不要添加它们并误以为已生效。键盘发布普通 `Twist`；适配器使用 `/clock` 产生时间戳后发给 Jazzy 差速控制器。适配器不会在没有新消息时反复重发旧速度，控制器的 `cmd_vel_timeout: 0.5` 因而仍能检测断流。超时之后还有加速度限制导致的减速过程，不能把 0.5 秒直接说成已测停车时间。

两轮像两个人抬担架：同速向前是直行，一人快一人慢是转弯。设线速度 `v`、角速度 `ω`、轮距 `b=0.34 m`、半径 `r=0.065 m`：

```text
左轮角速度 = (v − ωb/2) / r
右轮角速度 = (v + ωb/2) / r
```

例如 `v=0.2 m/s, ω=0` 时两轮都约为 `3.08 rad/s`；左转应右轮更快。控制器限制线速度在 `[-0.2, 0.35] m/s`、角速度在 `[-1.2, 1.2] rad/s`。这些是教学仿真配置，不是实车安全认证参数。

现在检查 `ros2 topic echo /odom`：直行时位置应变化，转向时姿态应变化。轮速有变化而车不走，先查轮子与地面的接触、仿真是否暂停、轮径/关节轴/摩擦，而不要先修改 SLAM 参数。

## 8. 建图：边走边画自己的教室地图

保持仿真运行，另一个终端：

```bash
ros2 launch course_bot slam.launch.py
```

在已有 RViz 的 Global Options 中把 Fixed Frame 改成 `map`。也可关闭旧 RViz 后单独执行 `ros2 launch course_bot rviz.launch.py fixed_frame:=map`。慢速遥控绕过两个障碍，尽量看遍教室墙面，再回到起点附近形成闭环。SLAM 像用许多张相互重叠的照片拼全景：移动太快、视野重复不足，就更难把相邻片段对齐。

观察 `/map` 是否扩展、墙线是否清晰。激光一圈圈散开可能是 TF/时间戳问题，墙面长期双影可能与里程计误差或扫描匹配有关。先用 `ros2 run tf2_ros tf2_echo map base_footprint` 确认 TF 连通，再讨论算法调参。

保存地图（先确保工作区 `maps` 目录存在）：

```bash
mkdir -p ~/course_ws/maps
ros2 run nav2_map_server map_saver_cli -f "$HOME/course_ws/maps/classroom" \
  --ros-args -p use_sim_time:=true -p save_map_timeout:=10.0
ls -l ~/course_ws/maps/classroom.*
```

目标产物为 `classroom.yaml` 和地图图像（通常 `classroom.pgm`）。YAML 保存分辨率、原点、占据阈值与图像路径，图像保存栅格内容；二者像“地图和比例尺说明书”，缺一不可。这个栅格地图用于 AMCL，不包含完整 SLAM 位姿图；若要下次继续优化同一个 SLAM 图，还需另学 slam_toolbox 的序列化服务。

本项目不提供预先声称由 SLAM 生成的地图。第一次导航必须先完成此步骤，并检查实际地图不是空白。

## 9. 已知地图定位与 Nav2 导航

先停止键盘遥控，再在运行 `slam.launch.py` 的终端 Ctrl+C。**保留仿真，停止 SLAM 后再启动 AMCL**，避免两个节点争着发布 `map → odom`。可用 `ros2 node list` 确认没有 `slam_toolbox`。

```bash
ros2 launch course_bot navigation.launch.py map:="$HOME/course_ws/maps/classroom.yaml"
```

地图路径为必填项，启动文件会检查 YAML 与其引用的图像是否存在。RViz 固定坐标系为 `map`；使用 **2D Pose Estimate** 在地图上标出机器人当前大概位置，拖动箭头指定朝向。若仿真刚重启，小车在世界原点；地图原点不一定是图像左下角的机器人起点，需结合地图特征确认。若一直保留仿真，则初始化到当前实际位置，而不是无条件点 `(0,0)`。

初始位姿像告诉导航软件“我大概在这个路口”。AMCL 用激光与地图不断修正估计。初始位姿未提供时，Nav2 可能等待 `map → odom`，并非必须重装软件。确认激光点与地图墙面对齐后，再按 **Nav2 Goal** 在已探索的空白区域选点、拖动箭头指定终点朝向。不要把目标点在障碍上、膨胀带里或未知灰色区域。

可以用 action 命令留下明确的反馈与结果（下面 `(3,-2)` 只是本世界的候选自由点，必须先确认已被你的地图探索且路径可达）：

```bash
ros2 lifecycle get /amcl
ros2 lifecycle get /controller_server
ros2 action list -t
set -o pipefail
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: 3.0, y: -2.0, z: 0.0}, orientation: {w: 1.0}}}}" \
  --feedback 2>&1 | tee ~/course_ws/evidence/logs/navigation-goal-01.txt
```

机器人应先生成全局路径，再由 DWB 在短期预测轨迹中挑选可行速度，逐步到达目标。像远途出行：全局规划确定“走哪几条街”，局部控制解决“眼前怎么绕开椅子”。不要仅凭 RViz 画出路径就宣布导航成功，记录 action 结果、终点误差及碰撞情况。

此时不要同时开键盘遥控：本最小课程没有做多源速度仲裁，遥控和导航同时发布 `/cmd_vel` 会抢控制权。需要人工接管时先在 RViz 取消目标并停止导航节点，再启动遥控。本课程只用于仿真。

## 10. 记录 rosbag、录制视频、回放

先建立目录，在建图或导航启动后打开单独的录制终端：

```bash
cd ~/course_ws
course_run_id=$(date +%Y%m%d_%H%M%S)
ros2 bag record --use-sim-time -s mcap \
  --qos-profile-overrides-path src/course_bot/config/bag_qos.yaml \
  -o "evidence/bags/run_${course_run_id}" \
  /clock /tf /tf_static /robot_description /joint_states /scan /imu/data \
  /odom /cmd_vel /diff_drive_controller/cmd_vel /map /plan /amcl_pose \
  /navigate_to_pose/_action/status
```

录制完成按 Ctrl+C，替换下面路径为实际生成目录：

```bash
ros2 bag info ~/course_ws/evidence/bags/run_实际日期时间
```

`/tf_static` 和 `/map` 使用持久性配置，避免录制晚启动时漏掉静态 TF/地图。`.mcap` 是消息时间序列，不是 mp4 视频；它记录“机器人说了什么”，桌面录屏记录“你看到了什么”，两种证据应分别保存。

录像可用 Ubuntu GNOME 的 **Print Screen → 录制屏幕**，或 OBS。建议分别录制一段从运动到闭环保存的建图过程，以及一次定位、选目标、绕障到达的导航过程。保留 Gazebo、RViz 与终端结果画面，把真实录制文件放到 `evidence/videos/`。不要用网页动画替代仿真录像。

回放时先关闭 Gazebo、SLAM、Nav2、遥控和适配器，避免两个时钟与重复 TF。新终端加载 ROS 工作区后：

```bash
ros2 bag play ~/course_ws/evidence/bags/run_实际日期时间 --topics \
  /clock /tf /tf_static /robot_description /joint_states /scan /imu/data \
  /odom /map /plan /amcl_pose
```

另一个终端运行 `ros2 launch course_bot rviz.launch.py fixed_frame:=map`。这里直接重放已录制的 `/clock`，**不再附加 `--clock` 生成第二份时钟**；显式排除两个速度命令主题，避免误把旧控制消息送往仍连接的设备。仅回放状态并不等同重新执行一次算法；需要重新评估算法时，应单独设计输入输出与 TF 所有权。

## 11. 故障排查：按信号经过的顺序查

| 表现 | 先检查什么 | 可执行的检查 |
|---|---|---|
| 找不到包/可执行文件 | 新终端没有加载工作区；目录套层错误 | `ros2 pkg prefix course_bot`、`find ~/course_ws/src -name package.xml` |
| 控制器不 active | 插件是否加载、轮关节名是否一致、Gazebo是否运行 | `ros2 control list_controllers`、`ros2 control list_hardware_interfaces`，阅读首次错误 |
| 有速度主题但不动 | Twist/TwistStamped、适配器、时间戳、超时 | `ros2 topic info /cmd_vel -v` 与 `ros2 topic info /diff_drive_controller/cmd_vel -v` |
| 所有运动/算法都停住 | Gazebo暂停或/clock未桥接 | `ros2 topic echo /clock --once`，确认仿真播放按钮 |
| 有Gazebo画面但无激光 | Sensors系统/渲染环境/桥接/QoS | `gz topic -l`、`ros2 topic info /scan -v`；RViz设Best Effort |
| 激光TF报错 | frame_id与URDF link名不一致、缺少TF | `ros2 topic echo /scan --once --field header`、`ros2 run tf2_ros tf2_echo base_footprint laser_link` |
| TF extrapolation报错 | 墙钟与仿真时间混用 | `ros2 param get /robot_state_publisher use_sim_time`、检查各算法同样为true |
| map→odom抖动跳变 | SLAM与AMCL同时启动或初始位姿错误 | `ros2 node list`；仅保留一种定位来源 |
| Nav2启动后一直等待 | 未用2D Pose Estimate初始化或地图没读到 | 先检查/map，再检查`map → base_footprint`，再看生命周期 |
| No valid path/Failed to make progress | 目标在未知/占据区域，半径/膨胀不合适或模型卡住 | RViz看全局/局部代价地图和实际小车，先选近处空地 |
| 车轮转而车体打滑/翻倒 | 接触、惯量、轮径、轮距、摩擦 | 先以0.1 m/s低速验证模型，不用改规划器掩盖物理问题 |
| GUI黑屏/崩溃 | OpenGL、虚拟机3D加速、WSL驱动 | 检查Gazebo日志及`glxinfo -B`；headless模式也要EGL支持 |
| 地图保存超时 | /map未发布、仿真暂停、节点QoS/时间 | `ros2 topic info /map -v`，确认RViz已有地图再保存 |

坐标树必须是：`map → odom → base_footprint → base_link → laser_link/imu_link/左右轮`。`map → odom` 由 SLAM 或 AMCL 负责；`odom → base_footprint` 由差速控制器负责；身体内部 TF 由 robot_state_publisher 负责。同一条边多个发布者，像两个导航同时争着重画当前位置，结果容易跳动。

## 12. 保存版本与填写验收

在工作区运行并保留原始输出：

```bash
cd ~/course_ws
{
  date -Iseconds
  cat /etc/os-release
  uname -a
  printenv ROS_DISTRO
  gz sim --versions
  dpkg-query -W 'ros-jazzy-*'
} > evidence/logs/environment.txt
ros2 control list_controllers > evidence/logs/controllers.txt
ros2 control list_hardware_interfaces >> evidence/logs/controllers.txt
cp evidence/ACCEPTANCE_TEMPLATE.md "evidence/acceptance_$(date +%Y%m%d).md"
```

先验收通信，再验收物理与传感器，再验收建图，最后验收至少三个导航目标。每一步填实际频率、错误日志、目标坐标和结果，不把预计值当测量值。遇到失败，保留失败记录也有价值：它使后续改动可以复现、比较。

## 13. 官方兼容性依据与范围

编写时核对的是维护方 **Jazzy 分支**与 Gazebo 8/Harmonic 的接口，核对日期 2026-11-12；发行包会更新，运行时请同时保存实际 deb 版本。下列链接用于复查 API，不代表已在你的机器验证通过：

- [ROS 2 Jazzy Ubuntu deb安装](https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html)
- [Jazzy与Gazebo配套说明](https://gazebosim.org/docs/harmonic/ros_installation/)
- [gz_ros2_control Jazzy差速模型示例](https://github.com/ros-controls/gz_ros2_control/blob/jazzy/gz_ros2_control_demos/urdf/test_diff_drive.xacro.urdf)：硬件插件名、Gazebo插件名、parameters加载方式。
- [diff_drive_controller Jazzy实现](https://github.com/ros-controls/ros2_controllers/blob/jazzy/diff_drive_controller/src/diff_drive_controller.cpp)：`~/cmd_vel` 接收 `TwistStamped`，`~/odom` 输出里程计，命令超时处理。
- [diff_drive_controller参数](https://github.com/ros-controls/ros2_controllers/blob/jazzy/diff_drive_controller/src/diff_drive_controller_parameter.yaml)：轮半径、轮距、速度/加速度与TF参数。部分新版本会对 `has_*_limits` 输出弃用提示，数值上限仍是实际限制；本项目保留布尔项以兼容较早Jazzy包。
- [ros_gz_sim启动模板](https://github.com/gazebosim/ros_gz/blob/jazzy/ros_gz_sim/launch/gz_sim.launch.py.in)：安装后为 `gz_sim.launch.py`，使用 `gz_args` 与 `on_exit_shutdown`。
- [ros_gz_bridge配置解析](https://github.com/gazebosim/ros_gz/blob/jazzy/ros_gz_bridge/src/bridge_config.cpp)：方向与 `SENSOR_DATA` QoS。
- [Gazebo Sensors 8 Sensor实现](https://github.com/gazebosim/gz-sensors/blob/gz-sensors8/src/Sensor.cc)：`gz_frame_id` 设置 ROS 消息使用的传感器坐标系。
- [slam_toolbox Jazzy启动](https://github.com/SteveMacenski/slam_toolbox/blob/jazzy/launch/online_async_launch.py)与[参数](https://github.com/SteveMacenski/slam_toolbox/blob/jazzy/config/mapper_params_online_async.yaml)：异步建图及生命周期自动启动。
- [Nav2 Jazzy默认参数](https://github.com/ros-navigation/navigation2/blob/jazzy/nav2_bringup/params/nav2_params.yaml)与[TwistPublisher](https://github.com/ros-navigation/navigation2/blob/jazzy/nav2_util/include/nav2_util/twist_publisher.hpp)：插件类型及 `enable_stamped_cmd_vel` 的接口选择。
- [teleop_twist_keyboard Jazzy源码](https://github.com/ros2/teleop_twist_keyboard/blob/jazzy/teleop_twist_keyboard.py)：按键发布逻辑与可用参数；[RViz Jazzy启动选项](https://github.com/ros2/rviz/blob/jazzy/rviz_common/src/rviz_common/visualizer_app.cpp)：`-d` 配置文件和 `-f` 固定坐标系。

本项目聚焦单机器人、二维平地、激光静态地图导航。没有接入真实电机、硬件急停、EKF、视觉SLAM、多机器人、动态障碍专项评测，也没有把“能解析配置”写成“已完成仿真验收”。先完成本例的真实记录，再逐项增加功能，才能知道每次改动带来了什么。

# 静态核验记录

核验日期：2026-11-12。环境：Windows，Python 3.13，PyYAML；无 ROS 2 Jazzy、Gazebo Harmonic 运行环境。

实际执行：

```text
python tools/validate_static.py
Static validation PASS: {'xml': 4, 'yaml': 6, 'python': 6}; wheel geometry, topics and frame contracts consistent.
Not tested here: ROS imports, C++ compilation, xacro expansion, Gazebo physics, SLAM or navigation.
```

检查范围：两个 package.xml、URDF/xacro 与 SDF 的 XML 结构；5 个 YAML 配置和 RViz YAML 的语法及重复键；5 个 launch 和验证脚本的 Python AST；控制器与模型的轮半径、轮距、关节名；TF 主体名称；桥接方向与主题；Nav2 Twist 接口选择；两个包的构建入口存在。

另已人工对照维护方 Jazzy 分支，核对 gz_ros2_control 插件名、差速控制器 TwistStamped 输入、Gazebo 启动参数、传感器 frame_id、桥接 QoS、slam_toolbox 启动和 Nav2 参数类型。teleop 参数按 Jazzy 源码修正，不使用它未声明的 repeat_rate/key_timeout。

未执行：rosdep 解析安装、ament/colcon 编译、C++ 头文件/链接检查、ROS launch 导入执行、xacro 展开、URDF 转 SDF、Gazebo 插件加载和接触物理、传感器实测频率、SLAM 建图、AMCL 定位、Nav2 运动、rosbag 录制/回放、桌面录像。请按 README 在 Ubuntu 执行并填写 evidence/ACCEPTANCE_TEMPLATE.md；这里的 PASS 仅代表上述静态范围。

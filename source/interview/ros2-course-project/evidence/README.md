# 真实运行证据存放处

本目录目前只有说明和空白记录模板，**没有实机或仿真运行数据，没有录像，没有导航成功率结果**。项目编写环境为 Windows，无 ROS 2 Jazzy 运行时；静态检查不等于运行验收。

在 Ubuntu 工作区根目录执行 `mkdir -p evidence/bags evidence/videos evidence/screenshots evidence/logs maps`。建议按下列命名归档：

- `logs/environment.txt`：系统、ROS、Gazebo、包版本、显卡信息。
- `logs/build.txt`：真实 `colcon build` 输出。
- `logs/controllers.txt`：真实控制器与硬件接口列表。
- `logs/navigation-goal-01.txt`：导航 action 反馈和结果。
- `bags/mapping_日期时间/`：建图阶段 rosbag。
- `bags/navigation_日期时间/`：导航阶段 rosbag。
- `videos/mapping.webm`、`videos/navigation.webm`：桌面录屏，不是 rosbag。
- `screenshots/tf-tree.png`、`screenshots/map.png`：运行时截图。
- `acceptance-日期.md`：复制 `ACCEPTANCE_TEMPLATE.md` 后逐项填写。

地图保存到工作区 `maps/classroom.yaml` 和 `maps/classroom.pgm`。地图与地图 YAML 必须成对保存；移动到别处后检查 YAML 的 `image` 路径。不要把示意图或合成数据命名为实测结果。

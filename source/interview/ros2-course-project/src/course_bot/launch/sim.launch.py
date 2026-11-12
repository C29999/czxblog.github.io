from pathlib import Path

import xacro
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, EmitEvent, IncludeLaunchDescription, RegisterEventHandler
from launch.conditions import IfCondition
from launch.event_handlers import OnProcessExit
from launch.events import Shutdown
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PythonExpression
from launch_ros.actions import Node


def generate_launch_description():
    share = Path(get_package_share_directory('course_bot'))
    gz_share = Path(get_package_share_directory('ros_gz_sim'))
    robot_description = xacro.process_file(
        str(share / 'urdf' / 'course_bot.urdf.xacro'),
        mappings={'controllers_file': str(share / 'config' / 'controllers.yaml')},
    ).toxml()
    gui = LaunchConfiguration('gui')
    spawn = Node(
        package='ros_gz_sim', executable='create', output='screen',
        arguments=['-world', 'classroom', '-name', 'course_bot', '-topic',
                   'robot_description', '-x', '0', '-y', '0', '-z', '0.02'],
    )
    joint_spawner = Node(
        package='controller_manager', executable='spawner', output='screen',
        arguments=['joint_state_broadcaster', '--controller-manager', '/controller_manager',
                   '--controller-manager-timeout', '120'],
    )
    drive_spawner = Node(
        package='controller_manager', executable='spawner', output='screen',
        arguments=['diff_drive_controller', '--controller-manager', '/controller_manager',
                   '--controller-manager-timeout', '120'],
    )

    def after_spawn(event, context):
        if event.returncode != 0:
            return [EmitEvent(event=Shutdown(reason='Gazebo robot spawn failed'))]
        return [joint_spawner]

    def after_joints(event, context):
        if event.returncode != 0:
            return [EmitEvent(event=Shutdown(reason='Joint broadcaster failed'))]
        return [drive_spawner]

    def after_drive(event, context):
        if event.returncode != 0:
            return [EmitEvent(event=Shutdown(reason='Differential drive controller failed'))]
        return []

    return LaunchDescription([
        DeclareLaunchArgument('gui', default_value='true'),
        DeclareLaunchArgument('rviz', default_value='true'),
        RegisterEventHandler(OnProcessExit(target_action=spawn, on_exit=after_spawn)),
        RegisterEventHandler(OnProcessExit(target_action=joint_spawner, on_exit=after_joints)),
        RegisterEventHandler(OnProcessExit(target_action=drive_spawner, on_exit=after_drive)),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(str(gz_share / 'launch' / 'gz_sim.launch.py')),
            launch_arguments={
                'gz_args': [PythonExpression(["'-r ' if '", gui,
                                              "'.lower() == 'true' else '-r -s --headless-rendering '"]),
                            str(share / 'worlds' / 'classroom.sdf')],
                'on_exit_shutdown': 'true',
            }.items(),
        ),
        Node(package='robot_state_publisher', executable='robot_state_publisher',
             output='screen', parameters=[{'robot_description': robot_description, 'use_sim_time': True}]),
        Node(package='ros_gz_bridge', executable='parameter_bridge', output='screen',
             parameters=[{'config_file': str(share / 'config' / 'bridge.yaml'), 'use_sim_time': True}]),
        Node(package='course_bot', executable='twist_stamper', output='screen',
             parameters=[{'use_sim_time': True}]),
        spawn,
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(str(share / 'launch' / 'rviz.launch.py')),
            launch_arguments={'fixed_frame': 'odom'}.items(),
            condition=IfCondition(LaunchConfiguration('rviz')),
        ),
    ])

from pathlib import Path

import yaml
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def launch_navigation(context):
    share = Path(get_package_share_directory('course_bot'))
    map_file = Path(LaunchConfiguration('map').perform(context)).expanduser().resolve()
    if not map_file.is_file():
        raise RuntimeError(f'Map YAML does not exist: {map_file}. Save a SLAM map first.')
    map_data = yaml.safe_load(map_file.read_text(encoding='utf-8'))
    if not isinstance(map_data, dict) or not map_data.get('image'):
        raise RuntimeError('Map YAML must contain an image path from map_saver_cli.')
    image_file = Path(map_data['image'])
    if not image_file.is_absolute():
        image_file = map_file.parent / image_file
    if not image_file.is_file():
        raise RuntimeError(f'Map image does not exist: {image_file}')
    params = str(share / 'config' / 'nav2.yaml')
    specifications = [
        ('nav2_map_server', 'map_server', 'map_server'),
        ('nav2_amcl', 'amcl', 'amcl'),
        ('nav2_controller', 'controller_server', 'controller_server'),
        ('nav2_planner', 'planner_server', 'planner_server'),
        ('nav2_smoother', 'smoother_server', 'smoother_server'),
        ('nav2_behaviors', 'behavior_server', 'behavior_server'),
        ('nav2_bt_navigator', 'bt_navigator', 'bt_navigator'),
    ]
    nodes = []
    for package, executable, name in specifications:
        parameters = [params, {'use_sim_time': True}]
        if name == 'map_server':
            parameters.append({'yaml_filename': str(map_file)})
        nodes.append(Node(package=package, executable=executable, name=name,
                          output='screen', parameters=parameters))
    nodes.append(Node(
        package='nav2_lifecycle_manager', executable='lifecycle_manager',
        name='lifecycle_manager_course', output='screen',
        parameters=[{'use_sim_time': True, 'autostart': True,
                     'node_names': [entry[2] for entry in specifications]}],
    ))
    return nodes


def generate_launch_description():
    return LaunchDescription([
        DeclareLaunchArgument('map', description='Absolute path to the map YAML saved by map_saver_cli'),
        OpaqueFunction(function=launch_navigation),
    ])

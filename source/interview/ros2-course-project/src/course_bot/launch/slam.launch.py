from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource


def generate_launch_description():
    share = Path(get_package_share_directory('course_bot'))
    slam_share = Path(get_package_share_directory('slam_toolbox'))
    return LaunchDescription([
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(str(slam_share / 'launch' / 'online_async_launch.py')),
            launch_arguments={
                'use_sim_time': 'true',
                'slam_params_file': str(share / 'config' / 'slam.yaml'),
                'autostart': 'true',
                'use_lifecycle_manager': 'false',
            }.items(),
        ),
    ])

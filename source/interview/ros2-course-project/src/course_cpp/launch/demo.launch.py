from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(package='course_cpp', executable='talker', output='screen'),
        Node(package='course_cpp', executable='listener', output='screen'),
    ])

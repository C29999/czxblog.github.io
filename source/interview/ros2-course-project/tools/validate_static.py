import ast
import math
from pathlib import Path
import xml.etree.ElementTree as ET

import yaml


class UniqueKeyLoader(yaml.SafeLoader):
    pass


def unique_mapping(loader, node, deep=False):
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise ValueError(f'Duplicate YAML key: {key}')
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


UniqueKeyLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)
root = Path(__file__).resolve().parents[1]
counts = {'xml': 0, 'yaml': 0, 'python': 0}
for path in root.rglob('*'):
    if not path.is_file() or any(part in {'build', 'install', 'log', '__pycache__'} for part in path.parts):
        continue
    if path.suffix in {'.xml', '.xacro', '.sdf'}:
        ET.parse(path)
        counts['xml'] += 1
    elif path.suffix in {'.yaml', '.rviz'}:
        yaml.load(path.read_text(encoding='utf-8'), Loader=UniqueKeyLoader)
        counts['yaml'] += 1
    elif path.suffix == '.py':
        ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
        counts['python'] += 1

bot = root / 'src' / 'course_bot'
controllers = yaml.safe_load((bot / 'config' / 'controllers.yaml').read_text(encoding='utf-8'))
drive = controllers['diff_drive_controller']['ros__parameters']
robot = ET.parse(bot / 'urdf' / 'course_bot.urdf.xacro').getroot()
xacro_namespace = '{http://www.ros.org/wiki/xacro}'
radius = next(float(prop.attrib['value']) for prop in robot.findall(f'{xacro_namespace}property')
              if prop.attrib['name'] == 'wheel_radius')
positions = [float(wheel.attrib['position']) for wheel in robot.findall(f'{xacro_namespace}wheel')]
assert math.isclose(radius, drive['wheel_radius'])
assert math.isclose(abs(positions[0] - positions[1]), drive['wheel_separation'])
hardware_joints = {joint.attrib['name'] for joint in robot.findall('ros2_control/joint')}
assert hardware_joints == set(drive['left_wheel_names'] + drive['right_wheel_names'])
assert drive['base_frame_id'] == 'base_footprint' and drive['odom_frame_id'] == 'odom'
assert drive['cmd_vel_timeout'] > 0

bridges = yaml.safe_load((bot / 'config' / 'bridge.yaml').read_text(encoding='utf-8'))
assert {entry['ros_topic_name'] for entry in bridges} == {'/clock', '/scan', '/imu/data'}
assert all(entry['direction'] == 'GZ_TO_ROS' for entry in bridges)
nav = yaml.safe_load((bot / 'config' / 'nav2.yaml').read_text(encoding='utf-8'))
for name in ('controller_server', 'behavior_server'):
    assert nav[name]['ros__parameters']['enable_stamped_cmd_vel'] is False
assert nav['amcl']['ros__parameters']['base_frame_id'] == drive['base_frame_id']
for package in (root / 'src').iterdir():
    if package.is_dir():
        manifest = ET.parse(package / 'package.xml').getroot()
        assert manifest.findtext('name') == package.name
        assert (package / 'CMakeLists.txt').is_file()

print(f"Static validation PASS: {counts}; wheel geometry, topics and frame contracts consistent.")
print('Not tested here: ROS imports, C++ compilation, xacro expansion, Gazebo physics, SLAM or navigation.')

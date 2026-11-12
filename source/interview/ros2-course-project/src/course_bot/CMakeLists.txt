cmake_minimum_required(VERSION 3.8)
project(course_bot)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)

add_executable(twist_stamper src/twist_stamper.cpp)
ament_target_dependencies(twist_stamper rclcpp geometry_msgs)
target_compile_features(twist_stamper PUBLIC cxx_std_17)

install(TARGETS twist_stamper DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch config urdf worlds rviz DESTINATION share/${PROJECT_NAME})
ament_package()

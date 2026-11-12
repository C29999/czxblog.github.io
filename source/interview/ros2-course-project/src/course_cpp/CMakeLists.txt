cmake_minimum_required(VERSION 3.8)
project(course_cpp)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(std_msgs REQUIRED)

add_executable(talker src/talker.cpp)
ament_target_dependencies(talker rclcpp std_msgs)
target_compile_features(talker PUBLIC cxx_std_17)

add_executable(listener src/listener.cpp)
ament_target_dependencies(listener rclcpp std_msgs)
target_compile_features(listener PUBLIC cxx_std_17)

install(TARGETS talker listener DESTINATION lib/${PROJECT_NAME})
install(DIRECTORY launch DESTINATION share/${PROJECT_NAME})
ament_package()

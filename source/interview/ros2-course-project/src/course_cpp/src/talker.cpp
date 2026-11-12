#include <chrono>
#include <cstdint>
#include <memory>
#include <string>

#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/string.hpp"

class CourseTalker : public rclcpp::Node
{
public:
  CourseTalker() : Node("course_talker")
  {
    prefix_ = declare_parameter<std::string>("prefix", "Hello ROS 2");
    publisher_ = create_publisher<std_msgs::msg::String>("chatter", 10);
    timer_ = create_wall_timer(std::chrono::milliseconds(500), [this]() {
      std_msgs::msg::String message;
      message.data = prefix_ + " #" + std::to_string(count_++);
      RCLCPP_INFO(get_logger(), "Publishing: %s", message.data.c_str());
      publisher_->publish(message);
    });
  }

private:
  std::string prefix_;
  std::uint64_t count_{0};
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr publisher_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char * argv[])
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<CourseTalker>());
  rclcpp::shutdown();
  return 0;
}

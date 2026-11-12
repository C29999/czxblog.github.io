#include <cmath>
#include <memory>
#include <string>

#include "geometry_msgs/msg/twist.hpp"
#include "geometry_msgs/msg/twist_stamped.hpp"
#include "rclcpp/rclcpp.hpp"

class TwistStamper : public rclcpp::Node
{
public:
  TwistStamper() : Node("twist_stamper")
  {
    frame_id_ = declare_parameter<std::string>("frame_id", "base_footprint");
    publisher_ = create_publisher<geometry_msgs::msg::TwistStamped>(
      "/diff_drive_controller/cmd_vel", rclcpp::QoS(1));
    subscription_ = create_subscription<geometry_msgs::msg::Twist>(
      "/cmd_vel", rclcpp::QoS(1),
      [this](geometry_msgs::msg::Twist::ConstSharedPtr message) {
        if (!std::isfinite(message->linear.x) || !std::isfinite(message->angular.z)) {
          RCLCPP_WARN(get_logger(), "Rejected non-finite velocity");
          return;
        }
        geometry_msgs::msg::TwistStamped stamped;
        stamped.header.stamp = now();
        stamped.header.frame_id = frame_id_;
        stamped.twist.linear.x = message->linear.x;
        stamped.twist.angular.z = message->angular.z;
        publisher_->publish(stamped);
      });
  }

private:
  std::string frame_id_;
  rclcpp::Publisher<geometry_msgs::msg::TwistStamped>::SharedPtr publisher_;
  rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr subscription_;
};

int main(int argc, char * argv[])
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<TwistStamper>());
  rclcpp::shutdown();
  return 0;
}

(() => {
  'use strict';
  const placement = {
    'rl-communication': ['03', /Service|Action/], 'rl-tf': ['05', /变换|坐标/],
    'rl-drive': ['06', /左右轮速度/], 'rl-laser': ['10', /输入验收/],
    'rl-navigation': ['11', /代价|膨胀/], 'slam-lab': ['10', /回环为何/],
    'rl2-task-split': ['01', /执行边界/], 'rl2-closed-loop': ['01', /最小闭环/],
    'rl2-build-chain': ['02', /功能包/], 'rl2-overlay': ['02', /环境/],
    'rl2-qos': ['03', /QoS/], 'rl2-queue': ['03', /Executor|回调/],
    'rl2-units-latency': ['04', /时间|单位/], 'rl2-noise-filter': ['04', /噪声|协方差/],
    'rl2-tf-tree': ['05', /map、odom/], 'rl2-urdf-joint': ['05', /URDF/],
    'rl2-odometry-drift': ['06', /编码器增量/], 'rl2-wheel-calibration': ['06', /标定/],
    'rl2-control-interface': ['07', /接口/], 'rl2-watchdog': ['07', /反馈|故障|超时/],
    'rl2-controller-claims': ['07', /生命周期/],
    'rl2-namespace-config': ['08', /桥接/], 'rl2-lifecycle': ['08', /启动顺序/],
    'rl2-fusion-weight': ['09', /协方差/], 'rl2-time-sync': ['09', /IMU/],
    'rl2-scan-match': ['10', /匹配/], 'rl2-occupancy': ['10', /采集与保存/],
    'rl2-particles': ['11', /AMCL|粒子/], 'rl2-dynamic-obstacle': ['11', /控制|动态/],
    'rl2-project-checklist': ['12', /最终交付/], 'rl2-incident-review': ['12', /故障|复盘/]
  };
  const oldQuestions = {
    'rl-communication': ['Topic 发布一次后，需要等待每位订阅者的业务回复吗？', '不需要。Topic 不要求逐个业务应答；可靠性 QoS 的传输确认与应用业务回复不同。'],
    'rl-tf': ['把点 (2,1) 绕原点逆时针旋转 90°，坐标会是什么？', '平移为零时得到 (-1,2)。先旋转再平移，顺序不可随意交换。'],
    'rl-drive': ['左右轮同时以 1 m/s 前进，0.15 秒后走多远？', '理想无打滑模型前进 0.15 m，角速度为零。轮速差改变转弯方向。'],
    'rl-laser': ['同一束激光，障碍物更近时量程读数如何变化？', '沿同一射线的第一次命中距离变小。该演示使用理想射线，不模拟反射率和多径。'],
    'rl-navigation': ['增大障碍膨胀半径，会不会让狭窄通道无法通过？', '会。膨胀后的可通行空间变小；演示用栅格 BFS，不等同于 Nav2 完整规划器。'],
    'rl-arm': ['两段长度 1 m 和 0.8 m 的连杆完全伸直，末端多远？', '从基座起点量为 1.8 m；该二维几何模型不包含负载、碰撞和动力学。'],
    'slam-lab': ['检测到回环后，应该只移动最后一个位姿吗？', '通常需要联合调整多个历史位姿，以平衡里程计与回环约束；动画是概念示意，不是实际优化器。']
  };
  Object.entries(oldQuestions).forEach(([id, content]) => {
    const lab = document.getElementById(id);
    if (!lab) return;
    const prediction = document.createElement('details');
    prediction.className = 'course-prediction';
    const summary = document.createElement('summary');
    summary.textContent = `先预测：${content[0]}（展开核对）`;
    const answer = document.createElement('p'); answer.textContent = content[1];
    prediction.append(summary, answer); lab.prepend(prediction);
  });
  Object.entries(placement).forEach(([id, [chapter, matcher]]) => {
    const lab = document.getElementById(id);
    const container = document.getElementById(`rc-chapter-${chapter}`);
    if (!lab || !container) return;
    const sections = [...container.querySelectorAll('.rb-section')];
    const section = sections.find(item => matcher.test(item.querySelector('summary').textContent)) || sections.at(-1);
    section.querySelector('.rb-section-body').append(lab);
  });
  document.querySelectorAll('[data-course-labs]').forEach(mount => {
    const sections = [...mount.closest('.rb-chapter').querySelectorAll('.rb-section-body')];
    [...mount.children].forEach((lab, index) => sections[Math.min(index + 1, sections.length - 1)].append(lab));
    mount.remove();
  });
  const arm = document.getElementById('rl-arm');
  if (arm) document.getElementById('course-arm-reference').append(arm);
  const graph = document.getElementById('graph-lab');
  if (graph && !graph.querySelector('#slam-lab')) {
    const link = document.createElement('a'); link.href = '#slam-lab'; link.textContent = '图优化演示已放入第 10 章：打开回环小节 →'; graph.append(link);
  }
  const index = document.getElementById('course-lab-index');
  document.querySelectorAll('#book-reader .rb-chapter').forEach(chapter => {
    const group = document.createElement('div');
    const heading = document.createElement('h3'); heading.textContent = chapter.querySelector('h3').textContent;
    group.append(heading);
    chapter.querySelectorAll('.rl-lab, .rl2-lab, #slam-lab').forEach(lab => {
      const link = document.createElement('a'); link.href = `#${lab.id}`;
      link.textContent = lab.querySelector('h3,h4')?.textContent || lab.getAttribute('aria-label') || lab.id;
      group.append(link);
    });
    index.append(group);
  });
  function openTarget(hash) {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    let ancestor = target;
    while (ancestor) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
    requestAnimationFrame(() => { target.scrollIntoView({ block: 'start' }); target.tabIndex = -1; target.focus({ preventScroll: true }); });
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (link) openTarget(link.hash);
  });
  window.addEventListener('hashchange', () => openTarget(location.hash));
  if (location.hash) openTarget(location.hash);
  const outline = document.querySelector('.outline-head small');
  if (outline) outline.textContent = '12 章 ROS 2 主线 · 章内实验 · 原书参考';
  const courseLink = document.querySelector('.outline-link[href="#book-course"]');
  if (courseLink) courseLink.innerHTML = '<b>学</b>ROS 2 系统课程';
  const labsLink = document.querySelector('.outline-link[href="#book-experiments"]');
  if (labsLink) labsLink.innerHTML = '<b>练</b>章内实验索引';
})();

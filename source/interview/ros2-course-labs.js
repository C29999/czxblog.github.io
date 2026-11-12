(() => {
  'use strict';
  const mounts = [...document.querySelectorAll('[data-course-labs]')];
  if (!mounts.length) return;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const labs = [];
  const colors = { ink: '#243c52', blue: '#4168ce', teal: '#0b806f', orange: '#b86a16', red: '#c03950', pale: '#e5ebf3' };
  let globalPaused = document.documentElement.classList.contains('motion-paused');
  let frame = 0;
  let previousTime = 0;
  const number = (value, digits = 2) => Number(value).toFixed(digits);
  const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
  const range = (key, label, min, max, value, step, unit) => ({ key, label, min, max, value, step, unit });
  const choice = (key, label, options, value = options[0][0]) => ({ key, label, options, value });
  const node = (tag, className, content) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (content !== undefined) result.textContent = content;
    return result;
  };
  function shape(parent, tag, attributes, content) {
    const result = document.createElementNS(svgNamespace, tag);
    Object.entries(attributes || {}).forEach(([key, value]) => result.setAttribute(key, String(value)));
    if (content !== undefined) result.textContent = content;
    parent.append(result);
    return result;
  }
  function text(svg, x, y, content, color = colors.ink, size = 15, anchor = 'middle') {
    return shape(svg, 'text', { x, y, fill: color, 'font-size': size, 'text-anchor': anchor }, content);
  }
  function line(svg, x1, y1, x2, y2, color = colors.pale, width = 2) {
    return shape(svg, 'line', { x1, y1, x2, y2, stroke: color, 'stroke-width': width });
  }
  function dot(svg, x, y, radius, color) {
    return shape(svg, 'circle', { cx: x, cy: y, r: radius, fill: color });
  }
  function box(svg, x, y, width, height, label, color = colors.blue) {
    shape(svg, 'rect', { x, y, width, height, rx: 9, fill: '#ffffff', stroke: color, 'stroke-width': 2 });
    text(svg, x + width / 2, y + height / 2 + 5, label, color, 14);
  }
  function bars(svg, entries) {
    entries.forEach((entry, index) => {
      const y = 52 + index * 59;
      text(svg, 20, y, entry[0], colors.ink, 14, 'start');
      shape(svg, 'rect', { x: 160, y: y - 18, width: 300, height: 25, rx: 5, fill: colors.pale });
      shape(svg, 'rect', { x: 160, y: y - 18, width: clamp(Math.abs(entry[1]) / entry[3], 0, 1) * 300, height: 25, rx: 5, fill: entry[4] || colors.blue });
      text(svg, 477, y, `${number(entry[1], entry[5] === undefined ? 1 : entry[5])} ${entry[2]}`, colors.ink, 14, 'start');
    });
  }
  function pipeline(svg, labels, current, failed = false) {
    const width = 560 / labels.length;
    labels.forEach((label, index) => {
      if (index) line(svg, 35 + (index - 1) * width + width - 15, 122, 35 + index * width, 122, colors.blue);
      box(svg, 35 + index * width, 90, width - 15, 64, label, index === current ? (failed ? colors.red : colors.teal) : colors.ink);
      text(svg, 35 + index * width + (width - 15) / 2, 185, index < current ? '已通过' : index === current ? (failed ? '被阻塞' : '当前步骤') : '等待', colors.ink, 13);
    });
  }
  function plot(svg, series, minValue, maxValue, labels) {
    line(svg, 50, 205, 605, 205); line(svg, 50, 25, 50, 205);
    text(svg, 12, 34, number(maxValue, 1), colors.ink, 12, 'start');
    text(svg, 12, 204, number(minValue, 1), colors.ink, 12, 'start');
    series.forEach((values, index) => {
      const color = [colors.blue, colors.orange, colors.teal][index];
      const points = values.map((value, item) => `${50 + item / Math.max(values.length - 1, 1) * 550},${205 - clamp((value - minValue) / (maxValue - minValue), 0, 1) * 180}`).join(' ');
      shape(svg, 'polyline', { points, fill: 'none', stroke: color, 'stroke-width': 3 });
      if (values.length === 1) dot(svg, 50, 205 - clamp((values[0] - minValue) / (maxValue - minValue), 0, 1) * 180, 4, color);
      text(svg, 135 + index * 180, 235, labels[index], color, 13);
    });
  }
  function button(parent, label, action) {
    const result = node('button', 'rl2-button', label);
    result.type = 'button'; result.addEventListener('click', action); parent.append(result); return result;
  }
  function createLab(spec) {
    const mount = mounts.find(item => item.dataset.courseLabs === spec.chapter);
    if (!mount) return;
    const panel = node('article', 'rl2-lab');
    panel.id = `rl2-${spec.id}`; panel.dataset.labChapter = spec.chapter;
    const title = node('h4', 'rl2-title', spec.title); title.id = `${panel.id}-title`;
    panel.setAttribute('aria-labelledby', title.id);
    panel.append(node('p', 'rl2-kicker', `章内实验 ${spec.chapter} · ${labs.filter(item => item.spec.chapter === spec.chapter).length + 1}`), title, node('p', 'rl2-intro', spec.intro));
    const quiz = node('fieldset', 'rl2-prediction');
    quiz.append(node('legend', '', `先预测：${spec.question}`));
    const quizAnswer = node('p', 'rl2-quiz-answer'); quizAnswer.setAttribute('role', 'status');
    const quizButtons = spec.answers.map((answer, index) => button(quiz, answer, () => {
      quizButtons.forEach((control, position) => control.setAttribute('aria-pressed', String(position === index)));
      quizAnswer.textContent = `${index === spec.correct ? '预测正确。' : '再观察一次。'}${spec.reason}`;
    }));
    quizButtons.forEach(control => control.setAttribute('aria-pressed', 'false'));
    quiz.append(quizAnswer); panel.append(quiz);
    const inputs = node('div', 'rl2-inputs'); panel.append(inputs);
    const params = Object.fromEntries(spec.params.map(param => [param.key, param.value]));
    const state = spec.initial();
    const lab = { spec, panel, params, state, playing: false, visible: false, elapsed: 0, controls: [], steps: 0 };
    spec.params.forEach(param => {
      const holder = node('label', 'rl2-input');
      holder.htmlFor = `${panel.id}-${param.key}`;
      const caption = node('span', 'rl2-caption', param.label);
      const input = node(param.options ? 'select' : 'input'); input.id = holder.htmlFor;
      const value = node('output', 'rl2-value'); value.htmlFor = input.id;
      if (param.options) param.options.forEach(([key, label]) => { const option = node('option', '', label); option.value = key; input.append(option); });
      else { input.type = 'range'; input.min = param.min; input.max = param.max; input.step = param.step; }
      const sync = () => { input.value = params[param.key]; value.textContent = param.options ? '' : `${params[param.key]} ${param.unit}`; };
      sync();
      input.addEventListener(param.options ? 'change' : 'input', () => {
        params[param.key] = param.options ? input.value : Number(input.value);
        sync();
        if (spec.onParam) spec.onParam(lab, param.key);
        draw(lab);
      });
      holder.append(caption, input, value); inputs.append(holder); lab.controls.push(sync);
    });
    lab.extra = node('div', 'rl2-extra'); panel.append(lab.extra);
    const stage = node('div', 'rl2-stage');
    lab.svg = shape(stage, 'svg', { viewBox: '0 0 640 255', role: 'img', 'aria-label': `${spec.title}的数值模拟，详细结果见下方文字` });
    panel.append(stage);
    const controls = node('div', 'rl2-controls');
    lab.playButton = button(controls, '播放', () => {
      if (!lab.playing && (globalPaused || motionPreference.matches)) {
        lab.status.textContent = motionPreference.matches ? '系统偏好减少动态效果，使用“单步”继续实验。' : '全局动画已暂停；可使用单步，或在页面工具栏允许动画。';
        return;
      }
      lab.playing = !lab.playing; syncPlay(lab); schedule();
    });
    lab.playButton.setAttribute('aria-pressed', 'false');
    button(controls, '单步', () => { advance(lab); draw(lab); });
    button(controls, '重置', () => {
      lab.playing = false; lab.elapsed = 0; lab.steps = 0;
      Object.keys(state).forEach(key => delete state[key]); Object.assign(state, spec.initial());
      spec.params.forEach(param => { params[param.key] = param.value; });
      lab.controls.forEach(sync => sync()); quizButtons.forEach(control => control.setAttribute('aria-pressed', 'false')); quizAnswer.textContent = '';
      if (lab.resetExtra) lab.resetExtra();
      syncPlay(lab); draw(lab); schedule();
    });
    lab.status = node('p', 'rl2-status'); lab.status.setAttribute('role', 'status');
    lab.result = node('p', 'rl2-result');
    panel.append(controls, lab.status, lab.result, node('p', 'rl2-boundary', `简化边界：${spec.boundary}`));
    mount.append(panel); labs.push(lab);
    if (spec.setup) spec.setup(lab);
    draw(lab);
  }
  function syncPlay(lab) {
    lab.playButton.textContent = lab.playing ? '暂停' : '播放';
    lab.playButton.setAttribute('aria-pressed', String(lab.playing));
  }
  function advance(lab) {
    if (lab.steps >= 120) { lab.playing = false; syncPlay(lab); return; }
    lab.steps += 1;
    lab.spec.step(lab);
    if (lab.steps >= 120) {
      lab.playing = false; syncPlay(lab);
    }
  }
  function draw(lab) {
    lab.svg.replaceChildren();
    const result = lab.spec.render(lab);
    lab.result.textContent = result;
    lab.status.textContent = `已运行 ${lab.steps} 步。${lab.steps >= 120 ? '已到演示轮次上限，请重置再试。' : '参数可随时调整；重置恢复初始条件。'}`;
  }
  function schedule() {
    const active = !document.hidden && !globalPaused && !motionPreference.matches && labs.some(lab => lab.playing && lab.visible);
    if (active && !frame) { previousTime = performance.now(); frame = requestAnimationFrame(tick); }
    else if (!active && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  function tick(now) {
    frame = 0;
    const delta = Math.min(now - previousTime, 100); previousTime = now;
    if (!document.hidden && !globalPaused && !motionPreference.matches) labs.forEach(lab => {
      if (!lab.playing || !lab.visible) return;
      lab.elapsed += delta;
      if (lab.elapsed >= 650) { lab.elapsed = 0; advance(lab); draw(lab); }
    });
    if (!document.hidden && !globalPaused && !motionPreference.matches && labs.some(lab => lab.playing && lab.visible)) frame = requestAnimationFrame(tick);
  }
  const specs = [];
  specs.push({
    id: 'task-split', chapter: '01', title: '把送货任务分给合适的节点',
    intro: '像餐厅分工：看清桌号、决定路线、转动车轮是三种职责。拖动任务卡片到节点；也可以使用每张卡片旁的选择框，完全不用鼠标拖拽。',
    question: '摄像头识别结果应该主要由哪个节点产生？', answers: ['感知节点', '电机驱动节点'], correct: 0, reason: '感知处理观测，规划选择动作，驱动执行硬件命令。清楚的接口让故障可以逐段定位。',
    params: [range('budget', '一个周期的计算预算', 20, 100, 60, 5, 'ms')],
    initial: () => ({ assigned: ['sense', 'sense', 'sense'], processed: 0 }),
    setup(lab) {
      const roles = [['sense', '感知节点'], ['plan', '规划节点'], ['drive', '驱动节点']];
      const taskNames = ['识别桌号 · 20 ms', '规划路线 · 30 ms', '发送轮速 · 5 ms'];
      const cards = node('div', 'rl2-task-cards');
      const selects = [];
      taskNames.forEach((name, index) => {
        const card = node('div', 'rl2-task-card'); card.draggable = true;
        card.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', `${lab.panel.id}:${index}`); });
        const label = node('label', '', name); const select = node('select'); select.id = `${lab.panel.id}-task-${index}`; label.htmlFor = select.id;
        roles.forEach(([key, title]) => { const option = node('option', '', title); option.value = key; select.append(option); });
        select.addEventListener('change', () => { lab.state.assigned[index] = select.value; draw(lab); });
        card.append(label, select); cards.append(card); selects.push(select);
      });
      const targets = node('div', 'rl2-drop-targets');
      roles.forEach(([key, title]) => {
        const target = node('div', 'rl2-drop-target', `拖到：${title}`);
        target.addEventListener('dragover', event => event.preventDefault());
        target.addEventListener('drop', event => {
          event.preventDefault(); const payload = event.dataTransfer.getData('text/plain');
          const prefix = `${lab.panel.id}:`; if (!payload.startsWith(prefix)) return;
          const index = Number(payload.slice(prefix.length)); if (!Number.isInteger(index) || index < 0 || index > 2) return;
          lab.state.assigned[index] = key; selects[index].value = key; draw(lab);
        });
        targets.append(target);
      });
      lab.extra.append(cards, targets);
      lab.resetExtra = () => selects.forEach(select => { select.value = 'sense'; });
    },
    step({ state, params }) { if (state.assigned.every((role, index) => role === ['sense', 'plan', 'drive'][index]) && params.budget >= 55) state.processed += 1; },
    render({ svg, state, params }) {
      const correct = state.assigned.filter((role, index) => role === ['sense', 'plan', 'drive'][index]).length;
      pipeline(svg, ['感知 20ms', '规划 30ms', '驱动 5ms'], correct === 3 ? 2 : correct, correct < 3 || params.budget < 55);
      text(svg, 320, 225, `职责匹配 ${correct}/3 · 已完成 ${state.processed} 个送货周期`, colors.teal);
      return `本例串行链路至少需要 55 ms，当前预算 ${params.budget} ms。${correct < 3 ? '先调整任务归属；错误职责在此教学模型中阻塞流程。' : params.budget < 55 ? '职责正确，但预算不足：应优化计算或降低控制更新要求。' : '职责与预算均匹配，单步会完成一个周期。'}现实节点可以并行，但不能忽略数据依赖。`;
    }, boundary: '任务分工和耗时均为教学设定，不是ROS自动判断的规则；未模拟线程调度或实际机器人运动。'
  });
  specs.push({
    id: 'closed-loop', chapter: '01', title: '闭环：看见偏差后再修正', intro: '像调节水龙头：只凭经验转一次是开环，不断看水温再微调是闭环。这里让小车靠近一条目标位置。',
    question: '增加负载后，哪种方式能根据位置误差继续调整？', answers: ['固定速度开环', '使用位置反馈闭环'], correct: 1, reason: '闭环根据目标与测量的差值更新控制，但过大增益仍可能振荡。',
    params: [choice('mode', '控制方式', [['closed', '位置反馈'], ['open', '固定速度']]), range('target', '目标位置', 1, 5, 3, .5, 'm'), range('gain', '比例增益', .2, 2, .8, .2, '1/s'), range('load', '负载造成的速度损失', 0, .4, .1, .05, 'm/s')],
    initial: () => ({ position: 0, history: [0] }),
    step({ state, params }) { const command = params.mode === 'closed' ? clamp(params.gain * (params.target - state.position), -1, 1) : .5; state.position += (command - Math.sign(command) * Math.min(Math.abs(command), params.load)) * .5; state.history.push(state.position); if (state.history.length > 30) state.history.shift(); },
    render({ svg, state, params }) { plot(svg, [state.history, state.history.map(() => params.target)], 0, Math.max(6, state.position + 1), ['实测位置 m', '目标位置 m']); return `实际 ${number(state.position)} m，误差 ${number(params.target - state.position)} m。每步 0.5 s。${params.mode === 'closed' ? '比例控制随误差减小而降速；持续负载会造成稳态偏差。' : '固定速度不检查是否到达目标，可能直接越过。'}尝试在运行中改变负载，观察曲线变化。`; },
    boundary: '一维限速比例控制，负载被简化为恒定速度损失，没有惯性、噪声或碰撞；不是可直接驱动硬件的控制器。'
  });
  specs.push({
    id: 'build-chain', chapter: '02', title: '构建流水线：代码怎样成为可运行节点', intro: '像做菜：买齐原料、按菜谱加工、把菜端到餐桌。写完源文件并不代表当前终端已经能找到新节点。',
    question: 'colcon build 成功后，另一个终端一定能直接运行新包吗？', answers: ['一定能', '还需要正确加载工作区环境'], correct: 1, reason: '构建产生install内容；终端需要source安装空间的setup文件，才能获得包查找环境。',
    params: [choice('dependency', '依赖是否齐全', [['yes', '已安装'], ['no', '缺少依赖']]), choice('source', '终端加载环境', [['no', '未source工作区'], ['yes', '已source install/setup.bash']])],
    initial: () => ({ phase: 0, error: '' }),
    step({ state, params }) { state.error = ''; if (state.phase === 1 && params.dependency === 'no') state.error = '编译阻塞：缺少依赖'; else if (state.phase === 2 && params.source === 'no') state.error = '运行阻塞：当前终端找不到包'; else state.phase = Math.min(3, state.phase + 1); },
    render({ svg, state }) { pipeline(svg, ['源码', '构建', '环境加载', '运行'], state.phase, Boolean(state.error)); return `${state.error || ['检查package.xml、CMakeLists.txt或setup.py。', '下一步模拟colcon build；依赖缺失会停止。', '构建已完成；确认当前终端加载install/setup.bash。', '节点启动成功，代码→安装空间→环境→执行链路贯通。'][state.phase]} 修改参数后可以继续单步，不必盲目重装ROS。`; }, boundary: '顺序状态机展示开发流程，不执行真实shell命令；实际构建还会受编译器、接口生成、权限和路径影响。'
  });
  specs.push({
    id: 'overlay', chapter: '02', title: '环境叠加：为什么运行的还是旧版本', intro: '像查字典：优先翻到的那一本决定解释。多个工作区包含同名包时，环境搜索顺序决定选中哪个安装版本。',
    question: '当前终端先加载base，后加载dev，通常优先找到哪一个同名包？', answers: ['dev覆盖工作区', '永远是base'], correct: 0, reason: 'overlay在环境中通常优先于underlay；仍须确认实际包路径与依赖兼容。',
    params: [choice('order', '加载顺序', [['base-dev', 'base → dev'], ['dev-base', 'dev → base']]), choice('built', 'dev是否重新构建', [['no', '只有源码已改'], ['yes', 'install已更新']])],
    initial: () => ({ runs: 0 }), step({ state }) { state.runs += 1; },
    render({ svg, params, state }) { const selected = params.order === 'base-dev' ? 'dev' : 'base'; const version = selected === 'dev' && params.built === 'yes' ? 2 : 1; pipeline(svg, ['搜索路径', selected, `版本 v${version}`], 2); text(svg, 320, 225, `模拟运行 ${state.runs} 次`, colors.teal); return `本例找到 ${selected}/install/demo_node，输出v${version}。${selected === 'dev' && params.built === 'no' ? '源码改了，安装产物仍旧；先构建再检查。' : selected === 'base' ? 'base覆盖了搜索优先级，检查加载顺序。' : '开发版本已生效。'}真实排查可用ros2 pkg prefix demo_node定位包。`; }, boundary: '两个独立安装空间的简化搜索模型；不完整模拟setup链式加载、符号链接安装或ABI兼容性。'
  });
  specs.push({
    id: 'qos', chapter: '03', title: 'QoS：说话方式和听话要求要匹配', intro: '像快递服务：收件人要求签收保证，普通平邮无法承诺满足它。QoS先判断能否连接，再讨论消息损失。',
    question: 'best effort发布者能满足reliable订阅者的可靠性要求吗？', answers: ['不能', '只要话题名相同就能'], correct: 0, reason: '可靠性遵循请求/提供兼容性：reliable订阅者不能接受只提供best effort的发布者。',
    params: [choice('publisher', '发布端可靠性', [['best', 'best effort'], ['reliable', 'reliable']]), choice('subscriber', '订阅端可靠性要求', [['reliable', 'reliable'], ['best', 'best effort']]), range('loss', '模拟每N条丢失一次', 2, 10, 4, 1, '条')],
    initial: () => ({ sent: 0, received: 0, retries: 0 }),
    step({ state, params }) { state.sent += 1; if (params.publisher === 'best' && params.subscriber === 'reliable') return; const lost = state.sent % params.loss === 0; if (lost && params.publisher === 'reliable' && params.subscriber === 'reliable') { state.retries += 1; state.received += 1; } else if (!lost) state.received += 1; },
    render({ svg, params, state }) { const compatible = params.publisher === 'reliable' || params.subscriber === 'best'; bars(svg, [['发送', state.sent, '条', Math.max(10, state.sent)], ['接收', state.received, '条', Math.max(10, state.sent), colors.teal], ['补传', state.retries, '次', Math.max(10, state.sent), colors.orange]]); return `兼容状态：${compatible ? '可靠性匹配' : '不兼容，无法建立此连接'}。累计发送${state.sent}，接收${state.received}。可靠双方在本模型中会补传丢包；best effort可能遗漏。调整QoS后历史计数保留，可重置比较。`; }, boundary: '仅模拟可靠性和周期性丢包；补传假定成功，不模拟DDS发现、缓存耗尽、重传延迟和其他QoS兼容条件。'
  });
  specs.push({
    id: 'queue', chapter: '03', title: '队列：消息来得比处理得快会怎样', intro: '像餐厅排队：增加等候区不等于厨师做得更快。KEEP_LAST满了会丢掉旧消息，深队列也可能放大延迟。',
    question: '持续输入快于处理时，只增加队列深度能解决吞吐不足吗？', answers: ['能无限解决', '不能，只能延缓或改变丢弃'], correct: 1, reason: '长期吞吐取决于处理能力；更深队列可能让处理的数据更旧。',
    params: [range('publish', '每秒到达', 1, 20, 10, 1, '条/s'), range('consume', '每秒处理', 1, 20, 4, 1, '条/s'), range('depth', 'KEEP_LAST深度', 1, 30, 10, 1, '条')],
    initial: () => ({ queue: [], tick: 0, dropped: 0, processed: 0, age: 0 }),
    step({ state, params }) { state.tick += 1; for (let count = 0; count < params.publish; count += 1) state.queue.push(state.tick); while (state.queue.length > params.depth) { state.queue.shift(); state.dropped += 1; } for (let count = 0; count < params.consume && state.queue.length; count += 1) { state.age = state.tick - state.queue.shift(); state.processed += 1; } },
    render({ svg, state, params }) { for (let index = 0; index < params.depth; index += 1) shape(svg, 'rect', { x: 30 + index % 15 * 39, y: 55 + Math.floor(index / 15) * 58, width: 30, height: 38, rx: 4, fill: index < state.queue.length ? colors.blue : colors.pale }); text(svg, 320, 202, `缓存 ${state.queue.length}/${params.depth} · 已处理 ${state.processed} · 丢旧 ${state.dropped}`); return `每步代表1秒，先集中到达再处理。最近处理消息年龄 ${state.age} s。增大depth后注意积压与消息年龄；减小发布率或增加处理率才能改变长期收支。`; }, boundary: '批量到达的离散模型，未模拟多线程、网络缓冲和DDS具体资源上限；真实消息通常分散到达。'
  });
  specs.push({
    id: 'units-latency', chapter: '04', title: '单位与延迟：数字没错也可能撞墙', intro: '像地图上忘记写比例尺：1000毫米与1000米看起来是同一个数字，意义却差一千倍。观测还必须带时间。',
    question: '机器人以1 m/s前进，测距落后200 ms，会多走多少？', answers: ['0.2 m', '200 m'], correct: 0, reason: '距离=速度×时间，200 ms=0.2 s；时间戳能帮助判断观测对应哪个时刻。',
    params: [range('speed', '前进速度', 0, 2, 1, .1, 'm/s'), range('delay', '观测延迟', 0, 1000, 200, 50, 'ms'), choice('unit', '原始读数1000的单位', [['mm', 'mm，转换为米'], ['wrong', '误当作米']])],
    initial: () => ({ seconds: 0 }), step({ state }) { state.seconds += .1; },
    render({ svg, params, state }) { const staleDistance = 1; const actual = Math.max(0, staleDistance - params.speed * params.delay / 1000); const interpreted = params.unit === 'mm' ? 1 : 1000; box(svg, 35, 80, 145, 60, '机器人'); box(svg, 520, 45, 70, 150, '墙'); line(svg, 180, 110, 520, 110, colors.orange, 3); text(svg, 350, 80, `当前距离 ${number(actual)} m`, colors.teal); text(svg, 320, 220, `经过 ${number(state.seconds, 1)} s · 单位换算显示 ${interpreted} m`); return `观测时刻距离1m，延迟期间行驶${number(params.speed * params.delay / 1000)}m，当前剩余${number(actual)}m。${params.unit === 'wrong' ? '单位错误造成1000倍放大。' : '正确换算1000mm÷1000=1m。'}本实验每步只推进演示时钟，参数比较的是同一次观测在延迟后的误差。`; }, boundary: '恒速、静止墙、固定延迟；未加入制动距离和加速度。图形是示意比例，数值才是精确计算结果。'
  });
  specs.push({
    id: 'noise-filter', chapter: '04', title: '噪声滤波：更平滑也可能更迟钝', intro: '像看晃动的体重秤，取最近几次平均会稳定，但突然增加一件行李时也要等几次才反映出来。',
    question: '平均窗口变大，突变响应通常怎样？', answers: ['更快', '更慢但更平滑'], correct: 1, reason: '更多历史值会稀释新变化；降噪和响应速度需要权衡。',
    params: [range('noise', '确定性噪声幅度', 0, 1, .4, .1, 'm'), range('window', '平均窗口', 1, 12, 5, 1, '个采样')],
    initial: () => ({ tick: 0, raw: [], smooth: [], truth: [] }),
    step({ state, params }) { state.tick += 1; const truth = state.tick < 12 ? 2 : 4; const measured = truth + params.noise * Math.sin(state.tick * 2.4); state.raw.push(measured); const recent = state.raw.slice(-params.window); state.smooth.push(recent.reduce((sum, value) => sum + value, 0) / recent.length); state.truth.push(truth); if (state.raw.length > 40) { state.raw.shift(); state.smooth.shift(); state.truth.shift(); } },
    render({ svg, state }) { plot(svg, [state.raw, state.smooth, state.truth], 0, 5, ['原始测量 m', '移动平均 m', '真值 m']); return `已采样${state.tick}次；第12次真值从2m跳到4m。最新原始值${number(state.raw.at(-1) || 0)}，滤波值${number(state.smooth.at(-1) || 0)}。比较窗口1与12：观察抖动和突变后追上真值的速度。`; }, boundary: '噪声为可复现正弦扰动，不代表真实概率分布；这里用移动平均，不是卡尔曼滤波。'
  });
  specs.push({
    id: 'tf-tree', chapter: '05', title: '坐标树：一条边只能有一个权威来源', intro: '像公司通讯录：每个人沿上级链找到总部。如果两个部门同时给同一个坐标关系报不同答案，转换就会跳。',
    question: 'AMCL已经发布map→odom时，再加同一条静态变换好吗？', answers: ['会产生重复权威来源', '会提高定位精度'], correct: 0, reason: '一个坐标边需要明确发布者；定位修正与固定关系不能竞争同一变换。',
    params: [choice('parent', '雷达父坐标', [['base', 'base_link'], ['missing', '不存在的body']]), choice('duplicate', 'map→odom发布者', [['one', '仅定位节点'], ['two', '定位节点与静态节点']]), range('offset', '雷达安装偏移', 0, 1, .3, .1, 'm')],
    initial: () => ({ tick: 0 }), step({ state }) { state.tick += 1; },
    render({ svg, state, params }) { pipeline(svg, ['map', 'odom', 'base_link', 'laser'], params.parent === 'missing' ? 3 : params.duplicate === 'two' ? 1 : state.tick % 4, params.parent === 'missing' || params.duplicate === 'two'); const mapOffset = params.duplicate === 'two' && state.tick % 2 ? 1 : 0; const transformed = 2 + params.offset + mapOffset; text(svg, 320, 225, params.parent === 'missing' ? '无法查到 map → laser' : `雷达系X=2m → 地图X=${number(transformed)}m`, colors.teal); return params.parent === 'missing' ? '树在雷达父坐标处断开；应核对frame_id与TF名称，不是把RViz随便换个固定坐标。' : params.duplicate === 'two' ? `两发布者交替给出0m/1m修正，点的位置随单步跳变至${number(transformed)}m。应修复发布权归属。` : `链路连通；安装偏移${number(params.offset)}m加入转换。真实TF还必须找到观测时间对应的变换。`; }, boundary: '一维坐标与交替发布的示意；真实TF树还包括旋转、时间缓存及唯一父节点约束。'
  });
  specs.push({
    id: 'urdf-joint', chapter: '05', title: 'URDF关节：外观位置和转轴不是一回事', intro: '像给门装合页：门板画得再漂亮，合页轴装错，开门方向还是错的。改变joint角度，看末端位置如何变化。',
    question: '把连杆visual旋转，是否等于修正joint轴？', answers: ['是同一个属性', '不是，关节轴要单独检查'], correct: 1, reason: 'visual的origin只影响外观相对link的变换；joint描述父子link关系与运动轴。',
    params: [range('length', '连杆长度', .2, 1, .6, .1, 'm'), range('angle', '关节角', -90, 90, 30, 5, '°'), choice('axis', '旋转方向', [['positive', '+Z'], ['negative', '-Z']])],
    initial: () => ({ sweeps: 0 }), step(lab) { lab.params.angle = lab.params.angle >= 90 ? -90 : lab.params.angle + 5; lab.state.sweeps += 1; lab.controls.forEach(sync => sync()); },
    render({ svg, params }) { const radians = params.angle * Math.PI / 180 * (params.axis === 'positive' ? 1 : -1); const endX = params.length * Math.cos(radians); const endY = params.length * Math.sin(radians); line(svg, 100, 130, 560, 130); line(svg, 180, 25, 180, 225); line(svg, 180, 130, 180 + endX * 240, 130 - endY * 100, colors.blue, 10); dot(svg, 180, 130, 14, colors.orange); dot(svg, 180 + endX * 240, 130 - endY * 100, 10, colors.teal); text(svg, 400, 225, `末端 (${number(endX)}, ${number(endY)}) m`); return `二维绕Z轴的FK：x=Lcosθ，y=Lsinθ；当前角度${number(radians)}rad。轴方向取反会改变旋转符号。注意URDF角度使用弧度，关节限位与碰撞模型也需要一起检查。`; }, boundary: '单根无质量连杆，仅演示正运动学；画面横纵比例不同以容纳正负角度，不计算动力学。'
  });
  specs.push({
    id: 'odometry-drift', chapter: '06', title: '里程计漂移：每一步小误差怎样累积', intro: '像闭眼数步走路：每步只多算一点，绕一大圈后也会离起点很远。轮速积分提供连续估计，但没有绝对位置锚点。',
    question: '轮速始终偏高2%，走得越久位置误差通常怎样？', answers: ['会累积', '自动抵消'], correct: 0, reason: '系统性比例误差随累计行程增长，不能指望平均为零。',
    params: [range('bias', '轮速比例误差', -10, 10, 2, 1, '%'), range('speed', '真实速度', .1, 2, 1, .1, 'm/s')],
    initial: () => ({ real: 0, estimate: 0, truth: [0], odom: [0] }),
    step({ state, params }) { state.real += params.speed; state.estimate += params.speed * (1 + params.bias / 100); state.truth.push(state.real); state.odom.push(state.estimate); if (state.truth.length > 35) { state.truth.shift(); state.odom.shift(); } },
    render({ svg, state }) { plot(svg, [state.truth, state.odom], 0, Math.max(5, state.real * 1.2), ['真实距离 m', '里程计距离 m']); return `每步1s，真实累计${number(state.real)}m，里程计累计${number(state.estimate)}m，误差${number(state.estimate - state.real)}m。改变误差比例后，旧误差不会凭空消失；需借助定位观测进行修正。`; }, boundary: '直线运动、恒定比例误差；未建模转弯、打滑与随机噪声，真实漂移可能更复杂。'
  });
  specs.push({
    id: 'wheel-calibration', chapter: '06', title: '轮径标定：同样的转数不一定走同样远', intro: '像用自行车轮子当尺子：轮胎充气、负载和有效滚动半径变化，都可能让尺子的刻度失准。',
    question: '模型轮半径大于实际值，按转数计算的距离会怎样？', answers: ['低估', '高估'], correct: 1, reason: 'd=rθ；相同转角乘以更大半径，会得到更大距离。',
    params: [range('actual', '实际有效半径', .05, .2, .1, .01, 'm'), range('model', '模型半径', .05, .2, .12, .01, 'm'), range('turns', '每步转数', .25, 2, 1, .25, '圈')],
    initial: () => ({ turns: 0 }), step({ state, params }) { state.turns += params.turns; },
    render({ svg, state, params }) { const actual = state.turns * 2 * Math.PI * params.actual; const estimated = state.turns * 2 * Math.PI * params.model; bars(svg, [['真实路程', actual, 'm', Math.max(5, actual, estimated)], ['模型路程', estimated, 'm', Math.max(5, actual, estimated), colors.orange]]); text(svg, 320, 220, `累计 ${state.turns} 圈 · 建议比例 ${number(params.actual / params.model, 3)}`); return `真实${number(actual)}m，估计${number(estimated)}m。若实测距离/估计距离=${number(params.actual / params.model, 3)}，可作为半径比例修正线索；先确认不是打滑造成的。改变半径会重新计算同一累计转数。`; }, boundary: '理想纯滚动、一只等效轮子；未模拟左右轮差异或轮距误差。标定应采集多次往返数据。'
  });
  specs.push({
    id: 'control-interface', chapter: '07', title: '控制接口：位置、速度、力矩不是同一种命令', intro: '像告诉司机“到三公里处”“保持十公里每小时”和“踩多大油门”，三个数值对应三种不同任务。',
    question: '同样数值1，position与velocity接口含义相同吗？', answers: ['不同，单位和作用不同', '相同，都转一圈'], correct: 0, reason: '旋转关节position是rad，velocity是rad/s，effort通常是N·m。',
    params: [choice('mode', '命令接口', [['position', '位置 rad'], ['velocity', '速度 rad/s'], ['effort', '力矩 N·m']]), range('command', '命令数值', -2, 2, 1, .1, '按所选接口'), range('inertia', '转动惯量', .5, 2, 1, .1, 'kg·m²')],
    initial: () => ({ position: 0, velocity: 0, history: [0] }),
    step({ state, params }) { if (params.mode === 'position') state.velocity = clamp((params.command - state.position) * 2, -2, 2); else if (params.mode === 'velocity') state.velocity = params.command; else state.velocity = clamp(state.velocity + params.command / params.inertia * .1, -5, 5); state.position += state.velocity * .1; state.history.push(state.position); if (state.history.length > 40) state.history.shift(); },
    render({ svg, state, params }) { plot(svg, [state.history], Math.min(-2, state.position - 1), Math.max(2, state.position + 1), ['实际位置 rad']); return `每步0.1s，位置${number(state.position)}rad，速度${number(state.velocity)}rad/s。${params.mode === 'position' ? '简化位置环会逐渐接近目标。' : params.mode === 'velocity' ? '非零速度持续积累位置。' : '同样力矩下，惯量越大加速越慢；本例速度限制±5rad/s。'}真实控制器必须与硬件声明的命令/状态接口匹配。`; }, boundary: '简化理想执行器，未包含摩擦、重力和通信延迟；position模式是教学比例环，并非所有位置驱动器的内部实现。'
  });
  specs.push({
    id: 'watchdog', chapter: '07', title: '反馈掉线：有命令不代表机器人正常执行', intro: '像视频通话卡住：最后一帧还在屏幕上，不说明对方此刻仍在那里。状态数据必须检查新鲜度。',
    question: '最后一次反馈已经过期，仍显示旧位置意味着什么？', answers: ['机器人一定静止', '当前状态未知，需要超时处理'], correct: 1, reason: '没有新状态不能证明设备停止；监控、命令超时和硬件停止各是不同机制。',
    params: [choice('link', '反馈链路', [['up', '正常'], ['down', '掉线']]), range('timeout', '监控超时阈值', .2, 2, .6, .1, 's'), range('command', '请求速度', 0, 1, .5, .1, 'm/s')],
    initial: () => ({ elapsed: 0, lastFeedback: 0, position: 0, reported: 0, stopped: false }),
    step({ state, params }) { state.elapsed = Math.round((state.elapsed + .2) * 10) / 10; if (params.link === 'up') state.lastFeedback = state.elapsed; state.stopped = state.elapsed - state.lastFeedback > params.timeout + 1e-9; if (!state.stopped) state.position += params.command * .2; if (params.link === 'up') state.reported = state.position; },
    render({ svg, state, params }) { const age = state.elapsed - state.lastFeedback; bars(svg, [['反馈年龄', age, 's', Math.max(2, age), state.stopped ? colors.red : colors.teal], ['显示位置', state.reported, 'm', Math.max(2, state.position)], ['模型真值', state.position, 'm', Math.max(2, state.position), colors.orange]]); return `当前${number(state.elapsed, 1)}s，反馈年龄${number(age, 1)}s，阈值${params.timeout}s：${state.stopped ? '模拟监控器已触发停止' : '模拟命令仍允许执行'}。切换掉线后，显示值保持旧值，模型仍前进至超时。恢复反馈才重新获得新状态。`; }, boundary: '假定监控器触发后执行器立即停下；真实停机有制动与通信链路，软件状态灯不构成急停保证。'
  });
  specs.push({
    id: 'controller-claims', chapter: '07', title: '资源占用：两个控制器能同时指挥同一关节吗', intro: '像一辆车同时装两个互相争抢的方向盘。控制器切换必须确认哪些命令接口已被占用。',
    question: '两个控制器同时独占wheel/velocity接口会怎样？', answers: ['应拒绝冲突激活', '自动平均命令'], correct: 0, reason: '控制器管理器会检查接口资源冲突；不会自动替业务选择平均控制策略。',
    params: [choice('second', '控制器B请求接口', [['same', 'wheel/velocity'], ['other', 'gripper/position']]), choice('switch', '激活策略', [['strict', '保留A，尝试激活B'], ['replace', '先停止A，再激活B']])],
    initial: () => ({ activeA: true, activeB: false, outcome: 'A已激活' }),
    step({ state, params }) { if (params.switch === 'replace') state.activeA = false; if (state.activeA && params.second === 'same') { state.activeB = false; state.outcome = '资源冲突，拒绝激活B'; } else { state.activeB = true; state.outcome = 'B激活成功'; } },
    render({ svg, state, params }) { box(svg, 30, 50, 170, 60, `A：${state.activeA ? 'active' : 'inactive'}`, state.activeA ? colors.teal : colors.ink); box(svg, 30, 145, 170, 60, `B：${state.activeB ? 'active' : 'inactive'}`, state.activeB ? colors.teal : colors.ink); line(svg, 200, 80, 430, 80, colors.blue); line(svg, 200, 175, 430, params.second === 'same' ? 80 : 175, colors.orange); box(svg, 430, 50, 180, 60, 'wheel/velocity'); box(svg, 430, 145, 180, 60, 'gripper/position'); return `${state.outcome}。修改请求只是配置选择，单步才执行一次激活尝试。状态接口读取与命令接口占用不同，不能把所有资源都当作同一种互斥锁。`; }, boundary: '两个独占命令接口的简化管理器；真实ros2_control还需要硬件可用、接口声明和生命周期回调成功。'
  });
  specs.push({
    id: 'namespace-config', chapter: '08', title: '配置故障：名字只差一个前缀就收不到', intro: '像同名街道位于不同城区：scan与/robot1/scan可能不是同一个地址。命名空间帮助隔离多机器人，也会暴露误配置。',
    question: '发布/robot1/scan，订阅/robot2/scan能直接相连吗？', answers: ['不能，完整名称不同', '能，末尾都是scan'], correct: 0, reason: 'ROS接口按解析后的完整名称连接；相同后缀不代表相同资源。',
    params: [choice('namespace', '订阅节点命名空间', [['robot2', '/robot2'], ['robot1', '/robot1']]), choice('remap', '话题重映射', [['none', '无'], ['match', 'scan → /robot1/scan']]), range('threshold', '算法最小有效距离', .1, 3, .5, .1, 'm')],
    initial: () => ({ published: 0, received: 0, accepted: 0 }),
    step({ state, params }) { state.published += 1; if (params.namespace === 'robot1' || params.remap === 'match') { state.received += 1; if (1.5 >= params.threshold) state.accepted += 1; } },
    render({ svg, state, params }) { const subscriber = params.remap === 'match' ? '/robot1/scan' : `/${params.namespace}/scan`; box(svg, 30, 70, 240, 65, '/robot1/scan 发布'); box(svg, 350, 70, 260, 65, `${subscriber} 订阅`); line(svg, 270, 103, 350, 103, subscriber === '/robot1/scan' ? colors.teal : colors.red, 4); text(svg, 320, 205, `发送${state.published} → 收到${state.received} → 算法接受${state.accepted}`); return `测试距离恒为1.5m，阈值${params.threshold}m。先看能否收到，再看算法是否接受；${subscriber !== '/robot1/scan' ? '当前首先是名称不匹配。' : params.threshold > 1.5 ? '通信已通，但阈值过滤了全部数据。' : '通信与参数条件均满足。'}避免把参数过滤误判成QoS故障。`; }, boundary: '仅模拟相对话题名解析、重映射与单个数值阈值，不加载真实YAML或启动ROS节点。'
  });
  specs.push({
    id: 'lifecycle', chapter: '08', title: '生命周期：启动进程与开始工作有何不同', intro: '像开店：先装修配置，再开门营业；房间里有人并不代表已经营业。生命周期把准备和工作分开。',
    question: 'managed node处于inactive时，通常意味着什么？', answers: ['配置完成，但尚未激活工作', '进程必定已经退出'], correct: 0, reason: '生命周期状态与进程存在不同；configure和activate是不同转换。',
    params: [choice('valid', '传感器配置', [['yes', '有效'], ['no', '校准文件缺失']]), choice('transition', '本步请求', [['configure', 'configure'], ['activate', 'activate'], ['deactivate', 'deactivate'], ['cleanup', 'cleanup']])],
    initial: () => ({ phase: 'unconfigured', message: '等待配置' }),
    step({ state, params }) { const transitions = { 'unconfigured:configure': 'inactive', 'inactive:activate': 'active', 'active:deactivate': 'inactive', 'inactive:cleanup': 'unconfigured' }; const next = transitions[`${state.phase}:${params.transition}`]; if (!next) state.message = '该状态不接受此转换'; else if (params.transition === 'configure' && params.valid === 'no') state.message = '配置回调失败，保持unconfigured'; else { state.phase = next; state.message = `已转入${next}`; } },
    render({ svg, state }) { pipeline(svg, ['unconfigured', 'inactive', 'active'], ['unconfigured', 'inactive', 'active'].indexOf(state.phase)); return `${state.message}。先configure，再activate；从active回收配置应先deactivate，再cleanup。本例active才表示允许业务输出。实际节点仍可能在激活后遇到运行故障。`; }, boundary: '省略transitional、errorprocessing、finalized等状态；业务行为由节点实现，生命周期不会自动修复硬件。'
  });
  specs.push({
    id: 'fusion-weight', chapter: '09', title: '融合：更可信的尺子应占多大权重', intro: '像两位同学量桌子：一位用钢尺、一位目测。融合应考虑不确定度，而不是无条件取平均。',
    question: '无偏、独立测量中，方差较小的传感器应该怎样？', answers: ['权重更大', '权重更小'], correct: 0, reason: '一维独立高斯融合按精度即1/方差加权；前提是误差模型可信。',
    params: [range('sigmaA', '传感器A标准差', .1, 2, .3, .1, 'm'), range('sigmaB', '传感器B标准差', .1, 2, 1, .1, 'm'), range('bias', 'A未建模偏置', -2, 2, 0, .1, 'm')],
    initial: () => ({ tick: 0, measurementA: 5, measurementB: 5 }),
    step({ state, params }) { state.tick += 1; state.measurementA = 5 + params.bias + params.sigmaA * Math.sin(state.tick * 1.7); state.measurementB = 5 + params.sigmaB * Math.cos(state.tick * 2.3); },
    render({ svg, state, params }) { const weight = params.sigmaB ** 2 / (params.sigmaA ** 2 + params.sigmaB ** 2); const fused = weight * state.measurementA + (1 - weight) * state.measurementB; bars(svg, [['A测量', state.measurementA, 'm', 9], ['B测量', state.measurementB, 'm', 9, colors.orange], ['融合结果', fused, 'm', 9, colors.teal]]); text(svg, 320, 240, `A权重 ${number(weight * 100, 1)}% · 真值5m`); return `融合值${number(fused)}m，误差${number(fused - 5)}m。提高A置信度会增加其权重，但若A存在未建模偏置，就会更相信错误值。参数调整权重即时生效，下一单步按新噪声参数生成测量。`; }, boundary: '演示一维精度加权，不是完整EKF；扰动为确定性函数，未建模测量相关性，不能用此图证明统计最优。'
  });
  specs.push({
    id: 'time-sync', chapter: '09', title: '时间对齐：别把昨天的照片叠在今天的位置', intro: '像给行驶汽车拍照：相机记录的是曝光时的位置，不能随手配上几百毫秒之后的里程计。',
    question: '车辆运动时，用最新TF替代观测时间TF会怎样？', answers: ['可能产生空间错位', '永远更准确'], correct: 0, reason: '运动把时间偏差转化为空间偏差，应按观测时间查变换或做合适的插值。',
    params: [range('speed', '车辆速度', 0, 3, 1, .1, 'm/s'), range('skew', '时间错位', 0, 500, 200, 10, 'ms'), choice('align', '融合使用的时刻', [['latest', '直接使用最新状态'], ['stamp', '按观测时间对齐']])],
    initial: () => ({ tick: 0 }), step({ state }) { state.tick += 1; },
    render({ svg, params, state }) { const error = params.align === 'stamp' ? 0 : params.speed * params.skew / 1000; const truth = 3; line(svg, 60, 150, 580, 150); dot(svg, 150, 150, 12, colors.blue); dot(svg, 450, 150, 11, colors.teal); dot(svg, 450 + error * 80, 150, 7, colors.orange); text(svg, 150, 100, '相机曝光位置'); text(svg, 450, 205, '固定路标真值'); text(svg, 320, 35, `叠加误差 ${number(error, 3)}m · 第${state.tick}次匹配`); return `错位距离=vΔt=${number(params.speed * params.skew / 1000, 3)}m。${params.align === 'stamp' ? '本模型使用精确历史状态，已消除该项误差。' : '把旧观测与新位姿拼接，固定路标也会看起来漂移。'}真实系统还需要统一时钟源、正确header.stamp和足够TF缓存。`; }, boundary: '恒速一维、历史状态完全准确；未模拟旋转、外参误差、时间同步器配对窗口和插值误差。'
  });
  specs.push({
    id: 'scan-match', chapter: '10', title: '扫描匹配：移动点云让墙对齐', intro: '像把两张半透明地图叠起来，平移到墙边重合。不是每张图都有足够特征；长走廊的一些方向很难判断。',
    question: '只有平行走廊墙壁时，沿走廊方向一定能精确定位吗？', answers: ['不一定，可能约束不足', '只要雷达点多就一定能'], correct: 0, reason: '几何特征分布决定可观测方向，增加重复平行特征不一定补足约束。',
    params: [range('offset', '估计平移', -1, 1, .7, .05, 'm'), range('gain', '每步修正比例', .1, 1, .4, .1, ''), choice('scene', '场景几何', [['corner', '有墙角'], ['corridor', '仅平行走廊']])],
    initial: () => ({ iterations: 0 }),
    step(lab) { lab.state.iterations += 1; if (lab.params.scene === 'corner') { lab.params.offset = Math.round(lab.params.offset * (1 - lab.params.gain) * 1000) / 1000; lab.controls.forEach(sync => sync()); } },
    render({ svg, params, state }) { const correction = params.offset * 90; line(svg, 120, 65, 540, 65, colors.teal, 4); line(svg, 120, 185, 540, 185, colors.teal, 4); if (params.scene === 'corner') line(svg, 120, 65, 120, 185, colors.teal, 4); for (let index = 0; index < 13; index += 1) { dot(svg, 130 + index * 25 + correction, 65, 4, colors.orange); dot(svg, 130 + index * 25 + correction, 185, 4, colors.orange); } if (params.scene === 'corner') for (let index = 0; index < 7; index += 1) dot(svg, 120 + correction, 65 + index * 20, 4, colors.orange); text(svg, 320, 230, `平移误差 ${number(params.offset, 3)}m · 迭代${state.iterations}`); return params.scene === 'corner' ? `墙角提供沿走廊方向的约束，每步把误差乘${number(1 - params.gain, 1)}，逐渐对齐。图中绿色为地图，橙色为扫描点。` : '模型将无限平行墙沿走廊方向视为无约束，单步不会凭空得到修正。需要额外几何、里程计或其他观测。'; }, boundary: '已知正确对应关系、只有一个平移自由度，不实现ICP或NDT；走廊墙按无限延伸处理，忽略端点特征。'
  });
  specs.push({
    id: 'occupancy', chapter: '10', title: '占据概率：同一格多次观测如何积累证据', intro: '像投票：看到障碍投占据票，光线穿过投空闲票。未知是没有足够证据，不等于可以放心通过。',
    question: '从未观测的栅格应该直接当作空闲吗？', answers: ['不应该，仍是未知', '应该，没看到就是没有'], correct: 0, reason: '缺少证据与空闲证据不同；导航是否允许经过未知区域是另一个策略问题。',
    params: [choice('observation', '本次观测', [['hit', '终点命中障碍'], ['free', '射线穿过'], ['none', '没有观测']]), range('strength', '单次证据强度', .2, 1.5, .8, .1, 'log-odds')],
    initial: () => ({ evidence: 0, seen: false, readings: 0 }),
    step({ state, params }) { state.readings += 1; if (params.observation !== 'none') { state.seen = true; state.evidence = clamp(state.evidence + (params.observation === 'hit' ? params.strength : -params.strength), -5, 5); } },
    render({ svg, state }) { const probability = 1 / (1 + Math.exp(-state.evidence)); const fill = !state.seen ? '#b5bdca' : `rgb(${Math.round(240 - probability * 160)},${Math.round(245 - probability * 170)},${Math.round(250 - probability * 175)})`; shape(svg, 'rect', { x: 250, y: 35, width: 140, height: 140, rx: 8, fill, stroke: colors.ink, 'stroke-width': 2 }); text(svg, 320, 205, state.seen ? `占据概率 ${(probability * 100).toFixed(1)}%` : '未知：尚无观测'); return `log-odds累计${number(state.evidence)}，p=1/(1+exp(-L))=${number(probability, 3)}。${state.seen ? '切换命中与穿过，观察相反证据如何改变概率；重复观测并不一定相互独立。' : '初始数值0.5只表示无偏先验，单独保留未知标记。'}证据在±5截断，避免无限确信。`; }, boundary: '单栅格逆传感器模型；未实现整幅射线更新、测量相关性、动态目标消除或SLAM定位。'
  });
  specs.push({
    id: 'particles', chapter: '11', title: '粒子定位：保留多个“我可能在这里”', intro: '像在相似的走廊里找房间：先保留多个猜测，看到门牌后再给更合理的猜测更高权重。',
    question: '定位粒子集中成一簇，是否一定说明位置正确？', answers: ['不一定，可能过度自信或收敛错误', '一定正确'], correct: 0, reason: '粒子集中只说明模型内部假设一致；观测歧义、地图变化与错误噪声模型仍可造成错误定位。',
    params: [range('sigma', '测距标准差', .2, 2, .7, .1, 'm'), choice('ambiguity', '可观测特征', [['unique', '唯一墙面距离'], ['repeat', '左右对称特征']])],
    initial: () => ({ weights: Array(21).fill(1 / 21), rounds: 0 }),
    step({ state, params }) { state.rounds += 1; const posterior = state.weights.map((weight, index) => { const position = index / 2; const error = params.ambiguity === 'repeat' ? Math.min(Math.abs(position - 3), Math.abs(position - 7)) : Math.abs(position - 3); return weight * Math.exp(-(error ** 2) / (2 * params.sigma ** 2)); }); const total = posterior.reduce((sum, value) => sum + value, 0); state.weights = total > 0 ? posterior.map(value => value / total) : Array(21).fill(1 / 21); },
    render({ svg, state }) { line(svg, 55, 155, 585, 155); state.weights.forEach((weight, index) => dot(svg, 60 + index * 26, 155, 3 + Math.sqrt(weight) * 28, colors.blue)); text(svg, 216, 85, '真值3m', colors.teal); line(svg, 216, 95, 216, 135, colors.teal); text(svg, 60, 210, '0m'); text(svg, 580, 210, '10m'); const mean = state.weights.reduce((sum, weight, index) => sum + weight * index / 2, 0); const effective = 1 / state.weights.reduce((sum, weight) => sum + weight ** 2, 0); return `观测更新${state.rounds}次，加权均值${number(mean)}m，有效样本数${number(effective, 1)}/21。对称场景可能保留3m与7m两个峰，均值却落在5m；因此不能只看均值。先重置，再选择另一场景比较。`; }, boundary: '离散固定假设的贝叶斯权重更新，不含AMCL运动模型、重采样或自适应粒子数；重复同一证据会夸大确信。'
  });
  specs.push({
    id: 'dynamic-obstacle', chapter: '11', title: '动态障碍：能看见，还要来得及停下', intro: '像骑车遇到行人：反应时间内仍在前进，踩刹车后还需要制动距离。仅仅画出一条绕行线并不代表可执行。',
    question: '速度翻倍、减速度不变，制动距离约变几倍？', answers: ['2倍', '4倍'], correct: 1, reason: '匀减速制动距离v²/(2a)，另需加上延迟期间的vτ。',
    params: [range('speed', '当前速度', .2, 2, 1, .1, 'm/s'), range('deceleration', '可用减速度', .2, 2, .8, .1, 'm/s²'), range('delay', '感知与控制延迟', 0, 1, .3, .1, 's'), range('gap', '障碍初始距离', .5, 5, 2, .1, 'm')],
    initial: () => ({ time: 0 }), step({ state }) { state.time += .2; },
    render({ svg, params, state }) { const elapsedBraking = Math.max(0, state.time - params.delay); const stopTime = params.speed / params.deceleration; const brakingTime = Math.min(elapsedBraking, stopTime); const traveled = params.speed * Math.min(state.time, params.delay) + params.speed * brakingTime - .5 * params.deceleration * brakingTime ** 2; const required = params.speed * params.delay + params.speed ** 2 / (2 * params.deceleration); const currentSpeed = state.time < params.delay ? params.speed : Math.max(0, params.speed - params.deceleration * elapsedBraking); const scale = 480 / Math.max(5, required + .5, params.gap); line(svg, 50, 150, 595, 150); box(svg, 50 + traveled * scale, 120, 50, 40, '车'); box(svg, 50 + params.gap * scale, 75, 22, 100, '障', colors.red); text(svg, 320, 220, `所需停止距离 ${number(required)}m · 剩余间隔 ${number(params.gap - traveled)}m`); return `t=${number(state.time, 1)}s，速度${number(currentSpeed)}m/s。停止距离=vτ+v²/(2a)=${number(required)}m；${required >= params.gap ? '当前条件无法在障碍前停住，应提前降速或增大观测距离。' : '此理想模型可在障碍前停止，仍须考虑车体外形与裕量。'}修改参数会重新计算整次制动演示。`; }, boundary: '障碍物突然出现在给定距离后保持静止，机器人一维匀减速；不实现Nav2局部控制器或动态人群预测。'
  });
  specs.push({
    id: 'project-checklist', chapter: '12', title: '项目验收：把“能跑”拆成可检查证据', intro: '像飞机起飞前逐项检查：单次演示成功，只说明一次条件下成功。项目需要记录接口、时间、停止机制和复现实验。',
    question: '五项只通过四项，应该怎样报告？', answers: ['按真实通过项与缺失证据报告', '平均分够高就宣布全部完成'], correct: 0, reason: '验收依赖明确证据，关键缺项不能被其他项目的高分抵消。',
    params: [range('trials', '每个场景要求重复次数', 1, 5, 3, 1, '次')],
    initial: () => ({ checks: [false, false, false, false, false], trials: 0 }),
    setup(lab) { const labels = ['接口与单位已核对', '时间戳/TF连通已验证', '异常与掉线已验证', '停止与恢复已验证', '环境/参数/日志已保存']; const inputs = []; labels.forEach((label, index) => { const holder = node('label', 'rl2-check'); const input = node('input'); input.type = 'checkbox'; input.id = `${lab.panel.id}-check-${index}`; holder.htmlFor = input.id; input.addEventListener('change', () => { lab.state.checks[index] = input.checked; draw(lab); }); holder.append(input, node('span', '', label)); lab.extra.append(holder); inputs.push(input); }); lab.resetExtra = () => inputs.forEach(input => { input.checked = false; }); },
    step({ state }) { if (state.checks.every(Boolean)) state.trials += 1; },
    render({ svg, state, params }) { const completed = state.checks.filter(Boolean).length; bars(svg, [['有证据的项目', completed, '/5', 5], ['模拟重复场景', state.trials, '次', Math.max(params.trials, state.trials), colors.teal]]); return completed < 5 ? `还缺${5 - completed}项证据。勾选表示你已经完成对应验证，不会自动执行真实测试。单步只有在清单齐全时才记录一次模拟场景。` : state.trials < params.trials ? `清单齐全，场景重复${state.trials}/${params.trials}次。继续比较异常条件，不要只重复同一段正常流程。` : `教学验收条件达到：5项清单与${state.trials}次场景。实际交付还需真实日志与可复现步骤作为证据。`; }, boundary: '浏览器内验收流程练习，不连接硬件、不替代真实测试，不自动宣称项目已合格；刷新页面不保存勾选。'
  });
  specs.push({
    id: 'incident-review', chapter: '12', title: '故障复盘：用证据缩小范围', intro: '像医生看检查结果：先找第一处不符合预期的环节，再决定下一次检查，避免同时改十个参数。',
    question: '话题已收到，但时间戳过期，最优先检查什么？', answers: ['时钟源与数据延迟', '先更换路径规划算法'], correct: 0, reason: '已有证据指向时间链路，应先检查时钟、时间戳和队列延迟。',
    params: [choice('fault', '注入故障', [['qos', 'QoS不匹配'], ['clock', '观测时间过期'], ['tf', 'TF链断开'], ['planner', '目标不可达']]), choice('probe', '本步检查', [['transport', '检查连接与消息'], ['stamp', '检查时间戳'], ['transform', '检查TF'], ['goal', '检查目标与地图']])],
    initial: () => ({ probes: 0, evidence: [], resolved: false }),
    onParam(lab, key) { if (key === 'fault') { lab.state.evidence = []; lab.state.resolved = false; lab.state.probes = 0; } },
    step({ state, params }) { state.probes += 1; const target = { qos: 'transport', clock: 'stamp', tf: 'transform', planner: 'goal' }[params.fault]; const names = { transport: '连接/消息', stamp: '时间戳', transform: 'TF', goal: '目标/地图' }; const found = target === params.probe; state.evidence.push(`${names[params.probe]}：${found ? '发现异常' : '本项通过'}`); if (state.evidence.length > 4) state.evidence.shift(); state.resolved = state.resolved || found; },
    render({ svg, state }) { state.evidence.forEach((entry, index) => box(svg, 80, 16 + index * 55, 480, 42, entry, entry.includes('异常') ? colors.red : colors.teal)); if (!state.evidence.length) text(svg, 320, 125, '选择故障与检查项，单步收集证据'); return `执行${state.probes}次检查。${state.resolved ? '已定位模拟异常层；下一步写清触发条件、修复动作和回归检查，而不是只写“重启好了”。' : '尚未检查到异常层。连接、时间、TF、规划逐层验证，每次保留结果。'}切换故障会清空证据，方便比较排查顺序。`; }, boundary: '每次仅注入一个已知故障，真实系统可能多个故障并存；通过某项检查不表示该子系统所有路径都正确。'
  });
  specs.forEach(createLab);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { const lab = labs.find(item => item.panel === entry.target); if (lab) { lab.visible = entry.isIntersecting; lab.elapsed = 0; } });
      schedule();
    }, { threshold: 0 });
    labs.forEach(lab => observer.observe(lab.panel));
  } else {
    const updateVisibility = () => { labs.forEach(lab => { const rect = lab.panel.getBoundingClientRect(); lab.visible = rect.bottom > 0 && rect.top < window.innerHeight; }); schedule(); };
    window.addEventListener('scroll', updateVisibility, { passive: true }); window.addEventListener('resize', updateVisibility); updateVisibility();
  }
  function pauseAll() { labs.forEach(lab => { lab.playing = false; syncPlay(lab); }); schedule(); }
  document.addEventListener('ros-motion-change', event => { globalPaused = Boolean(event.detail && event.detail.paused); if (globalPaused) pauseAll(); else schedule(); });
  motionPreference.addEventListener('change', () => { if (motionPreference.matches) pauseAll(); else schedule(); });
  document.addEventListener('visibilitychange', schedule);
})();

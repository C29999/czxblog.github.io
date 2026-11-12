(() => {
  'use strict';
  const root = document.getElementById('book-labs');
  if (!root) return;
  root.classList.add('rl-labs');
  const namespace = 'http://www.w3.org/2000/svg';
  const labs = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let globalPaused = document.documentElement.classList.contains('motion-paused');
  let lastFrame = 0;
  let frameHandle = 0;
  const color = { purple:'#6951bf', teal:'#087f8c', orange:'#d97c37', red:'#ca5665', ink:'#36475e', faint:'#dfe5ee' };
  function element(tag, attributes = {}, text = '') {
    const item = document.createElementNS(namespace, tag);
    Object.entries(attributes).forEach(([name,value]) => item.setAttribute(name,value));
    if (text) item.textContent = text;
    return item;
  }
  function append(parent, tag, attributes, text) { const child = element(tag,attributes,text); parent.appendChild(child); return child; }
  function line(parent, startX, startY, endX, endY, stroke = color.faint, width = 2, extra = {}) { return append(parent,'line',{x1:startX,y1:startY,x2:endX,y2:endY,stroke,'stroke-width':width,...extra}); }
  function circle(parent, centerX, centerY, radius, fill, extra = {}) { return append(parent,'circle',{cx:centerX,cy:centerY,r:radius,fill,...extra}); }
  function label(parent, positionX, positionY, text, fill = color.ink, size = 15, extra = {}) { return append(parent,'text',{x:positionX,y:positionY,fill,'font-size':size,'text-anchor':'middle',...extra},text); }
  function grid(svg) { for(let coord=20;coord<640;coord+=20) line(svg,coord,0,coord,320,'#f0f3f7',1); for(let coord=20;coord<320;coord+=20) line(svg,0,coord,640,coord,'#f0f3f7',1); }
  function button(parent, title, callback, pressed) { const control=document.createElement('button'); control.type='button'; control.className='rl-button'; control.textContent=title; if(pressed!==undefined) control.setAttribute('aria-pressed',String(pressed)); control.addEventListener('click',callback); parent.appendChild(control); return control; }
  function createLab(id,title,analogy,boundary) {
    const panel=document.createElement('article'); panel.className='rl-lab'; panel.id=`rl-${id}`;
    panel.innerHTML=`<header class="rl-head"><div><p class="rl-kicker">INTERACTIVE LAB · ${labs.length+1}</p><h3>${title}</h3></div></header><p class="rl-analogy">${analogy}</p><div class="rl-inputs"></div><div class="rl-stage"><svg viewBox="0 0 640 320" role="img" aria-label="${title}的可操作教学示意图"></svg></div><div class="rl-controls"></div><p class="rl-readout"></p><p class="rl-boundary">简化边界：${boundary}</p>`;
    root.appendChild(panel);
    const lab={panel,svg:panel.querySelector('svg'),inputs:panel.querySelector('.rl-inputs'),controls:panel.querySelector('.rl-controls'),readout:panel.querySelector('.rl-readout'),playing:false,visible:false,elapsed:0,step:()=>{},draw:()=>{},reset:()=>{}};
    lab.playButton=button(lab.controls,'播放',()=>{ if(globalPaused) { lab.readout.textContent='全局动画已暂停，请先在阅读工具栏恢复动画。'; return; } lab.playing=!lab.playing; lab.playButton.textContent=lab.playing?'暂停':'播放'; lab.playButton.setAttribute('aria-pressed',String(lab.playing)); scheduleFrame(); },false);
    button(lab.controls,'单步',()=>{ lab.step(); lab.draw(); });
    button(lab.controls,'重置',()=>{ lab.playing=false; lab.playButton.textContent='播放'; lab.playButton.setAttribute('aria-pressed','false'); lab.reset(); lab.draw(); scheduleFrame(); });
    labs.push(lab); return lab;
  }
  function slider(lab,title,min,max,initial,step,unit,onChange) {
    const holder=document.createElement('label'); holder.className='rl-control';
    const caption=document.createElement('span'); const captionText=document.createElement('span'); captionText.textContent=title; const output=document.createElement('output');
    caption.append(captionText,output); const input=document.createElement('input'); input.type='range'; input.min=min; input.max=max; input.step=step; input.value=initial;
    holder.append(caption,input); lab.inputs.appendChild(holder);
    const sync=()=>{output.textContent=`${Number(input.value)} ${unit}`; onChange(Number(input.value)); lab.draw();}; input.addEventListener('input',sync); output.textContent=`${initial} ${unit}`;
    return { input, set(value) { input.value=value; output.textContent=`${Number(input.value)} ${unit}`; } };
  }
  const communication=createLab('communication','一条消息的旅行：Topic / Service / Action','Topic 像广播电台；Service 像窗口办事；Action 像叫车订单：可以看进度，也可以取消。切换模式，再单步观察不同的消息方向。','图中只表达逻辑消息方向，不模拟网络发现、传输延迟或线程。原书 ROS 1 由 Master 提供节点注册和发现，业务数据通常在节点之间传输；ROS 2 常用 DDS 进行分布式发现和通信。Action 的反馈、状态和结果在底层使用多条接口，两个版本的实现不同。');
  let communicationMode='Topic'; let communicationStep=0; let cancelled=false;
  const tabs=document.createElement('div'); tabs.className='rl-tabs'; communication.inputs.before(tabs);
  const modeButtons=['Topic','Service','Action'].map(mode=>button(tabs,mode,()=>{communicationMode=mode;communicationStep=0;cancelled=false;modeButtons.forEach(control=>control.setAttribute('aria-pressed',String(control.textContent===mode)));communication.draw();},mode==='Topic'));
  button(communication.controls,'取消 Action',()=>{if(communicationMode==='Action'){cancelled=true;communication.draw();}else communication.readout.textContent='只有 Action 提供这里演示的长任务取消机制。先切换到 Action。';});
  const communicationStates={Topic:['发布者生成消息','消息进入 /scan 话题','所有订阅者收到同一消息','无需逐个等待业务回复'],Service:['客户端准备请求','请求发给服务端','服务端处理并生成响应','响应返回客户端'],Action:['客户端发送导航目标','服务端接受目标','执行中：反馈已完成 40%','执行中：反馈已完成 80%','任务完成：返回最终结果']};
  communication.step=()=>{if(!cancelled) communicationStep=(communicationStep+1)%communicationStates[communicationMode].length;};
  communication.reset=()=>{communicationStep=0;cancelled=false;};
  communication.draw=()=>{
    const svg=communication.svg; svg.replaceChildren(); grid(svg);
    const nodes=communicationMode==='Topic'?['发布者','订阅者 A','订阅者 B']:['客户端','服务端'];
    const isReturn=communicationMode!=='Topic'&&communicationStep>=2;
    line(svg,135,150,500,150,isReturn?color.orange:color.purple,4);
    if(communicationMode==='Topic') line(svg,320,150,500,240,color.teal,3);
    const messageX=cancelled?320:communicationStep===0?160:communicationStep===1?320:isReturn?230:440;
    circle(svg,messageX,150,13,cancelled?color.red:color.orange);
    nodes.forEach((name,index)=>{const nodeX=index===0?95:545; const nodeY=index===2?240:150; append(svg,'rect',{x:nodeX-65,y:nodeY-30,width:130,height:60,rx:12,fill:'#fff',stroke:color.purple,'stroke-width':2});label(svg,nodeX,nodeY+5,name);});
    label(svg,320,55,communicationMode==='Topic'?'/scan · 一对多广播':communicationMode==='Service'?'request → / response ←':'goal → / feedback、result ←',color.purple,18);
    label(svg,320,290,cancelled?'已请求取消：停止继续执行':communicationStates[communicationMode][communicationStep],cancelled?color.red:color.ink,18);
    if(communicationMode==='Topic'&&communicationStep===2) circle(svg,440,216,10,color.teal);
    communication.readout.textContent=cancelled?'取消不是撤回已经完成的动作；服务端需要接受取消请求并安全停止。':`第 ${communicationStep+1} 步：${communicationStates[communicationMode][communicationStep]}。${communicationMode==='Topic'?'发布者并不需要知道每个订阅者的业务身份。':communicationMode==='Service'?'响应与这次请求关联；长时间任务更适合 Action。':'反馈可以连续到达，最终结果只表示一次任务的结束。'}`;
  };
  const transform=createLab('tf','TF2 坐标翻译：车上的点在地图哪里？','把地图当城市地图，把车体坐标当“从我脚下向前几步”。平移决定你站在哪里，旋转决定你面朝哪里；同一个点只是换了一套地址。','二维刚体变换教学：地图 X 向右、Y 向上。真实 TF2 使用三维平移、四元数和带时间的变换树；此处不模拟时间缓存。');
  const transformState={positionX:1,positionY:0,angle:30};
  const transformSliders=[slider(transform,'车体在地图中的 X',-3,3,1,.1,'m',value=>transformState.positionX=value),slider(transform,'车体在地图中的 Y',-2,2,0,.1,'m',value=>transformState.positionY=value),slider(transform,'车体朝向 θ',-180,180,30,1,'°',value=>transformState.angle=value)];
  transform.step=()=>{transformState.angle=((transformState.angle+185)%360)-180;transformSliders[2].set(transformState.angle);};
  transform.reset=()=>{Object.assign(transformState,{positionX:1,positionY:0,angle:30});[1,0,30].forEach((value,index)=>transformSliders[index].set(value));};
  transform.draw=()=>{
    const svg=transform.svg;svg.replaceChildren();grid(svg); const originX=320,originY=170; const radians=transformState.angle*Math.PI/180;
    line(svg,60,originY,600,originY,'#bac6d6');line(svg,originX,290,originX,30,'#bac6d6');label(svg,603,193,'X',color.ink);label(svg,339,30,'Y',color.ink);
    const worldX=transformState.positionX+2*Math.cos(radians)-Math.sin(radians),worldY=transformState.positionY+2*Math.sin(radians)+Math.cos(radians);
    const scale=Math.min(40,110/(Math.abs(worldY)+.2),230/(Math.abs(worldX)+.2));
    const baseX=originX+transformState.positionX*scale,baseY=originY-transformState.positionY*scale;
    const pointX=originX+worldX*scale,pointY=originY-worldY*scale;
    line(svg,originX,originY,baseX,baseY,color.orange,3);circle(svg,baseX,baseY,16,color.purple);line(svg,baseX,baseY,baseX+50*Math.cos(radians),baseY-50*Math.sin(radians),color.purple,5);
    line(svg,baseX,baseY,pointX,pointY,color.teal,3,{'stroke-dasharray':'6 5'});circle(svg,pointX,pointY,9,color.teal);label(svg,Math.max(115,Math.min(525,pointX)),Math.max(35,pointY-16),'P 车体坐标 (2,1)',color.teal,14);label(svg,baseX,Math.min(305,baseY+36),'base_link',color.purple,14);label(svg,70,28,'map',color.ink,15);
    transform.readout.textContent=`地图坐标 P = (${worldX.toFixed(2)}, ${worldY.toFixed(2)}) m。x = tx + 2 cosθ − 1 sinθ；y = ty + 2 sinθ + 1 cosθ。先旋转，再加平移；顺序不能随意交换。视图自动缩放以保持坐标点可见，背景网格仅作视觉参考。`;
  };
  const drive=createLab('drive','差速底盘：两只轮子怎样转弯？','像两个人并排划船：两侧同样快就直走，一侧快就转弯；一前一后能原地转。这里速度是车轮接地点的线速度。','理想平面无侧滑模型，轮距固定 0.5 m，积分步长 0.15 s。没有电机惯性、打滑、编码器误差或碰撞；轨迹到达画布边缘后会裁切。');
  const driveState={left:.5,right:.8,positionX:0,positionY:0,angle:0,time:0,path:[]};
  const driveSliders=[slider(drive,'左轮速度 vL',-1.5,1.5,.5,.1,'m/s',value=>driveState.left=value),slider(drive,'右轮速度 vR',-1.5,1.5,.8,.1,'m/s',value=>driveState.right=value)];
  drive.step=()=>{const velocity=(driveState.left+driveState.right)/2,omega=(driveState.right-driveState.left)/.5;driveState.angle+=omega*.075;driveState.positionX+=velocity*Math.cos(driveState.angle)*.15;driveState.positionY+=velocity*Math.sin(driveState.angle)*.15;driveState.angle+=omega*.075;driveState.time+=.15;driveState.path.push([320+driveState.positionX*45,160-driveState.positionY*45]);if(driveState.path.length>700)driveState.path.shift();};
  drive.reset=()=>{Object.assign(driveState,{left:.5,right:.8,positionX:0,positionY:0,angle:0,time:0,path:[]});driveSliders[0].set(.5);driveSliders[1].set(.8);};
  drive.draw=()=>{const svg=drive.svg;svg.replaceChildren();grid(svg);append(svg,'polyline',{points:[[320,160],...driveState.path].map(point=>point.join(',')).join(' '),fill:'none',stroke:color.teal,'stroke-width':3});const robot=append(svg,'g',{transform:`translate(${320+driveState.positionX*45} ${160-driveState.positionY*45}) rotate(${-driveState.angle*180/Math.PI})`});append(robot,'rect',{x:-19,y:-14,width:38,height:28,rx:8,fill:color.purple});append(robot,'rect',{x:-13,y:-20,width:26,height:6,rx:2,fill:color.ink});append(robot,'rect',{x:-13,y:14,width:26,height:6,rx:2,fill:color.ink});append(robot,'path',{d:'M 7 -6 L 16 0 L 7 6',fill:'none',stroke:'#fff','stroke-width':3});label(svg,125,28,'绿色：累计行驶轨迹',color.teal,14);drive.readout.textContent=`t=${driveState.time.toFixed(2)} s；v=(vR+vL)/2=${((driveState.left+driveState.right)/2).toFixed(2)} m/s；ω=(vR−vL)/0.5=${((driveState.right-driveState.left)/.5).toFixed(2)} rad/s。位置 (${driveState.positionX.toFixed(2)}, ${driveState.positionY.toFixed(2)}) m。`;};
  const laser=createLab('laser','激光建图：用一束光探出墙的位置','像在黑屋里伸出一根可伸缩的尺子：经过的地方暂时记为空闲，第一次碰到墙的地方记为障碍；没照到的地方仍然未知。','机器人位姿假定精确已知；射线遇到矩形障碍后停止。地图只是栅格状态示意，不是带噪声的占据概率更新，也不包含 SLAM 位姿估计。');
  const laserState={angle:0,cells:new Map(),hit:null}; const obstacles=[{left:400,top:70,width:45,height:180},{left:100,top:60,width:150,height:30},{left:100,top:240,width:210,height:25}];
  const laserSlider=slider(laser,'激光扫描角度',0,359,0,1,'°',value=>{laserState.angle=value;castRay();});
  function castRay(){const radians=laserState.angle*Math.PI/180;let hitX=300,hitY=160,blocked=false;for(let distance=0;distance<280;distance+=3){hitX=300+Math.cos(radians)*distance;hitY=160-Math.sin(radians)*distance;if(hitX<20||hitX>620||hitY<20||hitY>300)break;blocked=obstacles.some(obstacle=>hitX>=obstacle.left&&hitX<=obstacle.left+obstacle.width&&hitY>=obstacle.top&&hitY<=obstacle.top+obstacle.height);const key=`${Math.floor(hitX/10)},${Math.floor(hitY/10)}`;if(blocked){laserState.cells.set(key,'occupied');break;}if(laserState.cells.get(key)!=='occupied')laserState.cells.set(key,'free');}laserState.hit={positionX:hitX,positionY:hitY,blocked};}
  laser.step=()=>{laserState.angle=(laserState.angle+5)%360;laserSlider.set(laserState.angle);castRay();}; laser.reset=()=>{laserState.angle=0;laserState.cells.clear();laserSlider.set(0);castRay();};
  laser.draw=()=>{const svg=laser.svg;svg.replaceChildren();append(svg,'rect',{x:0,y:0,width:640,height:320,fill:'#e6eaf0'});laserState.cells.forEach((value,key)=>{const [cellX,cellY]=key.split(',').map(Number);append(svg,'rect',{x:cellX*10,y:cellY*10,width:9,height:9,fill:value==='occupied'?color.purple:'#fff'});});obstacles.forEach(obstacle=>append(svg,'rect',{x:obstacle.left,y:obstacle.top,width:obstacle.width,height:obstacle.height,fill:'none',stroke:'#abb5c4','stroke-dasharray':'4 4'}));if(laserState.hit){line(svg,300,160,laserState.hit.positionX,laserState.hit.positionY,color.orange,2);circle(svg,laserState.hit.positionX,laserState.hit.positionY,4,color.red);}circle(svg,300,160,10,color.teal);label(svg,320,307,'灰：未知 · 白：空闲 · 紫：占据 · 虚线：真实墙体',color.ink,13);laser.readout.textContent=`扫描 ${laserState.angle}°；已观测 ${laserState.cells.size} 个栅格。${laserState.hit?.blocked?'射线遇到墙面，末端标记为障碍。':'当前方向未命中障碍；量程以外仍然未知。'}旋转扫描会逐渐揭示环境。`;};castRay();
  const arm=createLab('arm','机械臂：两个关节如何决定手的位置？','像你的上臂和前臂：肩膀决定第一段朝向，肘关节在第一段的方向上继续转。第二段的世界角度是两个关节角相加。','二维两连杆正运动学，长度 L1=1 m、L2=0.8 m；不包含三维姿态、关节动力学、碰撞、奇异性求解或 MoveIt 规划。');
  const armState={first:35,second:65};const armSliders=[slider(arm,'关节 θ1',-180,180,35,1,'°',value=>armState.first=value),slider(arm,'关节 θ2（相对第一段）',-150,150,65,1,'°',value=>armState.second=value)];
  arm.step=()=>{armState.first=((armState.first+185)%360)-180;armSliders[0].set(armState.first);};arm.reset=()=>{armState.first=35;armState.second=65;armSliders[0].set(35);armSliders[1].set(65);};
  arm.draw=()=>{const svg=arm.svg;svg.replaceChildren();grid(svg);const firstRadians=armState.first*Math.PI/180,secondRadians=(armState.first+armState.second)*Math.PI/180;const elbowX=Math.cos(firstRadians),elbowY=Math.sin(firstRadians),endX=elbowX+.8*Math.cos(secondRadians),endY=elbowY+.8*Math.sin(secondRadians);circle(svg,320,165,135,'none',{stroke:'#d6deeb','stroke-dasharray':'5 5'});line(svg,320,165,320+elbowX*75,165-elbowY*75,color.purple,13);line(svg,320+elbowX*75,165-elbowY*75,320+endX*75,165-endY*75,color.teal,11);circle(svg,320,165,13,color.ink);circle(svg,320+elbowX*75,165-elbowY*75,10,color.orange);circle(svg,320+endX*75,165-endY*75,9,color.red);label(svg,320+endX*75,145-endY*75,'末端',color.red);label(svg,100,35,'紫：L1=1 m',color.purple);label(svg,520,35,'青：L2=0.8 m',color.teal);arm.readout.textContent=`末端 (${endX.toFixed(2)}, ${endY.toFixed(2)}) m；x=L1 cosθ1+L2 cos(θ1+θ2)，y=L1 sinθ1+L2 sin(θ1+θ2)。末端方向 ${(armState.first+armState.second).toFixed(0)}°。虚线圆表示最大伸展范围。`;};
  const navigation=createLab('navigation','导航膨胀层：给机器人留出安全距离','把机器人想成背着大书包的人：人眼看见的缝可能能过，但书包会卡住。把障碍向外“加厚”，就能用一个点代表整台机器人来规划。','20×10 网格、四邻接最短路径，欧氏距离硬膨胀；这里将机器人有效半径和安全余量合并为一个参数。真实导航通常有连续代价、足迹检查和局部控制，不等于这里的 BFS。');
  let inflation=1;let routeStep=0;let route=[];let navigationBlocked=new Set();const columns=20,rows=10;const start=[1,5],goal=[18,5];const wall=[];
  for(let row=0;row<rows;row++)if(row<3||row>6)wall.push([9,row]);
  const navigationSlider=slider(navigation,'有效安全半径',0,3,1,.25,'格',value=>{inflation=value;routeStep=0;calculateRoute();});
  function calculateRoute() {
    navigationBlocked=new Set();
    for(let row=0;row<rows;row++) for(let column=0;column<columns;column++) {
      if(wall.some(([wallX,wallY])=>Math.hypot(wallX-column,wallY-row)<=inflation)) navigationBlocked.add(`${column},${row}`);
    }
    const queue=[start],previous=new Map([[start.join(','),null]]);
    for(let index=0;index<queue.length;index++) {
      const current=queue[index];
      if(current[0]===goal[0]&&current[1]===goal[1]) break;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([deltaX,deltaY])=>{
        const next=[current[0]+deltaX,current[1]+deltaY],key=next.join(',');
        if(next[0]>=0&&next[0]<columns&&next[1]>=0&&next[1]<rows&&!navigationBlocked.has(key)&&!previous.has(key)) {
          previous.set(key,current); queue.push(next);
        }
      });
    }
    route=[];
    if(previous.has(goal.join(','))) {
      for(let current=goal;current;current=previous.get(current.join(','))) route.unshift(current);
    }
  }
  navigation.step=()=>{if(route.length)routeStep=(routeStep+1)%route.length;};navigation.reset=()=>{inflation=1;routeStep=0;navigationSlider.set(1);calculateRoute();};
  navigation.draw=()=>{const svg=navigation.svg;svg.replaceChildren();for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){const isWall=wall.some(([wallX,wallY])=>wallX===column&&wallY===row);append(svg,'rect',{x:20+column*30,y:10+row*30,width:29,height:29,rx:2,fill:isWall?color.ink:navigationBlocked.has(`${column},${row}`)?'#edc9bb':'#eff3f8'});}if(route.length)append(svg,'polyline',{points:route.map(([column,row])=>`${35+column*30},${25+row*30}`).join(' '),fill:'none',stroke:color.teal,'stroke-width':4});const robot=route[routeStep]||start;circle(svg,35+robot[0]*30,25+robot[1]*30,10,color.purple);circle(svg,35+goal[0]*30,25+goal[1]*30,9,color.orange);label(svg,80,34,'起点',color.purple,12);label(svg,574,34,'目标',color.orange,12);navigation.readout.textContent=`半径 ${inflation} 格；${route.length?`找到路径，共 ${route.length-1} 步。点击播放或单步看机器人穿过通道。`:'当前安全半径使通道关闭，没有可行路径。降低半径可查看变化，但真实机器人不能随意缩小足迹。'}深色是墙，浅橙色是膨胀障碍。`;};calculateRoute();
  labs.forEach(lab=>lab.draw());
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{const lab=labs.find(item=>item.panel===entry.target);if(lab)lab.visible=entry.isIntersecting;});scheduleFrame();},{threshold:.08});labs.forEach(lab=>observer.observe(lab.panel));
  function stopAll(){labs.forEach(lab=>{lab.playing=false;lab.playButton.textContent='播放';lab.playButton.setAttribute('aria-pressed','false');});scheduleFrame();}
  document.addEventListener('ros-motion-change',event=>{globalPaused=Boolean(event.detail?.paused);if(globalPaused)stopAll();});
  reduceMotion.addEventListener('change',event=>{if(event.matches)stopAll();});
  function scheduleFrame(){const active=!document.hidden&&!globalPaused&&labs.some(lab=>lab.playing&&lab.visible);if(active&&!frameHandle){lastFrame=performance.now();frameHandle=window.requestAnimationFrame(frame);}else if(!active&&frameHandle){window.cancelAnimationFrame(frameHandle);frameHandle=0;}}
  function frame(timestamp){frameHandle=0;const delta=Math.min(timestamp-lastFrame,100);lastFrame=timestamp;if(!document.hidden&&!globalPaused)labs.forEach(lab=>{if(!lab.playing||!lab.visible)return;lab.elapsed+=delta;const interval=lab===drive?150:lab===communication?900:120;if(lab.elapsed>=interval){lab.elapsed=0;lab.step();lab.draw();}});if(!document.hidden&&!globalPaused&&labs.some(lab=>lab.playing&&lab.visible))frameHandle=window.requestAnimationFrame(frame);}
  document.addEventListener('visibilitychange',scheduleFrame);
})();

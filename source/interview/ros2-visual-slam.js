/* Deterministic teaching scene. No ORB extraction, pose estimation or real telemetry. */
(() => {
  'use strict';
  const root = document.getElementById('vs-demo');
  if (!root) return;
  const canvases = [...root.querySelectorAll('canvas')];
  const contexts = canvases.map(canvas => canvas.getContext('2d'));
  const status = document.getElementById('vs-status');
  if (contexts.some(context => !context)) {
    status.textContent = '浏览器不支持 Canvas，请阅读下方文字笔记。';
    return;
  }
  const play = document.getElementById('vs-play');
  const step = document.getElementById('vs-step');
  const reset = document.getElementById('vs-reset');
  const timeline = document.getElementById('vs-time');
  const readout = document.getElementById('vs-readout');
  const count = document.getElementById('vs-points');
  const W = 640, H = 400, FPS = 20, LAST = 360;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvases.forEach((canvas, index) => {
    canvas.width = W * ratio;
    canvas.height = H * ratio;
    contexts[index].scale(ratio, ratio);
  });

  // World coordinates: x right, y up, z toward shore; units intentionally arbitrary.
  const buildings = [
    [-19, 31, 6, 6, '#b8cbd4'], [-11, 24, 5, 5, '#d3c2ad'],
    [-3, 30, 6, 9, '#a8c1ba'], [6, 26, 6, 6, '#d7b8a4'],
    [15, 35, 7, 8, '#b3bfd4'], [24, 30, 5, 5, '#c4cbb7']
  ];
  const points = [];
  const faces = [];
  buildings.forEach(([x, z, width, height, color]) => {
    faces.push({ vertices:[[x,0,z],[x+width,0,z],[x+width,height,z],[x,height,z]], color });
    faces.push({ vertices:[[x+width,0,z],[x+width,0,z+3],[x+width,height,z+3],[x+width,height,z]], color:'#839aa7' });
    faces.push({ vertices:[[x,height,z],[x+width,height,z],[x+width,height,z+3],[x,height,z+3]], color:'#dce3df' });
    for (let row = 1; row < height - .4; row += 1.7) {
      for (let col = .7; col < width - .4; col += 1.5) {
        const p = [x+col,row,z-.03];
        points.push(p, [p[0]+.65,p[1]+.7,p[2]]);
        faces.push({ vertices:[p,[p[0]+.65,row,z-.03],[p[0]+.65,row+.7,z-.03],[p[0],row+.7,z-.03]], color:'#4d697d' });
      }
    }
  });
  // Dock and posts add nearer geometry, making parallax visible.
  faces.push({ vertices:[[-15,0,17],[20,0,17],[20,0,21],[-15,0,21]], color:'#aaa08c' });
  for (let x = -14; x <= 20; x += 3.4) {
    faces.push({ vertices:[[x,0,17],[x+.25,0,17],[x+.25,1.2,17],[x,1.2,17]], color:'#756b5c' });
    points.push([x,1.2,17], [x+.25,0,17]);
  }

  function camera(frame) {
    const t = frame / LAST;
    return { x:-7+14*t, y:2.8+.08*Math.sin(t*Math.PI*4), z:1+2*Math.sin(t*Math.PI), yaw:.08*Math.sin(t*Math.PI*2) };
  }
  function project(p, cam) {
    const dx = p[0]-cam.x, dz = p[2]-cam.z;
    const x = Math.cos(cam.yaw)*dx-Math.sin(cam.yaw)*dz;
    const z = Math.sin(cam.yaw)*dx+Math.cos(cam.yaw)*dz;
    return { x:W/2+390*x/z, y:158-390*(p[1]-cam.y)/z, z };
  }
  function visible(p) { return p.z > .1 && p.x > 8 && p.x < W-8 && p.y > 8 && p.y < H-8; }
  function line(ctx, a, b, color, width = 1) {
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
    ctx.strokeStyle=color; ctx.lineWidth=width; ctx.stroke();
  }
  function dot(ctx, p, color, radius = 3) {
    ctx.beginPath(); ctx.arc(p.x,p.y,radius,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
  }
  function polygon(ctx, vertices, color) {
    ctx.beginPath(); vertices.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
    ctx.closePath(); ctx.fillStyle=color; ctx.fill();
  }
  function gray(hex) {
    const n = parseInt(hex.slice(1),16);
    const g = Math.round(((n>>16)*.299+((n>>8)&255)*.587+(n&255)*.114));
    return `rgb(${g},${g},${g})`;
  }
  const projected = Array.from({length:LAST+1}, (_, f) => points.map(p => project(p,camera(f))));
  // Reveal only landmarks seen with a temporal baseline and enough image displacement.
  // Their positions still come from the synthetic scene, not triangulation or ORB-SLAM3.
  const first = points.map(() => -1);
  const mappedAt = points.map(() => LAST+1);
  projected.forEach((frame, f) => frame.forEach((p,i) => {
    if (!visible(p)) return;
    if (first[i] < 0) first[i] = f;
    const start = projected[first[i]][i];
    if (f-first[i] >= 12 && Math.hypot(p.x-start.x,p.y-start.y) > 6 && mappedAt[i] > LAST) mappedAt[i] = f;
  }));

  function drawScene(ctx, frame, monochrome) {
    const cam=camera(frame), ink=hex => monochrome ? gray(hex) : hex;
    const sky=ctx.createLinearGradient(0,0,0,180);
    sky.addColorStop(0,ink('#c8dfe9')); sky.addColorStop(1,ink('#edf1e8'));
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=ink('#8bb6c1'); ctx.fillRect(0,169,W,H-169);
    polygon(ctx,[{x:0,y:169},{x:0,y:145},{x:60,y:133},{x:130,y:149},{x:200,y:127},{x:290,y:150},{x:390,y:130},{x:500,y:144},{x:580,y:121},{x:640,y:144},{x:640,y:169}],ink('#a5bbaf'));
    for (let i=0;i<17;i++) {
      const y=189+i*i*.7;
      for (let j=0;j<8;j++) {
        const x=j*96+Math.sin(i*2+frame*.025)*16;
        line(ctx,{x,y},{x:x+24+i,y:y-1},ink('#a9cbd0'),1.3);
      }
    }
    const sorted=faces.map(face => ({...face, projected:face.vertices.map(p=>project(p,cam)), depth:face.vertices.reduce((sum,p)=>sum+project(p,cam).z,0)/face.vertices.length})).sort((a,b)=>b.depth-a.depth);
    sorted.forEach(face => { if (face.projected.every(p=>p.z>.1)) polygon(ctx,face.projected,ink(face.color)); });
    polygon(ctx,[{x:200,y:400},{x:280,y:353},{x:360,y:353},{x:440,y:400}],ink('#edf0ed'));
    line(ctx,{x:280,y:353},{x:360,y:353},ink('#536d7d'),3);
    ctx.fillStyle=ink('#375366'); ctx.fillRect(306,373,28,14);
    // Camera reticle; no invented live-network measurements.
    ctx.strokeStyle=monochrome?'#ffffff80':'#ffffffb0'; ctx.lineWidth=1;
    ctx.strokeRect(16,16,W-32,H-32);
  }
  function drawMatches(ctx, frame) {
    drawScene(ctx,frame,true);
    const now=projected[frame], before=projected[Math.max(0,frame-FPS)];
    now.forEach((p,i) => {
      if (!visible(p)) return;
      if (visible(before[i]) && frame>0) {
        line(ctx,before[i],p,'#f6b651',1.7);
        ctx.strokeStyle='#f6b651'; ctx.lineWidth=1.3;
        ctx.strokeRect(before[i].x-2,before[i].y-2,4,4);
      }
      ctx.strokeStyle='#40e2bd'; ctx.lineWidth=1.5;
      ctx.strokeRect(p.x-3,p.y-3,6,6);
    });
  }
  function mapPoint(p) { return { x:320+p[0]*10-(p[2]-15)*3, y:350-p[2]*6-p[1]*8 }; }
  function drawMap(ctx, frame) {
    ctx.fillStyle='#192738'; ctx.fillRect(0,0,W,H);
    for (let x=-25;x<=30;x+=5) line(ctx,mapPoint([x,0,0]),mapPoint([x,0,45]),'#2a3b4f');
    for (let z=0;z<=45;z+=5) line(ctx,mapPoint([-25,0,z]),mapPoint([30,0,z]),'#2a3b4f');
    points.forEach((p,i) => { if (mappedAt[i]<=frame) dot(ctx,mapPoint(p),visible(projected[frame][i])?'#54d8ba':'#668491',2.7); });
    for (let f=1;f<=frame;f++) {
      const a=camera(f-1), b=camera(f);
      line(ctx,mapPoint([a.x,0,a.z]),mapPoint([b.x,0,b.z]),'#b5a0fc',2.5);
    }
    for (let f=0;f<=frame;f+=40) {
      const c=camera(f); dot(ctx,mapPoint([c.x,0,c.z]),'#c7b7ff',3);
    }
    const c=camera(frame), origin=mapPoint([c.x,0,c.z]);
    const ray=angle => mapPoint([c.x+Math.sin(c.yaw+angle)*8,0,c.z+Math.cos(c.yaw+angle)*8]);
    polygon(ctx,[origin,ray(-.53),ray(.53)],'#b2a0f72a');
    line(ctx,origin,ray(-.53),'#b5a0fc',1.5); line(ctx,origin,ray(.53),'#b5a0fc',1.5);
    dot(ctx,origin,'#f8db91',5);
    ctx.font='17px sans-serif'; ctx.fillStyle='#d4dfef';
    ctx.fillText(frame<12?'等待运动基线':'稀疏地标 · 合成坐标',22,30);
    ctx.font='14px sans-serif'; ctx.fillStyle='#97acc1'; ctx.fillText('任意尺度 / 斜俯视图',22,H-20);
  }

  let frame=0, playing=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let globalPaused=document.documentElement.classList.contains('motion-paused');
  let inView=false, raf=0, previous=0, elapsed=0;
  function render() {
    drawScene(contexts[0],frame,false); drawMatches(contexts[1],frame); drawMap(contexts[2],frame);
    canvases.forEach(canvas => { canvas.dataset.frame=String(frame); });
    timeline.value=String(frame);
    timeline.setAttribute('aria-valuetext',`${(frame/FPS).toFixed(1)} 秒，第 ${frame} 帧`);
    readout.textContent=`${(frame/FPS).toFixed(1)} / 18.0 s · 帧 ${String(frame).padStart(3,'0')}`;
    count.textContent=`已显示 ${mappedAt.filter(f=>f<=frame).length} 个合成地标`;
  }
  function updateControls() {
    play.textContent=playing?'暂停演示':'播放演示';
    play.setAttribute('aria-pressed',String(playing));
    play.disabled=globalPaused;
    status.textContent=globalPaused?'全局动画已暂停；可单步或拖动查看，恢复播放请使用页首动画开关。':playing?'三幅画面同步播放 · 18 秒后重新开始':'演示已暂停 · 可单步或拖动时间轴';
  }
  function tick(time) {
    raf=0;
    if (!playing || globalPaused || !inView || document.hidden) { previous=0; return; }
    if (previous) elapsed+=Math.min(time-previous,100);
    previous=time;
    if (elapsed>=1000/FPS) {
      const advance=Math.floor(elapsed/(1000/FPS)); elapsed%=1000/FPS;
      frame=(frame+advance)%(LAST+1); render();
    }
    raf=requestAnimationFrame(tick);
  }
  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf=0; previous=0; elapsed=0;
    if (playing && !globalPaused && inView && !document.hidden) raf=requestAnimationFrame(tick);
  }
  play.addEventListener('click',()=>{ playing=!playing; updateControls(); schedule(); });
  step.addEventListener('click',()=>{ playing=false; frame=(frame+1)%(LAST+1); render(); updateControls(); schedule(); });
  reset.addEventListener('click',()=>{ playing=false; frame=0; render(); updateControls(); schedule(); });
  timeline.addEventListener('input',()=>{ playing=false; frame=Number(timeline.value); render(); updateControls(); schedule(); });
  document.addEventListener('ros-motion-change',event=>{ globalPaused=event.detail.paused; updateControls(); schedule(); });
  document.addEventListener('visibilitychange',schedule);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries=>{ inView=entries[0].isIntersecting; schedule(); },{threshold:0}).observe(root);
  } else { inView=true; }
  root.classList.add('vs-ready');
  render(); updateControls(); schedule();
})();

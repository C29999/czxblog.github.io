(() => {
  'use strict';
  const motionButton = document.getElementById('motion-toggle');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = preference.matches;
  function updateMotion() {
    document.documentElement.classList.toggle('motion-paused', paused || document.hidden);
    motionButton.textContent = paused ? '允许动画播放' : '暂停全部动画';
    motionButton.setAttribute('aria-pressed', String(paused));
    document.dispatchEvent(new CustomEvent('ros-motion-change', { detail: { paused: paused || document.hidden } }));
  }
  motionButton.addEventListener('click', () => { paused = !paused; updateMotion(); });
  preference.addEventListener('change', event => { paused = event.matches; updateMotion(); });
  document.addEventListener('visibilitychange', updateMotion);
  updateMotion();

  const progress = document.getElementById('read-progress-bar');
  function updateProgress() {
    const maximum = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = `${maximum > 0 ? Math.min(100, window.scrollY / maximum * 100) : 0}%`;
  }
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  if ('ResizeObserver' in window) new ResizeObserver(updateProgress).observe(document.body);
  updateProgress();

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      const search = document.getElementById('rc-course-search');
      if (search) { event.preventDefault(); search.focus(); search.select(); }
    }
  });

  const sourcePages = [31, 52, 80, 164, 222, 291, 380, 441, 497, 641, 783, 838, 940, 1011];
  const experiments = {
    '02': [['rl-communication', '通信实验']],
    '03': [['rl-communication', '通信实验']],
    '04': [['rl-tf', '坐标实验']],
    '05': [['rl-drive', '差速实验']],
    '06': [['rl-drive', '差速实验'], ['rl-arm', '关节实验']],
    '09': [['rl-laser', '激光建图实验'], ['rl-navigation', '导航膨胀实验']],
    '10': [['rl-arm', '机械臂实验']],
    '12': [['rl-communication', 'Action 实验']]
  };
  [...(window.ROS_BOOK_CHAPTERS || []), ...(window.ROS_BOOK_MIDDLE || []), ...(window.ROS_BOOK_ADVANCED || [])].forEach(chapter => {
    const index = Number(chapter.id) - 1;
    const header = document.querySelector(`#rb-chapter-${chapter.id} .rb-chapter-header`);
    if (!header) return;
    const links = document.createElement('div');
    links.className = 'source-actions';
    const targets = [[`book-page-${sourcePages[index]}`, `对照原书第 ${sourcePages[index]} 页`], ...(experiments[chapter.id] || [])];
    targets.forEach(([id, label]) => {
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.className = 'rb-button';
      link.textContent = label;
      links.append(link);
    });
    header.append(links);
  });

  const outlineLinks = [...document.querySelectorAll('.outline-link')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);
      if (!visible.length) return;
      outlineLinks.forEach(link => {
        if (link.hash === `#${visible[0].target.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-5% 0px -65% 0px', threshold: 0 });
    outlineLinks.forEach(link => { const target = document.querySelector(link.hash); if (target) observer.observe(target); });
  }
})();

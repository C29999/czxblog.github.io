(function () {
  'use strict';

  const sidebar = document.querySelector('#reader-outline');
  const toggle = document.querySelector('.reader-nav-toggle');
  if (!sidebar || !toggle) return;

  const close = sidebar.querySelector('.reader-nav-close');
  const backdrop = document.querySelector('.reader-nav-backdrop');
  const navigation = sidebar.querySelector('.reader-nav-links');
  const background = [...document.querySelectorAll('.topbar,.learning-content,body > footer')];
  const compact = window.matchMedia('(max-width:719px)');
  const entries = [...navigation.querySelectorAll('a[href^="#"]')].map(link => ({
    link,
    target: document.getElementById(link.hash.slice(1))
  })).filter(entry => entry.target);
  let desktopOpen = true;
  let opened = !compact.matches;
  let current = null;
  let scheduled = false;

  function setOpen(value, moveFocus = false) {
    opened = value;
    if (!compact.matches) desktopOpen = value;
    document.body.classList.toggle('reader-nav-collapsed', !compact.matches && !value);
    document.body.classList.toggle('reader-nav-open', compact.matches && value);
    toggle.setAttribute('aria-expanded', String(value));
    sidebar.inert = !value;
    backdrop.hidden = !compact.matches || !value;
    background.forEach(element => { element.inert = compact.matches && value; });
    if (compact.matches && value) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
    }
    if (moveFocus) (value ? close : toggle).focus({ preventScroll: true });
  }

  function setCurrent(entry) {
    if (!entry || current === entry) return;
    if (current) current.link.removeAttribute('aria-current');
    current = entry;
    entry.link.setAttribute('aria-current', 'location');
    if (!opened) return;
    const linkBox = entry.link.getBoundingClientRect();
    const navBox = navigation.getBoundingClientRect();
    if (linkBox.top < navBox.top || linkBox.bottom > navBox.bottom) {
      navigation.scrollTop += linkBox.top - navBox.top - navigation.clientHeight / 2;
    }
  }

  function trackReading() {
    scheduled = false;
    let candidate = entries[0];
    let closest = -Infinity;
    for (const entry of entries) {
      const top = entry.target.getBoundingClientRect().top;
      if (top <= 112 && (top > closest + 1 || (Math.abs(top - closest) <= 1 && entry === current))) {
        candidate = entry;
        closest = top;
      }
    }
    setCurrent(candidate);
  }

  toggle.addEventListener('click', () => setOpen(!opened, true));
  close.addEventListener('click', () => setOpen(false, true));
  backdrop.addEventListener('click', () => setOpen(false, true));
  compact.addEventListener('change', () => {
    const focusInside = sidebar.contains(document.activeElement);
    setOpen(compact.matches ? false : desktopOpen, focusInside);
  });
  entries.forEach(entry => entry.link.addEventListener('click', () => {
    setCurrent(entry);
    if (compact.matches) setOpen(false, true);
  }));
  document.addEventListener('keydown', event => {
    if (!opened) return;
    if (event.key === 'Escape') {
      setOpen(false, true);
      return;
    }
    if (!compact.matches || event.key !== 'Tab') return;
    const focusable = [...sidebar.querySelectorAll('button,a[href]')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener('scroll', () => {
    if (!scheduled) {
      scheduled = true;
      window.requestAnimationFrame(trackReading);
    }
  }, { passive: true });
  window.addEventListener('resize', trackReading);
  window.addEventListener('hashchange', () => setCurrent(entries.find(entry => entry.link.hash === location.hash)));
  setOpen(opened);
  setCurrent(entries.find(entry => entry.link.hash === location.hash) || entries[0]);
  trackReading();
})();

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const number = value => new Intl.NumberFormat('zh-CN').format(value);
  const date = value => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  let days = 7, visitors = [], dailySeries = [], page = 0, controller, chartWidth = 0;
  const pageSize = 25;

  function cell(value, className) {
    const td = document.createElement('td');
    const text = document.createElement('span');
    text.textContent = value;
    if (className) text.className = className;
    td.append(text); return td;
  }
  function rows(id, data, render, columns) {
    const body = $(id); body.replaceChildren();
    if (!data.length) {
      const row = document.createElement('tr'), td = cell('暂无记录', 'empty');
      td.className = 'empty'; td.colSpan = columns; row.append(td); body.append(row); return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of data) { const row = document.createElement('tr'); row.append(...render(item)); fragment.append(row); }
    body.append(fragment);
  }
  function showVisitors() {
    const query = $('ip-search').value.trim().toLowerCase();
    const list = visitors.filter(item => item.ip.toLowerCase().includes(query));
    const pages = Math.max(1, Math.ceil(list.length / pageSize)); page = Math.min(page, pages - 1);
    rows('visitor-rows', list.slice(page * pageSize, (page + 1) * pageSize), item => [cell(item.ip), cell(number(item.views)), cell(number(item.clicks)), cell(date(item.firstSeen)), cell(date(item.lastSeen))], 5);
    $('visitor-page').textContent = `共 ${number(list.length)} 个 IP · 第 ${page + 1} / ${pages} 页`;
    $('previous').disabled = page === 0; $('next').disabled = page + 1 >= pages;
  }
  function chart(daily) {
    const ns = 'http://www.w3.org/2000/svg';
    function svgElement(tag, attrs, text) {
      const el = document.createElementNS(ns, tag);
      for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
      if (text !== undefined) el.textContent = text;
      return el;
    }
    const host = $('chart'), style = getComputedStyle(host);
    const canvasWidth = Math.max(240, Math.floor(host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    chartWidth = host.clientWidth;
    const svg = svgElement('svg', { viewBox: `0 0 ${canvasWidth} 240`, role: 'img', 'aria-label': `${days} 天访问和点击趋势，详细数值见下方每日数据` });
    const max = Math.max(4, ...daily.flatMap(item => [item.views, item.clicks]));
    const left = Math.max(34, number(max).length * 8 + 12), right = canvasWidth - 22;
    for (let i = 0; i <= 4; i++) {
      const y = 18 + i * 45;
      svg.append(svgElement('line', { x1: left, y1: y, x2: right, y2: y, class: 'grid' }));
      svg.append(svgElement('text', { x: left - 10, y: y + 5, 'text-anchor': 'end' }, number(Math.round(max * (4 - i) / 4))));
    }
    const step = (right - left) / Math.max(1, daily.length), width = Math.min(24, step * .32);
    const labelInterval = Math.ceil(daily.length / (canvasWidth < 500 ? 4 : 7));
    daily.forEach((item, index) => {
      const center = left + step * (index + .5);
      for (const [key, offset, cls] of [['views', -width, 'view-bar'], ['clicks', Math.min(1, step * .08), 'click-bar']]) {
        const height = item[key] / max * 180;
        const bar = svgElement('rect', { x: center + offset, y: 198 - height, width, height, rx: Math.min(3, width / 3), class: cls });
        bar.append(svgElement('title', {}, `${item.date} ${key === 'views' ? '浏览' : '点击'} ${item[key]}`)); svg.append(bar);
      }
      if (index % labelInterval === 0) svg.append(svgElement('text', { x: center, y: 226, 'text-anchor': 'middle' }, item.date.slice(5).replace('-', '/')));
    });
    $('chart').replaceChildren(svg);
  }
  function clear() {
    ['views', 'visitor-count', 'clicks'].forEach(id => { $(id).textContent = '—'; });
    ['page-rows', 'target-rows', 'visitor-rows', 'daily-rows', 'chart'].forEach(id => $(id).replaceChildren());
    visitors = []; dailySeries = []; showVisitors(); $('current-ip').textContent = '未验证'; $('updated').textContent = '尚未获取数据';
  }
  async function load() {
    controller?.abort(); const request = new AbortController(); controller = request;
    clear(); $('results').setAttribute('aria-busy', 'true'); $('refresh').disabled = true;
    $('status').className = 'status'; $('status').textContent = '正在读取统计数据…';
    document.querySelectorAll('[data-days]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.days) === days)));
    try {
      const result = await fetch(`/api/blog/stats?days=${days}`, { cache: 'no-store', credentials: 'omit', signal: request.signal });
      if (!result.ok) {
        const message = result.status === 403 ? '当前 IP 无权访问。请在部署平台更新 BLOG_OWNER_IPS 后重试。' : result.status === 503 ? '统计服务未就绪，请检查 IP 白名单和存储配置。' : '数据加载失败，请稍后重试。';
        let body; try { body = await result.json(); } catch {}
        throw new Error(result.status === 422 ? body?.error || message : message);
      }
      const data = await result.json();
      if (request.signal.aborted) return;
      $('views').textContent = number(data.totals.views); $('clicks').textContent = number(data.totals.clicks); $('visitor-count').textContent = number(data.totals.visitors);
      $('current-ip').textContent = data.currentIP; $('updated').textContent = `更新于 ${date(data.generatedAt)}`;
      dailySeries = data.daily; chart(dailySeries);
      rows('daily-rows', data.daily, item => [cell(item.date), cell(number(item.views)), cell(number(item.visitors)), cell(number(item.clicks))], 4);
      rows('page-rows', data.pages, item => [cell(item.key, 'path'), cell(number(item.count))], 2);
      rows('target-rows', data.targets, item => {
        const target = cell(item.target, 'path'), context = document.createElement('span');
        context.className = 'target-context'; context.textContent = `所在页面：${item.path}`; target.append(context);
        return [target, cell(number(item.count))];
      }, 2);
      visitors = data.visitors; page = 0; showVisitors();
      $('status').textContent = data.demo ? '本地演示数据 · 用于预览，不代表真实访客。' : data.detailOverflow ? `当前区间有 ${number(data.detailOverflow)} 次事件超出明细容量，已计入总量但未全部列入排行。` : data.totals.views || data.totals.clicks ? '已排除当前白名单内所有 IP 的访问与点击。' : '还没有访客记录。启用统计后，其他 IP 的访问会显示在这里。';
    } catch (error) {
      if (error.name === 'AbortError') return;
      $('status').className = 'status error'; $('status').textContent = error.message || '连接失败，请刷新重试。';
    } finally {
      if (controller === request) { $('results').setAttribute('aria-busy', 'false'); $('refresh').disabled = false; }
    }
  }
  document.querySelectorAll('[data-days]').forEach(button => button.addEventListener('click', () => { days = Number(button.dataset.days); load(); }));
  $('refresh').addEventListener('click', load);
  $('ip-search').addEventListener('input', () => { page = 0; showVisitors(); });
  $('previous').addEventListener('click', () => { page--; showVisitors(); });
  $('next').addEventListener('click', () => { page++; showVisitors(); });
  new ResizeObserver(() => {
    if (dailySeries.length && $('chart').clientWidth !== chartWidth) chart(dailySeries);
  }).observe($('chart'));
  load();
})();

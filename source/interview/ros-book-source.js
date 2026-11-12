(() => {
  'use strict';

  const root = document.getElementById('book-source-reader');
  if (!root) return;
  const scriptUrl = document.currentScript && document.currentScript.src;
  const dataUrl = new URL('ros-book-pages.js', scriptUrl || window.location.href).href;
  const pdfUrl = new URL('ros-book-original.pdf', scriptUrl || window.location.href).href;
  let pages = [];
  let normalizedPages = [];
  let currentPage = 1;
  let loadingPromise;
  let pdfVisible = false;
  let searchQuery = '';
  let requestedPage = 1;
  let requestVersion = 0;
  const chapterStarts = [
    { title: '初识 ROS', page: 31 },
    { title: 'ROS 架构', page: 52 },
    { title: 'ROS 基础', page: 80 },
    { title: 'ROS 中的常用组件', page: 164 },
    { title: '机器人平台搭建', page: 222 },
    { title: '机器人建模与仿真', page: 291 },
    { title: '机器视觉', page: 380 },
    { title: '机器语音', page: 441 },
    { title: '机器人 SLAM 与自主导航', page: 497 },
    { title: 'MoveIt! 机械臂控制', page: 641 },
    { title: 'ROS 与机器学习', page: 783 },
    { title: 'ROS 进阶功能', page: 838 },
    { title: 'ROS 机器人实例', page: 940 },
    { title: 'ROS 2', page: 1011 }
  ];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function button(text, callback) {
    const node = element('button', 'rb-button', text);
    node.type = 'button';
    node.addEventListener('click', callback);
    return node;
  }

  function labelFor(text, control) {
    const label = element('label', 'rb-source-control', text);
    label.htmlFor = control.id;
    label.append(control);
    return label;
  }

  root.classList.add('rb-original-reader');
  const style = element('style');
  style.textContent = '#book-source-reader{margin-top:24px}#book-source-reader [hidden]{display:none!important}#book-source-reader .rb-source-controls{display:flex;flex-wrap:wrap;align-items:end;gap:12px;margin:16px 0}#book-source-reader .rb-source-control{display:grid;gap:5px;font-size:14px}#book-source-reader input,#book-source-reader select{max-width:100%;min-height:42px;padding:8px;border:1px solid #c8bedf;border-radius:8px;background:#fff;color:#29324b;font:inherit}#book-source-reader input[type=number]{width:110px}#book-source-reader .rb-source-page-text{white-space:pre-wrap;overflow-wrap:anywhere;max-height:75vh;overflow:auto;padding:22px;border:1px solid #d8d0e7;border-radius:14px;background:#fff;color:#29324b;font:16px/1.9 system-ui,"Microsoft YaHei",sans-serif;text-align:left}#book-source-reader .rb-source-page-text:focus-visible,#book-source-reader button:focus-visible,#book-source-reader a:focus-visible,#book-source-reader input:focus-visible,#book-source-reader select:focus-visible{outline:3px solid #8060c8;outline-offset:3px}#book-source-reader .rb-source-search-results{display:grid;gap:8px;max-height:380px;overflow:auto}#book-source-reader .rb-source-search-result{display:grid;gap:4px;text-align:left;white-space:normal;height:auto}#book-source-reader .rb-source-search-result span{font-weight:400;font-size:13px;line-height:1.6}#book-source-reader .rb-source-pdf{width:100%;height:75vh;min-height:360px;border:1px solid #d8d0e7;border-radius:12px}#book-source-reader .rb-source-help{color:#627087;font-size:14px}#book-source-reader .rb-highlight{background:#ffe69b;color:#372b00}#book-source-reader .rb-source-page-heading{font-size:21px}#book-source-reader .rb-source-search-group{padding:16px 0;border-top:1px solid #e2ddeb}@media(max-width:600px){#book-source-reader .rb-source-control{width:100%}#book-source-reader .rb-source-page-text{padding:14px;font-size:15px}}';
  const intro = element('p', 'rb-source-help', '原书逐页阅读保留提取的文字；表格、公式、图片及复杂换行请以原 PDF 为准。这里的页码是 PDF 文件页序，不一定等于纸质书印刷页码。全文数据和 PDF 都只在你点击后加载。');
  const loadButton = button('加载原书全文', () => { loadAndShow(requestedPage, false); });
  const status = element('p', 'rb-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const interfacePanel = element('div', 'rb-source-interface');
  interfacePanel.hidden = true;
  root.append(style, intro, loadButton, status, interfacePanel);

  const controls = element('div', 'rb-source-controls');
  const chapterSelect = element('select');
  chapterSelect.id = 'rb-original-chapter';
  const chapterPlaceholder = element('option', '', '按原书章节跳转');
  chapterPlaceholder.value = '';
  chapterSelect.append(chapterPlaceholder);
  chapterStarts.forEach((chapter, index) => {
    const option = element('option', '', `${index + 1}. ${chapter.title}`);
    option.value = String(chapter.page);
    chapterSelect.append(option);
  });
  const chapterLabel = labelFor('原书目录', chapterSelect);
  chapterLabel.hidden = !chapterStarts.length;
  chapterSelect.addEventListener('change', () => {
    if (chapterSelect.value) showPage(Number(chapterSelect.value), true);
  });
  const pageInput = element('input');
  pageInput.id = 'rb-original-page';
  pageInput.type = 'number';
  pageInput.min = '1';
  pageInput.step = '1';
  pageInput.inputMode = 'numeric';
  const pageCount = element('span', 'rb-source-page-count');
  const previous = button('← 上一页', () => showPage(currentPage - 1, true));
  const next = button('下一页 →', () => showPage(currentPage + 1, true));
  function submitPage() {
    const target = Number(pageInput.value);
    if (!Number.isInteger(target) || target < 1 || target > pages.length) {
      status.textContent = `请输入 1 到 ${pages.length} 之间的整数页码。`;
      pageInput.focus();
      return;
    }
    showPage(target, true);
  }
  pageInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitPage();
    }
  });
  controls.append(chapterLabel, labelFor('PDF 页码', pageInput), button('跳转', submitPage), previous, next, pageCount);

  const withinInput = element('input');
  withinInput.id = 'rb-original-page-find';
  withinInput.type = 'search';
  withinInput.placeholder = '在当前页查找并高亮';
  const withinStatus = element('span', 'rb-source-help');
  withinStatus.setAttribute('role', 'status');
  const withinControls = element('div', 'rb-source-controls');
  withinControls.append(labelFor('页内查找', withinInput), withinStatus);
  const heading = element('h4', 'rb-source-page-heading');
  heading.tabIndex = -1;
  const pageText = element('pre', 'rb-source-page-text');
  pageText.tabIndex = 0;
  pageText.setAttribute('aria-label', '当前 PDF 页提取文字');

  const pdfControls = element('div', 'rb-source-controls');
  const pdfLink = element('a', 'rb-button', '在新标签页打开本页 PDF ↗');
  pdfLink.target = '_blank';
  pdfLink.rel = 'noopener noreferrer';
  pdfLink.href = pdfUrl;
  const pdfContainer = element('div', 'rb-source-pdf-container');
  pdfContainer.hidden = true;
  const pdfToggle = button('加载本页 PDF 预览', () => {
    pdfVisible = !pdfVisible;
    pdfContainer.hidden = !pdfVisible;
    pdfToggle.setAttribute('aria-expanded', String(pdfVisible));
    pdfToggle.textContent = pdfVisible ? '关闭并卸载 PDF 预览' : '加载本页 PDF 预览';
    pdfContainer.replaceChildren();
    if (pdfVisible) {
      const frame = element('iframe', 'rb-source-pdf');
      frame.title = `原书 PDF 第 ${currentPage} 页`;
      frame.src = `${pdfUrl}#page=${currentPage}`;
      pdfContainer.append(element('p', 'rb-source-help', '正在加载原始 PDF（约 52 MB）。若当前浏览器不支持内嵌阅读，请使用“在新标签页打开本页 PDF”。'), frame);
    }
  });
  pdfToggle.setAttribute('aria-expanded', 'false');
  pdfToggle.setAttribute('aria-controls', 'rb-original-pdf-container');
  pdfContainer.id = 'rb-original-pdf-container';
  pdfControls.append(pdfLink, pdfToggle);

  const fullSearch = element('div', 'rb-source-search-group');
  const fullInput = element('input');
  fullInput.id = 'rb-original-full-search';
  fullInput.type = 'search';
  fullInput.placeholder = '例如：服务通信、MoveIt、AMCL';
  const fullControls = element('div', 'rb-source-controls');
  const fullStatus = element('p', 'rb-source-help');
  fullStatus.setAttribute('role', 'status');
  const fullResults = element('div', 'rb-source-search-results');
  fullResults.id = 'rb-original-search-results';
  fullInput.setAttribute('aria-controls', fullResults.id);

  function highlightText(text, query, container) {
    container.textContent = '';
    if (!query) {
      container.textContent = text;
      return 0;
    }
    const normalized = text.toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let position = normalized.indexOf(needle);
    let count = 0;
    while (position !== -1) {
      fragment.append(document.createTextNode(text.slice(cursor, position)));
      fragment.append(element('mark', 'rb-highlight', text.slice(position, position + query.length)));
      cursor = position + query.length;
      position = normalized.indexOf(needle, cursor);
      count += 1;
    }
    fragment.append(document.createTextNode(text.slice(cursor)));
    container.append(fragment);
    return count;
  }

  function renderPageText() {
    const text = String(pages[currentPage - 1].text || '');
    const query = withinInput.value.trim();
    const count = highlightText(text || '本页未提取到文字，可能是图片、封面或扫描页；请打开对应 PDF 页查看。', query, pageText);
    withinStatus.textContent = query ? `当前页找到 ${count} 处匹配。` : '';
    pageText.scrollTop = 0;
  }
  withinInput.addEventListener('input', renderPageText);

  function showPage(target, moveFocus = false, changeHash = true) {
    if (!pages.length) return;
    if (!Number.isInteger(target) || target < 1 || target > pages.length) {
      status.textContent = `未找到第 ${target} 页；本书共有 ${pages.length} 页。`;
      return;
    }
    currentPage = target;
    pageInput.value = String(currentPage);
    heading.textContent = `原书 · PDF 第 ${currentPage} 页`;
    pageCount.textContent = `第 ${currentPage} / ${pages.length} 页`;
    previous.disabled = currentPage === 1;
    next.disabled = currentPage === pages.length;
    pdfLink.href = `${pdfUrl}#page=${currentPage}`;
    const activeChapter = [...chapterStarts].reverse().find(chapter => chapter.page <= currentPage);
    chapterSelect.value = activeChapter ? String(activeChapter.page) : '';
    renderPageText();
    if (pdfVisible) {
      const frame = pdfContainer.querySelector('iframe');
      if (frame) {
        frame.src = `${pdfUrl}#page=${currentPage}`;
        frame.title = `原书 PDF 第 ${currentPage} 页`;
      }
    }
    if (changeHash) {
      try { window.history.replaceState(null, '', `#book-page-${currentPage}`); }
      catch (error) { window.location.hash = `book-page-${currentPage}`; }
    }
    status.textContent = `已打开 PDF 第 ${currentPage} 页，共 ${pages.length} 页。`;
    if (moveFocus) {
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }

  function searchFullBook() {
    searchQuery = fullInput.value.trim();
    fullResults.replaceChildren();
    if (!searchQuery) {
      fullStatus.textContent = '输入关键词后搜索全书提取文字。';
      return;
    }
    const needle = searchQuery.toLocaleLowerCase();
    const matches = [];
    normalizedPages.forEach((text, index) => {
      const position = text.indexOf(needle);
      if (position !== -1) matches.push({ index, position });
    });
    fullStatus.textContent = matches.length ? `共命中 ${matches.length} 页${matches.length > 50 ? '，展示前 50 页；可增加关键词缩小范围' : ''}。点击结果跳转并高亮。` : '未找到匹配文字。提取文字可能与 PDF 视觉排版不同，可换用更短的关键词。';
    const currentQuery = searchQuery;
    matches.slice(0, 50).forEach(match => {
      const page = pages[match.index];
      const resultButton = button('', () => {
        withinInput.value = currentQuery;
        showPage(match.index + 1, true);
      });
      resultButton.classList.add('rb-source-search-result');
      resultButton.append(element('strong', '', `PDF 第 ${match.index + 1} 页`));
      const start = Math.max(0, match.position - 35);
      const snippetText = `${start ? '…' : ''}${String(page.text).slice(start, match.position + currentQuery.length + 90)}…`;
      const snippet = element('span');
      highlightText(snippetText, currentQuery, snippet);
      resultButton.append(snippet);
      fullResults.append(resultButton);
    });
  }
  fullInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchFullBook();
    }
  });
  fullInput.addEventListener('input', () => {
    if (!fullInput.value.trim()) {
      fullResults.replaceChildren();
      fullStatus.textContent = '';
    }
  });
  fullControls.append(labelFor('全文搜索', fullInput), button('搜索全书', searchFullBook));
  fullSearch.append(fullControls, fullStatus, fullResults);
  interfacePanel.append(controls, fullSearch, heading, withinControls, pageText, pdfControls, pdfContainer);

  function acceptData() {
    if (!Array.isArray(window.ROS_BOOK_PAGES) || !window.ROS_BOOK_PAGES.length) throw new Error('原书文本数据为空或格式不正确。');
    pages = window.ROS_BOOK_PAGES;
    normalizedPages = pages.map(page => String(page.text || '').toLocaleLowerCase());
    pageInput.max = String(pages.length);
    interfacePanel.hidden = false;
    loadButton.hidden = true;
  }

  function loadData() {
    if (pages.length) return Promise.resolve();
    if (loadingPromise) return loadingPromise;
    loadButton.disabled = true;
    loadButton.textContent = '正在加载原书全文…';
    status.textContent = '正在加载逐页提取文字；原始 PDF 尚未加载。';
    loadingPromise = new Promise((resolve, reject) => {
      if (Array.isArray(window.ROS_BOOK_PAGES) && window.ROS_BOOK_PAGES.length) {
        try { acceptData(); resolve(); } catch (error) { reject(error); }
        return;
      }
      const script = document.createElement('script');
      script.src = dataUrl;
      script.async = true;
      script.addEventListener('load', () => {
        try { acceptData(); resolve(); }
        catch (error) { script.remove(); reject(error); }
      }, { once: true });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error('无法加载原书文字文件，请确认 ros-book-pages.js 与网页位于同一目录。'));
      }, { once: true });
      document.head.append(script);
    }).catch(error => {
      loadingPromise = undefined;
      loadButton.disabled = false;
      loadButton.hidden = false;
      loadButton.textContent = '重试加载原书全文';
      status.textContent = `加载失败：${error.message} 可以点击重试。`;
      throw error;
    });
    return loadingPromise;
  }

  async function loadAndShow(target, focus) {
    requestedPage = target;
    const version = ++requestVersion;
    const initialHash = window.location.hash;
    try {
      await loadData();
      if (version !== requestVersion) return;
      const navigationUnchanged = window.location.hash === initialHash;
      if (!Number.isInteger(target) || target < 1 || target > pages.length) {
        showPage(1, focus && navigationUnchanged, false);
        status.textContent = `未找到第 ${target} 页；本书共有 ${pages.length} 页，已显示第 1 页。`;
        return;
      }
      showPage(target, focus && navigationUnchanged, navigationUnchanged);
    } catch (error) {
      return;
    }
  }

  function openHash() {
    const match = /^#book-page-(\d+)$/.exec(window.location.hash);
    if (match) loadAndShow(Number(match[1]), true);
  }

  window.addEventListener('hashchange', openHash);
  openHash();
})();

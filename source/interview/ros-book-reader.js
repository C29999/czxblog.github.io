(() => {
  'use strict';

  document.querySelectorAll('[data-reader]').forEach(root => {
  const isCourse = root.dataset.reader === 'course';
  const prefix = isCourse ? 'rc' : 'rb';
  const chapters = isCourse ? window.ROS2_COURSE_CHAPTERS : [
    ...(window.ROS_BOOK_CHAPTERS || []), ...(window.ROS_BOOK_MIDDLE || []), ...(window.ROS_BOOK_ADVANCED || [])
  ].sort((first, second) => Number(first.id) - Number(second.id));
  if (!root || !Array.isArray(chapters) || !chapters.length) return;

  const storageKey = isCourse ? 'ros2-embedded-course-completed-v1' : 'ros-book-course-completed-v1';
  const textEntries = [];
  const searchableEntries = [];
  const sectionElements = [];
  const chapterElements = [];
  const navigationButtons = [];
  const completionInputs = [];
  let completed = new Set();
  let storageAvailable = true;
  let searchTimer;
  let targetTimer;
  let highlightedTarget;

  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(stored)) completed = new Set(stored.map(String));
  } catch (error) {
    storageAvailable = false;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function readable(tag, className, text) {
    const node = element(tag, className, text);
    textEntries.push({ node, text: String(text || '') });
    return node;
  }

  function button(text, className, handler) {
    const node = element('button', className || 'rb-button', text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  }

  function chapterId(chapter) {
    return `${prefix}-chapter-${chapter.id}`;
  }

  function sectionId(chapter, index) {
    return `${prefix}-section-${chapter.id}-${index + 1}`;
  }

  function searchableText(section) {
    return [section.title, ...(section.paragraphs || []), section.analogy,
      ...(section.steps || []), section.code && section.code.text,
      ...(section.pitfalls || [])].filter(Boolean).join('\n');
  }

  root.classList.add('rb-reader');
  const toolbar = element('div', 'rb-toolbar');
  const searchLabel = element('label', 'rb-search-label', '搜索书中概念、命令与排错方法');
  searchLabel.htmlFor = `${prefix}-course-search`;
  const searchInput = element('input', 'rb-search');
  searchInput.id = `${prefix}-course-search`;
  searchInput.type = 'search';
  searchInput.placeholder = isCourse ? '例如：QoS、编码器、TF、控制器' : '例如：话题、catkin、坐标、导航';
  searchInput.autocomplete = 'off';
  searchInput.setAttribute('aria-controls', `${prefix}-search-results`);
  const actions = element('div', 'rb-actions');
  const status = element('p', 'rb-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const progressLabel = element('label', 'rb-progress-label');
  progressLabel.htmlFor = `${prefix}-course-progress`;
  const progress = element('progress', 'rb-progress');
  progress.id = `${prefix}-course-progress`;
  progress.max = chapters.length;
  const results = element('div', 'rb-search-results');
  results.id = `${prefix}-search-results`;
  results.hidden = true;
  results.setAttribute('aria-label', '课程搜索结果');
  const resultCount = element('p', 'rb-search-count');
  resultCount.setAttribute('role', 'status');
  const resultList = element('div', 'rb-search-list');
  results.append(resultCount, resultList);

  function announce(message) {
    status.textContent = message;
  }

  function updateProgress() {
    const count = chapters.filter(chapter => completed.has(String(chapter.id))).length;
    progress.value = count;
    progressLabel.textContent = `学习进度：已完成 ${count} / ${chapters.length} 章`;
    chapterElements.forEach((chapterNode, index) => {
      const isComplete = completed.has(String(chapters[index].id));
      chapterNode.classList.toggle('rb-is-complete', isComplete);
      completionInputs[index].checked = isComplete;
      navigationButtons[index].classList.toggle('rb-is-complete', isComplete);
      navigationButtons[index].setAttribute('aria-label',
        `第 ${index + 1} 章 ${chapters[index].title}${isComplete ? '，已完成' : ''}`);
    });
  }

  function persistCompletion() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...completed]));
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
    }
    updateProgress();
    announce(storageAvailable ? '学习进度已保存在当前浏览器。' : '进度已更新；当前浏览器不允许保存，刷新后可能丢失。');
  }

  function setCurrentChapter(chapterNode) {
    navigationButtons.forEach((navButton, index) => {
      if (chapterElements[index] === chapterNode) navButton.setAttribute('aria-current', 'page');
      else navButton.removeAttribute('aria-current');
    });
  }

  function reveal(targetId, updateHash = true, focus = true) {
    const target = document.getElementById(targetId);
    if (!target || !root.contains(target)) return;
    let ancestor = target.parentElement;
    while (ancestor) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    const chapterNode = target.closest('.rb-chapter');
    if (!chapterNode) return;
    if (target.matches('details')) target.open = true;
    else chapterNode.querySelectorAll('details').forEach(details => { details.open = true; });
    setCurrentChapter(chapterNode);
    if (updateHash) {
      try {
        window.history.replaceState(null, '', `#${encodeURIComponent(targetId)}`);
      } catch (error) {
        window.location.hash = targetId;
      }
    }
    const focusTarget = target.matches('details') ? target.querySelector('summary') : target;
    if (focus) {
      if (!focusTarget.matches('summary')) focusTarget.tabIndex = -1;
      focusTarget.focus({ preventScroll: true });
    }
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
    if (highlightedTarget) highlightedTarget.classList.remove('rb-target');
    window.clearTimeout(targetTimer);
    target.classList.add('rb-target');
    highlightedTarget = target;
    targetTimer = window.setTimeout(() => target.classList.remove('rb-target'), 2200);
  }

  actions.append(
    button('展开全部小节', 'rb-button', () => {
      sectionElements.forEach(section => { section.open = true; });
      announce(`已展开 ${sectionElements.length} 个小节。`);
    }),
    button('折叠全部小节', 'rb-button', () => {
      sectionElements.forEach(section => { section.open = false; });
      announce(`已折叠 ${sectionElements.length} 个小节；点击标题可重新展开。`);
    })
  );
  toolbar.append(searchLabel, searchInput, actions, progressLabel, progress, status, results);
  const layout = element('div', 'rb-layout');
  const navigation = element('nav', 'rb-nav');
  navigation.setAttribute('aria-label', '书籍课程章节目录');
  const chapterList = element('div', 'rb-chapters');
  layout.append(navigation, chapterList);
  root.append(toolbar, layout);

  async function copyCode(codeNode, copyButton) {
    copyButton.disabled = true;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(codeNode.textContent);
      copyButton.textContent = '已复制';
      announce('代码已复制到剪贴板。');
    } catch (error) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(codeNode);
      selection.removeAllRanges();
      selection.addRange(range);
      const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘C' : 'Ctrl+C';
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (copyError) { copied = false; }
      if (copied) {
        selection.removeAllRanges();
        copyButton.textContent = '已复制';
        announce('代码已复制到剪贴板。');
      } else {
        copyButton.textContent = '已选中，请手动复制';
        announce(`浏览器未允许自动复制。代码已选中，请按 ${shortcut} 复制。`);
      }
    } finally {
      copyButton.disabled = false;
      window.setTimeout(() => { copyButton.textContent = '复制代码'; }, 4500);
    }
  }

  chapters.forEach((chapter, chapterIndex) => {
    const article = element('article', 'rb-chapter');
    article.id = chapterId(chapter);
    const header = element('header', 'rb-chapter-header');
    const title = readable('h3', 'rb-chapter-title', chapter.title);
    title.id = `${article.id}-title`;
    article.setAttribute('aria-labelledby', title.id);
    header.append(element('p', 'rb-chapter-kicker', `CHAPTER ${String(chapterIndex + 1).padStart(2, '0')}`), title);
    if (chapter.sourcePages) header.append(element('span', 'rb-source', `原书参考：${chapter.sourcePages}`));
    header.append(readable('p', 'rb-chapter-intro', chapter.intro || ''));
    article.append(header);
    searchableEntries.push({ id: article.id, title: chapter.title, text: `${chapter.title}\n${chapter.intro || ''}` });

    (chapter.sections || []).forEach((section, sectionIndex) => {
      const details = element('details', 'rb-section');
      details.id = sectionId(chapter, sectionIndex);
      details.open = isCourse && chapterIndex === 0 && !section.advanced;
      const summary = element('summary', 'rb-section-summary');
      summary.append(readable('h4', 'rb-section-title', section.title));
      const body = element('div', 'rb-section-body');
      (section.paragraphs || []).forEach(paragraph => body.append(readable('p', 'rb-paragraph', paragraph)));
      if (section.analogy) {
        const analogy = element('aside', 'rb-analogy');
        analogy.append(element('strong', 'rb-analogy-label', '换个比喻理解'), readable('p', 'rb-paragraph', section.analogy));
        body.append(analogy);
      }
      if (section.steps && section.steps.length) {
        const steps = element('ol', 'rb-steps');
        section.steps.forEach(step => steps.append(readable('li', '', step)));
        body.append(steps);
      }
      if (section.code && section.code.text) {
        const codeWrap = element('div', 'rb-code-wrap');
        const pre = element('pre', 'rb-code');
        const code = readable('code', '', section.code.text);
        pre.tabIndex = 0;
        pre.setAttribute('aria-label', `${section.title}代码示例`);
        pre.append(code);
        const copyButton = button('复制代码', 'rb-button rb-copy', () => copyCode(code, copyButton));
        codeWrap.append(element('span', 'rb-code-language', section.code.language || '代码'), copyButton, pre);
        body.append(codeWrap);
      }
      if (section.pitfalls && section.pitfalls.length) {
        const pitfalls = element('aside', 'rb-pitfalls');
        const list = element('ul', 'rb-pitfall-list');
        section.pitfalls.forEach(pitfall => list.append(readable('li', '', pitfall)));
        pitfalls.append(element('h5', '', '容易踩的坑'), list);
        body.append(pitfalls);
      }
      details.append(summary, body);
      article.append(details);
      sectionElements.push(details);
      searchableEntries.push({ id: details.id, title: `${chapter.title} · ${section.title}`, text: searchableText(section) });
    });

    if (isCourse) {
      const labMount = element('div', 'course-lab-mount');
      labMount.dataset.courseLabs = chapter.id;
      article.append(labMount);
    }

    if (chapter.quiz && Array.isArray(chapter.quiz.options)) {
      const quiz = element('fieldset', 'rb-quiz');
      const legend = readable('legend', '', `本章自测：${chapter.quiz.question}`);
      const options = element('div', 'rb-quiz-options');
      const feedback = element('p', 'rb-quiz-feedback');
      feedback.setAttribute('role', 'status');
      feedback.setAttribute('aria-live', 'polite');
      const optionButtons = [];
      chapter.quiz.options.forEach((option, optionIndex) => {
        const optionButton = button(`${String.fromCharCode(65 + optionIndex)}. ${option}`, 'rb-quiz-option', () => {
          const correct = optionIndex === Number(chapter.quiz.answer);
          optionButtons.forEach((candidate, candidateIndex) => {
            candidate.setAttribute('aria-pressed', String(candidateIndex === optionIndex));
            candidate.classList.toggle('rb-answer-correct', candidateIndex === optionIndex && correct);
            candidate.classList.toggle('rb-answer-incorrect', candidateIndex === optionIndex && !correct);
          });
          feedback.textContent = `${correct ? '回答正确。' : '再想一想。'}${chapter.quiz.explanation || ''}`;
          feedback.dataset.result = correct ? 'correct' : 'incorrect';
        });
        optionButton.setAttribute('aria-pressed', 'false');
        textEntries.push({ node: optionButton, text: optionButton.textContent });
        optionButtons.push(optionButton);
        options.append(optionButton);
      });
      quiz.append(legend, options, feedback);
      article.append(quiz);
      searchableEntries.push({ id: article.id, title: `${chapter.title} · 本章自测`, text: `${chapter.quiz.question}\n${chapter.quiz.options.join('\n')}` });
    }

    const footer = element('footer', 'rb-chapter-footer');
    const completionLabel = element('label', 'rb-complete-label');
    const completionInput = element('input', 'rb-complete-input');
    completionInput.type = 'checkbox';
    completionInput.id = `${article.id}-complete`;
    completionInput.addEventListener('change', () => {
      if (completionInput.checked) completed.add(String(chapter.id));
      else completed.delete(String(chapter.id));
      persistCompletion();
    });
    completionLabel.append(completionInput, document.createTextNode(' 我已完成本章学习'));
    completionInputs.push(completionInput);
    const chapterNavigation = element('div', 'rb-chapter-navigation');
    if (chapterIndex > 0) chapterNavigation.append(button('← 上一章', 'rb-button', () => reveal(chapterId(chapters[chapterIndex - 1]))));
    if (chapterIndex < chapters.length - 1) chapterNavigation.append(button('下一章 →', 'rb-button', () => reveal(chapterId(chapters[chapterIndex + 1]))));
    footer.append(completionLabel, chapterNavigation);
    article.append(footer);
    chapterList.append(article);
    chapterElements.push(article);
    const navButton = button(`${String(chapterIndex + 1).padStart(2, '0')} · ${chapter.title}`, 'rb-nav-link', () => reveal(article.id));
    navButton.setAttribute('aria-controls', article.id);
    navigationButtons.push(navButton);
    navigation.append(navButton);
  });

  function highlight(query) {
    const needle = query.toLocaleLowerCase();
    textEntries.forEach(entry => {
      entry.node.textContent = entry.text;
      if (!needle) return;
      const normalized = entry.text.toLocaleLowerCase();
      let position = 0;
      let match = normalized.indexOf(needle);
      if (match === -1) return;
      const fragment = document.createDocumentFragment();
      while (match !== -1) {
        fragment.append(document.createTextNode(entry.text.slice(position, match)));
        fragment.append(element('mark', 'rb-highlight', entry.text.slice(match, match + query.length)));
        position = match + query.length;
        match = normalized.indexOf(needle, position);
      }
      fragment.append(document.createTextNode(entry.text.slice(position)));
      entry.node.replaceChildren(fragment);
    });
  }

  function search() {
    const query = searchInput.value.trim();
    highlight(query);
    resultList.replaceChildren();
    results.hidden = !query;
    if (!query) return;
    const needle = query.toLocaleLowerCase();
    const labEntries = [...root.querySelectorAll('.rl-lab, .rl2-lab, #slam-lab')].map(lab => ({
      id: lab.id,
      title: lab.querySelector('h3,h4')?.textContent || lab.getAttribute('aria-label') || lab.id,
      text: lab.textContent
    }));
    const matches = [...searchableEntries, ...labEntries].filter(entry => entry.text.toLocaleLowerCase().includes(needle));
    resultCount.textContent = matches.length ? `找到 ${matches.length} 处相关内容，点击结果展开并定位。` : '没有找到相关内容，试试更短的关键词。';
    matches.forEach(entry => {
      const resultButton = button('', 'rb-search-result', () => reveal(entry.id));
      resultButton.append(element('strong', '', entry.title));
      const match = entry.text.toLocaleLowerCase().indexOf(needle);
      const start = Math.max(0, match - 24);
      resultButton.append(element('span', '', `${start ? '…' : ''}${entry.text.slice(start, match + query.length + 72)}…`));
      resultList.append(resultButton);
    });
  }

  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(search, 160);
  });
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      window.clearTimeout(searchTimer);
      search();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      window.clearTimeout(searchTimer);
      search();
      const firstResult = resultList.querySelector('button');
      if (firstResult) firstResult.click();
    }
  });

  function openHash() {
    let targetId;
    try { targetId = decodeURIComponent(window.location.hash.slice(1)); } catch (error) { return; }
    if (targetId.startsWith(`${prefix}-chapter-`) || targetId.startsWith(`${prefix}-section-`)) reveal(targetId, false, false);
  }

  window.addEventListener('hashchange', openHash);
  updateProgress();
  setCurrentChapter(chapterElements[0]);
  announce(storageAvailable ? '完成状态只保存在当前浏览器，可随时取消勾选。' : '浏览器存储不可用，本次阅读仍可正常使用。');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);
      if (visible.length) setCurrentChapter(visible[0].target.closest('.rb-chapter'));
    }, { rootMargin: '-5% 0px -70% 0px', threshold: 0 });
    chapterElements.forEach(chapter => observer.observe(chapter.querySelector('.rb-chapter-header')));
  }
  window.requestAnimationFrame(openHash);
  });
})();

(() => {
  const CALENDAR_ENDPOINT = '/.netlify/functions/github-calendar'
  const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  let pendingRequest = null

  function createCard() {
    const card = document.createElement('section')
    card.id = 'github-calendar'
    card.className = 'recent-post-item github-calendar-card'
    card.setAttribute('aria-live', 'polite')
    return card
  }

  function setLoading(card) {
    card.dataset.loaded = 'false'
    card.replaceChildren()

    const loading = document.createElement('div')
    loading.className = 'github-calendar__loading'
    loading.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>加载 GitHub 贡献中</span>'
    card.append(loading)
  }

  function setError(card) {
    card.replaceChildren()

    const message = document.createElement('div')
    message.className = 'github-calendar__error'
    message.textContent = '暂时无法加载 GitHub 贡献数据'

    const retry = document.createElement('button')
    retry.className = 'github-calendar__retry'
    retry.type = 'button'
    retry.title = '重新加载 GitHub 贡献'
    retry.setAttribute('aria-label', '重新加载 GitHub 贡献')
    retry.innerHTML = '<i class="fas fa-rotate-right" aria-hidden="true"></i>'
    retry.addEventListener('click', () => mountCalendar(true))

    message.append(retry)
    card.append(message)
  }

  function createHeader(username, total) {
    const header = document.createElement('div')
    header.className = 'github-calendar__header'

    const title = document.createElement('h2')
    title.className = 'github-calendar__title'
    title.textContent = 'GitHub 贡献'

    const profile = document.createElement('a')
    profile.className = 'github-calendar__profile'
    profile.href = `https://github.com/${encodeURIComponent(username)}`
    profile.target = '_blank'
    profile.rel = 'noopener noreferrer'
    profile.textContent = `@${username}`

    const summary = document.createElement('span')
    summary.className = 'github-calendar__summary'
    summary.textContent = `过去一年 ${total} 次`

    header.append(title, profile, summary)
    return header
  }

  function createMonths(weeks) {
    const months = document.createElement('div')
    months.className = 'github-calendar__months'
    let lastMonth = null

    weeks.forEach((week, weekIndex) => {
      const monthStart = week.find((day) => day && Number(day.date.slice(-2)) <= 7)
      if (!monthStart) return

      const month = Number(monthStart.date.slice(5, 7))
      if (month === lastMonth) return

      const label = document.createElement('span')
      label.style.gridColumn = String(weekIndex + 1)
      label.textContent = MONTHS[month - 1]
      months.append(label)
      lastMonth = month
    })

    return months
  }

  function createGrid(weeks) {
    const grid = document.createElement('div')
    grid.className = 'github-calendar__grid'
    grid.setAttribute('role', 'img')
    grid.setAttribute('aria-label', 'GitHub 过去一年的贡献热力图')

    weeks.forEach((week, weekIndex) => {
      week.forEach((day, dayIndex) => {
        if (!day) return

        const cell = document.createElement('span')
        cell.className = `github-calendar__cell github-calendar__cell--level-${Math.max(0, Math.min(4, Number(day.level) || 0))}`
        cell.style.gridColumn = String(weekIndex + 1)
        cell.style.gridRow = String(dayIndex + 1)
        cell.title = `${day.date}: ${day.count} 次贡献`
        grid.append(cell)
      })
    })

    return grid
  }

  function createCalendarBlock(title, subtitle, weeks) {
    const block = document.createElement('section')
    block.className = 'github-calendar__block'

    const head = document.createElement('div')
    head.className = 'github-calendar__block-head'

    const heading = document.createElement('h3')
    heading.textContent = title

    const note = document.createElement('span')
    note.textContent = subtitle

    head.append(heading, note)

    const scroll = document.createElement('div')
    scroll.className = 'github-calendar__scroll'

    const canvas = document.createElement('div')
    canvas.className = 'github-calendar__canvas'
    canvas.append(createMonths(weeks), createGrid(weeks))
    scroll.append(canvas)

    block.append(head, scroll)
    return block
  }

  function getDays(weeks) {
    return weeks.flat().filter(Boolean)
  }

  function sumCounts(items) {
    return items.reduce((total, item) => total + (Number(item.count) || 0), 0)
  }

  function createMetric(label, value) {
    const item = document.createElement('div')
    item.className = 'github-calendar__metric'

    const number = document.createElement('strong')
    number.textContent = value

    const caption = document.createElement('span')
    caption.textContent = label

    item.append(number, caption)
    return item
  }

  function createBarChart(title, items) {
    const section = document.createElement('section')
    section.className = 'github-calendar__chart'

    const heading = document.createElement('h3')
    heading.textContent = title

    const max = Math.max(...items.map((item) => item.count), 1)
    const bars = document.createElement('div')
    bars.className = 'github-calendar__bars'

    items.forEach((item) => {
      const bar = document.createElement('div')
      bar.className = 'github-calendar__bar'
      bar.title = `${item.label}: ${item.count} 次贡献`

      const fill = document.createElement('span')
      fill.style.height = `${Math.max(4, Math.round((item.count / max) * 100))}%`

      const label = document.createElement('em')
      label.textContent = item.shortLabel || item.label

      bar.append(fill, label)
      bars.append(bar)
    })

    section.append(heading, bars)
    return section
  }

  function createStats(data) {
    const days = getDays(data.weeks)
    const activeDays = days.filter((day) => Number(day.count) > 0).length
    const bestDay = days.reduce((best, day) => (Number(day.count) > Number(best.count) ? day : best), { count: 0, date: '-' })
    const weeklyItems = data.weeks.map((week, index) => ({
      label: `第 ${index + 1} 周`,
      shortLabel: String(index + 1),
      count: sumCounts(week.filter(Boolean))
    }))
    const monthMap = new Map()

    days.forEach((day) => {
      const key = day.date.slice(0, 7)
      monthMap.set(key, (monthMap.get(key) || 0) + (Number(day.count) || 0))
    })

    const monthlyItems = Array.from(monthMap, ([key, count]) => {
      const month = Number(key.slice(5, 7))
      return {
        label: key,
        shortLabel: MONTHS[month - 1],
        count
      }
    })

    const stats = document.createElement('div')
    stats.className = 'github-calendar__stats'

    const metrics = document.createElement('div')
    metrics.className = 'github-calendar__metrics'
    metrics.append(
      createMetric('过去一年总贡献', data.total),
      createMetric('活跃天数', activeDays),
      createMetric('最高单日', `${bestDay.count} 次`),
      createMetric('平均每周', (data.total / Math.max(data.weeks.length, 1)).toFixed(1))
    )

    stats.append(
      metrics,
      createBarChart('按月对比', monthlyItems),
      createBarChart('按周对比', weeklyItems)
    )

    return stats
  }

  function renderCalendar(card, data) {
    card.dataset.loaded = 'true'
    card.replaceChildren()

    const calendar = document.createElement('div')
    calendar.className = 'github-calendar'
    calendar.append(createHeader(data.username, data.total))

    const content = document.createElement('div')
    content.className = 'github-calendar__content'

    const firstHalfWeeks = data.weeks.slice(0, Math.ceil(data.weeks.length / 2))
    const secondHalfWeeks = data.weeks.slice(Math.ceil(data.weeks.length / 2))
    const mainArea = document.createElement('div')
    mainArea.className = 'github-calendar__main'
    mainArea.append(
      createCalendarBlock('前半段', '最近 26 周', firstHalfWeeks),
      createCalendarBlock('后半段', '较早 27 周', secondHalfWeeks)
    )

    const legend = document.createElement('div')
    legend.className = 'github-calendar__legend'
    legend.innerHTML = '<span>少</span><i></i><i></i><i></i><i></i><i></i><span>多</span>'

    const stats = createStats(data)

    content.append(mainArea, stats)
    calendar.append(content, legend)
    card.append(calendar)
  }

  function requestCalendar() {
    if (!pendingRequest) {
      pendingRequest = fetch(CALENDAR_ENDPOINT, { headers: { Accept: 'application/json' } })
        .then(async (response) => {
          if (!response.ok) throw new Error(`GitHub calendar request failed: ${response.status}`)

          const data = await response.json()
          if (!Array.isArray(data.weeks) || !data.username) throw new Error('GitHub calendar response is invalid')
          return data
        })
        .finally(() => {
          pendingRequest = null
        })
    }

    return pendingRequest
  }

  async function mountCalendar(force = false) {
    if (location.pathname !== '/') return

    const target = document.getElementById('recent-posts')
    if (!target) return

    let card = target.querySelector('#github-calendar')
    if (card && !force && card.dataset.loaded === 'true') return

    if (!card) {
      card = createCard()
      target.prepend(card)
    }

    setLoading(card)

    try {
      const data = await requestCalendar()
      if (card.isConnected) renderCalendar(card, data)
    } catch (error) {
      console.error(error)
      if (card.isConnected) setError(card)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountCalendar(), { once: true })
  } else {
    mountCalendar()
  }

  document.addEventListener('pjax:complete', () => mountCalendar())
})()

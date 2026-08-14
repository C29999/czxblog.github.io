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
    loading.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Loading GitHub contributions</span>'
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

  function parseDate(day) {
    return new Date(`${day.date}T00:00:00`)
  }

  function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  function countRecentDays(days, count) {
    return sumCounts(days.slice(Math.max(0, days.length - count)))
  }

  function getBestSevenDays(days) {
    if (days.length < 7) return sumCounts(days)

    let best = 0
    let current = 0
    const window = []

    days.forEach((day) => {
      const value = Number(day.count) || 0
      window.push(value)
      current += value
      if (window.length > 7) current -= window.shift()
      if (window.length === 7 && current > best) best = current
    })

    return best
  }

  function getYesterdayCount(days) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const key = yesterday.toISOString().slice(0, 10)
    const hit = days.find((day) => day.date === key)
    return hit ? Number(hit.count) || 0 : 0
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

  function createTrendChart(days) {
    const section = document.createElement('section')
    section.className = 'github-calendar__chart'

    const heading = document.createElement('h3')
    heading.textContent = '最近 14 天提交折线图'
    section.append(heading)

    const items = days.slice(-14)
    const values = items.map((day) => Number(day.count) || 0)
    const width = 100
    const height = 56
    const max = Math.max(...values, 1)

    const points = values.map((value, index) => {
      const x = items.length === 1 ? 0 : (index / (items.length - 1)) * width
      const y = height - (value / max) * (height - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.classList.add('github-calendar__sparkline')

    const area = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    area.setAttribute('points', `0,${height} ${points.join(' ')} ${width},${height}`)
    area.setAttribute('class', 'github-calendar__sparkline-area')
    svg.append(area)

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    line.setAttribute('points', points.join(' '))
    line.setAttribute('class', 'github-calendar__sparkline-line')
    svg.append(line)

    const dots = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    values.forEach((value, index) => {
      const x = items.length === 1 ? 0 : (index / (items.length - 1)) * width
      const y = height - (value / max) * (height - 8) - 4
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('cx', x.toFixed(1))
      dot.setAttribute('cy', y.toFixed(1))
      dot.setAttribute('r', '1.7')
      dot.setAttribute('class', 'github-calendar__sparkline-dot')
      dots.append(dot)
    })
    svg.append(dots)

    const labels = document.createElement('div')
    labels.className = 'github-calendar__chart-labels'
    items.forEach((day) => {
      const label = document.createElement('span')
      label.textContent = day.date.slice(5)
      labels.append(label)
    })

    section.append(svg, labels)
    return section
  }

  function createStats(data) {
    const days = getDays(data.weeks)
    const activeDays = days.filter((day) => Number(day.count) > 0).length
    const bestDay = days.reduce((best, day) => (Number(day.count) > Number(best.count) ? day : best), { count: 0, date: '-' })
    const recent7Days = countRecentDays(days, 7)
    const yesterdayCount = getYesterdayCount(days)
    const currentMonthKey = getMonthKey(new Date())
    const currentMonthTotal = days
      .filter((day) => getMonthKey(parseDate(day)) === currentMonthKey)
      .reduce((total, day) => total + (Number(day.count) || 0), 0)
    const prevMonth = new Date()
    prevMonth.setDate(1)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const previousMonthKey = getMonthKey(prevMonth)
    const previousMonthTotal = days
      .filter((day) => getMonthKey(parseDate(day)) === previousMonthKey)
      .reduce((total, day) => total + (Number(day.count) || 0), 0)
    const recent4Weeks = countRecentDays(days, 28)
    const bestSevenDays = getBestSevenDays(days)

    const stats = document.createElement('div')
    stats.className = 'github-calendar__stats'

    const metrics = document.createElement('div')
    metrics.className = 'github-calendar__metrics'
    metrics.append(
      createMetric('过去一年总贡献', data.total),
      createMetric('最近七天', recent7Days),
      createMetric('昨日提交', yesterdayCount),
      createMetric('最高单日', `${bestDay.count} 次`),
      createMetric('最近四周', recent4Weeks),
      createMetric('上个月', previousMonthTotal),
      createMetric('此月', currentMonthTotal),
      createMetric('活跃天数', activeDays),
      createMetric('平均每周', (data.total / Math.max(data.weeks.length, 1)).toFixed(1)),
      createMetric('最近七天峰值', bestSevenDays)
    )

    stats.append(metrics, createTrendChart(days))
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
      createCalendarBlock('前半年', '最近 26 周', firstHalfWeeks),
      createCalendarBlock('后半年', '较早 27 周', secondHalfWeeks)
    )

    const legend = document.createElement('div')
    legend.className = 'github-calendar__legend'
    legend.innerHTML = '<span>少</span><i></i><i></i><i></i><i></i><i></i><span>多</span>'

    content.append(mainArea, createStats(data))
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

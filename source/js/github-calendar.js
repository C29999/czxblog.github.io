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

  function renderCalendar(card, data) {
    card.replaceChildren()

    const calendar = document.createElement('div')
    calendar.className = 'github-calendar'
    calendar.append(createHeader(data.username, data.total))

    const scroll = document.createElement('div')
    scroll.className = 'github-calendar__scroll'

    const canvas = document.createElement('div')
    canvas.className = 'github-calendar__canvas'
    canvas.append(createMonths(data.weeks), createGrid(data.weeks))
    scroll.append(canvas)

    const legend = document.createElement('div')
    legend.className = 'github-calendar__legend'
    legend.innerHTML = '<span>少</span><i></i><i></i><i></i><i></i><i></i><span>多</span>'

    calendar.append(scroll, legend)
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
    if (card && !force) return

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

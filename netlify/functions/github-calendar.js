const DEFAULT_GITHUB_USERNAME = 'C29999'
const GITHUB_USERNAME_PATTERN = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i
const CACHE_CONTROL = 'no-store, max-age=0'

function response(statusCode, body, cacheControl = 'no-store') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl
    },
    body: JSON.stringify(body)
  }
}

function contributionCount(tooltip) {
  const count = tooltip.replace(/<[^>]+>/g, ' ').match(/([\d,]+)\s+contributions?/i)
  return count ? Number(count[1].replaceAll(',', '')) : 0
}

function parseCalendar(html) {
  const days = []
  const dayPattern = /<td\b[^>]*\bdata-date="([^"]+)"[^>]*\bdata-level="(\d+)"[^>]*>[\s\S]*?<\/td>\s*<tool-tip\b[^>]*>([\s\S]*?)<\/tool-tip>/gi

  for (const match of html.matchAll(dayPattern)) {
    const date = match[1]
    const level = Number(match[2])

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(level)) continue

    days.push({ date, count: contributionCount(match[3]), level })
  }

  if (days.length === 0) throw new Error('GitHub did not return contribution calendar data')

  days.sort((first, second) => first.date.localeCompare(second.date))
  const firstDay = new Date(`${days[0].date}T00:00:00.000Z`)
  const weeks = []

  for (const day of days) {
    const currentDay = new Date(`${day.date}T00:00:00.000Z`)
    const daysSinceStart = Math.round((currentDay - firstDay) / 86400000)
    const weekIndex = Math.floor(daysSinceStart / 7)

    if (!weeks[weekIndex]) weeks[weekIndex] = Array(7).fill(null)
    weeks[weekIndex][currentDay.getUTCDay()] = day
  }

  return {
    total: days.reduce((sum, day) => sum + day.count, 0),
    latestDate: days[days.length - 1].date,
    weeks
  }
}

async function fetchGithubCalendar(username) {
  const url = `https://github.com/users/${encodeURIComponent(username)}/contributions?cache=${Date.now()}`
  let lastError

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'czxsblog-github-calendar',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      })

      if (response.ok || response.status === 404) return response
      lastError = new Error(`GitHub returned ${response.status}`)
    } catch (error) {
      lastError = error
    }

    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 300))
  }

  throw lastError
}

exports.handler = async function handler(event) {
  const requestedUsername = event.queryStringParameters?.user || DEFAULT_GITHUB_USERNAME
  const username = requestedUsername.trim()

  if (!GITHUB_USERNAME_PATTERN.test(username)) {
    return response(400, { error: 'Invalid GitHub username' })
  }

  try {
    const githubResponse = await fetchGithubCalendar(username)

    if (!githubResponse.ok) {
      return response(githubResponse.status === 404 ? 404 : 502, { error: 'Unable to load GitHub contributions' })
    }

    const calendar = parseCalendar(await githubResponse.text())

    return response(200, { username, ...calendar }, CACHE_CONTROL)
  } catch (error) {
    console.error('Unable to load GitHub contributions', error)
    return response(502, { error: 'Unable to load GitHub contributions' })
  }
}

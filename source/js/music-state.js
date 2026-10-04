(() => {
  if (window.__blogMusicStateInitialized) return

  const container = document.querySelector('.aplayer[data-music-state]')
  if (!container) return
  window.__blogMusicStateInitialized = true

  // Per-tab storage keeps refreshes/navigation continuous without affecting other tabs.
  const storageKey = `blog-music-state:v1:${container.dataset.musicState}`
  let player

  const readState = () => {
    try {
      const state = JSON.parse(window.sessionStorage.getItem(storageKey))
      if (state && state.version === 1 && state.track &&
          typeof state.track.name === 'string' &&
          typeof state.track.artist === 'string' &&
          typeof state.track.url === 'string' &&
          Number.isFinite(state.currentTime) && state.currentTime >= 0 &&
          typeof state.paused === 'boolean') {
        return state
      }
    } catch (_) {
      // Storage may be unavailable or contain an invalid saved state.
    }
    return null
  }

  const bindPlayer = () => {
    const saved = readState()
    const audios = player.list.audios
    let index = saved ? audios.findIndex(track => track.url && track.url === saved.track.url) : -1
    if (saved && index < 0) {
      // Meting URLs can expire; only use an unambiguous song identity as a fallback.
      const matches = audios.map((track, i) => ({ track, i })).filter(({ track }) =>
        (track.name || '') === saved.track.name && (track.artist || '') === saved.track.artist)
      if (matches.length === 1) index = matches[0].i
    }

    let pending = index >= 0 ? { ...saved, index } : null
    let switchingForRestore = false
    let lastSavedAt = 0

    const save = (throttled = false) => {
      if (pending) return
      const now = Date.now()
      if (throttled && now - lastSavedAt < 1000) return
      const track = player.list.audios[player.list.index]
      const currentTime = player.audio.currentTime
      if (!track || !Number.isFinite(currentTime) || currentTime < 0) return
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify({
          version: 1,
          track: { name: track.name || '', artist: track.artist || '', url: track.url || '' },
          currentTime,
          paused: player.paused
        }))
        lastSavedAt = now
      } catch (_) {
        // A storage failure must not interrupt music playback.
      }
    }

    const restore = () => {
      if (!pending || player.list.index !== pending.index) return
      const duration = player.audio.duration
      if (!Number.isFinite(duration) || duration <= 0) return
      const state = pending
      try {
        // APlayer clamps seek() to zero until audio metadata is available.
        player.seek(Math.min(state.currentTime, Math.max(0, duration - 0.1)))
      } catch (_) {
        return
      }
      pending = null
      if (!state.paused) player.play()
      save()
    }

    player.on('loadedmetadata', restore)
    player.on('canplay', restore)
    player.on('timeupdate', () => save(true))
    for (const event of ['play', 'pause']) {
      player.on(event, () => {
        if (pending && !switchingForRestore) pending.paused = player.paused
        save()
      })
    }
    player.on('seeked', () => save())
    player.on('listswitch', () => {
      if (switchingForRestore) return
      // User changes take precedence over a restore still waiting for metadata.
      pending = null
      // APlayer emits listswitch before updating its index and audio source.
      Promise.resolve().then(() => save())
    })
    window.addEventListener('pagehide', () => save())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save()
    })

    if (pending) {
      if (player.list.index !== pending.index) {
        switchingForRestore = true
        player.list.switch(pending.index)
        switchingForRestore = false
      }
      restore()
    }
  }

  const attach = () => {
    if (player) return
    player = (window.aplayers || []).find(instance => instance.container === container)
    if (!player) return
    observer.disconnect()
    bindPlayer()
  }

  // Meting builds APlayer after its asynchronous playlist request completes.
  // Its template mutation is delivered after the new instance enters aplayers.
  const observer = new MutationObserver(attach)
  observer.observe(container, { childList: true })
  attach()
})()

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

const scriptPath = path.join(__dirname, '..', 'source', 'js', 'music-state.js')
const source = fs.readFileSync(scriptPath, 'utf8')
const storageKey = 'blog-music-state:v1:blog-music'
const tracks = [
  { name: 'First song', artist: 'First artist', url: 'https://audio.example/first' },
  { name: 'Second song', artist: 'Second artist', url: 'https://audio.example/second' }
]

function eventTarget () {
  const listeners = new Map()
  return {
    addEventListener (name, callback) {
      if (!listeners.has(name)) listeners.set(name, [])
      listeners.get(name).push(callback)
    },
    removeEventListener (name, callback) {
      listeners.set(name, (listeners.get(name) || []).filter(item => item !== callback))
    },
    dispatchEvent (event) {
      for (const callback of [...(listeners.get(event.type) || [])]) callback(event)
    },
    listenerCount (name) {
      return (listeners.get(name) || []).length
    }
  }
}

function savedState (track = tracks[0], currentTime = 42, paused = true) {
  return { version: 1, track: { ...track }, currentTime, paused }
}

function harness ({ storage = new Map(), storageUnavailable = false, hasContainer = true } = {}) {
  let now = 10000
  let writes = 0
  const observers = []
  const container = { dataset: { musicState: 'blog-music' } }
  const document = Object.assign(eventTarget(), {
    visibilityState: 'visible',
    querySelector (selector) {
      assert.equal(selector, '.aplayer[data-music-state]')
      return hasContainer ? container : null
    }
  })
  const window = Object.assign(eventTarget(), {
    document,
    aplayers: [],
    sessionStorage: {
      getItem (key) {
        if (storageUnavailable) throw new Error('Storage blocked')
        return storage.get(key) ?? null
      },
      setItem (key, value) {
        if (storageUnavailable) throw new Error('Storage blocked')
        writes++
        storage.set(key, value)
      }
    }
  })
  class MutationObserver {
    constructor (callback) {
      this.callback = callback
      this.active = false
      observers.push(this)
    }

    observe (target, options) {
      assert.equal(target, container)
      assert.equal(options.childList, true)
      this.active = true
    }

    disconnect () {
      this.active = false
    }
  }
  class ClockDate extends Date {
    static now () { return now }
  }
  const context = vm.createContext({ window, document, MutationObserver, Date: ClockDate, console })

  function createPlayer (playlist = tracks, { initialIndex = 0, autoplayBlocked = false } = {}) {
    const events = eventTarget()
    const audio = { currentTime: 0, duration: NaN, paused: true, src: playlist[initialIndex].url }
    const player = {
      container,
      audio,
      paused: true,
      seekCalls: [],
      playCalls: 0,
      on (name, callback) { events.addEventListener(name, callback) },
      emit (type, payload = {}) { events.dispatchEvent({ type, ...payload }) },
      listenerCount (name) { return events.listenerCount(name) },
      seek (time) {
        // APlayer 1.10.1 clamps seeks to duration, which is zero before metadata.
        audio.currentTime = Math.min(Math.max(time, 0), Number.isNaN(audio.duration) ? 0 : audio.duration)
        player.seekCalls.push(audio.currentTime)
      },
      play () {
        player.playCalls++
        player.paused = false
        audio.paused = false
        if (autoplayBlocked) {
          // APlayer handles NotAllowedError internally and returns no promise.
          Promise.resolve().then(() => {
            player.paused = true
            audio.paused = true
          })
          return
        }
        player.emit('play')
      },
      pause () {
        player.paused = true
        audio.paused = true
        player.emit('pause')
      },
      metadata (duration = 180, event = 'loadedmetadata') {
        audio.duration = duration
        player.emit(event)
      },
      progress (time) {
        audio.currentTime = time
        player.emit('timeupdate')
      }
    }
    player.list = {
      audios: playlist.map(track => ({ ...track })),
      index: initialIndex,
      switch (index) {
        // The real API emits this synchronously before changing index and src.
        player.emit('listswitch', { index })
        this.index = index
        audio.src = this.audios[index].url
        audio.currentTime = 0
        audio.duration = NaN
      }
    }
    return player
  }

  async function flush () {
    await Promise.resolve()
    await Promise.resolve()
  }

  return {
    storage,
    window,
    document,
    observers,
    createPlayer,
    flush,
    run () { vm.runInContext(source, context, { filename: scriptPath }) },
    advance (milliseconds) { now += milliseconds },
    read () { return JSON.parse(storage.get(storageKey) ?? 'null') },
    get writes () { return writes },
    async attach (player) {
      // Meting inserts the template inside new APlayer(), then pushes its instance.
      window.aplayers.push(player)
      await Promise.resolve()
      for (const observer of observers) {
        if (observer.active) observer.callback([{ type: 'childList', target: container }])
      }
      await flush()
    },
    hide () {
      document.visibilityState = 'hidden'
      document.dispatchEvent({ type: 'visibilitychange' })
    },
    pagehide () { window.dispatchEvent({ type: 'pagehide' }) }
  }
}

test('waits for asynchronous Meting initialization and disconnects after binding', async () => {
  const h = harness()
  h.run()
  assert.equal(h.observers.some(observer => observer.active), true)
  const player = h.createPlayer()
  assert.equal(player.listenerCount('timeupdate'), 0)
  await h.attach(player)
  assert.equal(player.listenerCount('timeupdate'), 1)
  assert.equal(h.observers.some(observer => observer.active), false)
  player.progress(12)
  assert.equal(h.read().currentTime, 12)
})

test('restores an already initialized player without requiring another DOM mutation', () => {
  const storage = new Map([[storageKey, JSON.stringify(savedState())]])
  const h = harness({ storage })
  const player = h.createPlayer()
  player.audio.duration = 180
  h.window.aplayers.push(player)
  h.run()
  assert.equal(player.audio.currentTime, 42)
  assert.equal(h.observers.some(observer => observer.active), false)
})

test('playing music returns to its saved position and resumes after refresh', async () => {
  const before = harness()
  before.run()
  const playing = before.createPlayer()
  await before.attach(playing)
  playing.play()
  playing.audio.currentTime = 37.5
  before.pagehide()

  const after = harness({ storage: before.storage })
  after.run()
  const restored = after.createPlayer()
  await after.attach(restored)
  assert.equal(restored.seekCalls.length, 0)
  restored.metadata()
  assert.equal(restored.audio.currentTime, 37.5)
  assert.equal(restored.playCalls, 1)
  assert.equal(restored.paused, false)
})

test('paused music preserves its position and remains paused after refresh', async () => {
  const before = harness()
  before.run()
  const player = before.createPlayer()
  await before.attach(player)
  player.play()
  player.audio.currentTime = 24
  player.pause()
  assert.equal(before.read().paused, true)

  const after = harness({ storage: before.storage })
  after.run()
  const restored = after.createPlayer()
  await after.attach(restored)
  restored.metadata()
  assert.equal(restored.audio.currentTime, 24)
  assert.equal(restored.playCalls, 0)
  assert.equal(restored.paused, true)
})

test('saves the new track after APlayer updates its index and restores it after refresh', async () => {
  const before = harness()
  before.run()
  const player = before.createPlayer()
  await before.attach(player)
  player.progress(52)
  player.list.switch(1)
  await before.flush()
  assert.deepEqual(before.read().track, tracks[1])
  assert.equal(before.read().currentTime, 0)
  player.metadata()
  player.audio.currentTime = 19
  before.pagehide()

  const after = harness({ storage: before.storage })
  after.run()
  const restored = after.createPlayer()
  await after.attach(restored)
  assert.equal(restored.list.index, 1)
  restored.metadata()
  assert.equal(restored.audio.currentTime, 19)
})

test('restores by track identity when the playlist order and temporary URL change', async () => {
  const storage = new Map([[storageKey, JSON.stringify(savedState(tracks[1], 33))]])
  const h = harness({ storage })
  h.run()
  const playlist = [
    { ...tracks[1], url: 'https://audio.example/second?token=new' },
    tracks[0]
  ]
  const player = h.createPlayer(playlist, { initialIndex: 1 })
  await h.attach(player)
  assert.equal(player.list.index, 0)
  player.metadata()
  assert.equal(player.audio.currentTime, 33)
  assert.equal(h.read().track.url, playlist[0].url)
})

test('URL matching distinguishes duplicate titles but ambiguous title fallback does not restore', async () => {
  const versions = [
    { ...tracks[0], url: 'https://audio.example/first-original' },
    { ...tracks[0], url: 'https://audio.example/first-live' }
  ]
  const exact = harness({ storage: new Map([[storageKey, JSON.stringify(savedState(versions[1]))]]) })
  exact.run()
  const exactPlayer = exact.createPlayer(versions)
  await exact.attach(exactPlayer)
  exactPlayer.metadata()
  assert.equal(exactPlayer.list.index, 1)
  assert.equal(exactPlayer.audio.currentTime, 42)

  const ambiguous = harness({ storage: new Map([[storageKey, JSON.stringify(savedState())]]) })
  ambiguous.run()
  const ambiguousPlayer = ambiguous.createPlayer(versions)
  await ambiguous.attach(ambiguousPlayer)
  ambiguousPlayer.metadata()
  assert.equal(ambiguousPlayer.list.index, 0)
  assert.equal(ambiguousPlayer.seekCalls.length, 0)
})

test('does not restore a removed track into a different song', async () => {
  const h = harness({ storage: new Map([[storageKey, JSON.stringify(savedState())]]) })
  h.run()
  const player = h.createPlayer([tracks[1]])
  await h.attach(player)
  player.metadata()
  assert.equal(player.seekCalls.length, 0)
  assert.equal(player.playCalls, 0)
})

test('keeps the checkpoint until delayed metadata arrives and restores only once', async () => {
  const state = savedState(tracks[1], 61)
  const h = harness({ storage: new Map([[storageKey, JSON.stringify(state)]]) })
  h.run()
  const player = h.createPlayer()
  await h.attach(player)
  player.emit('timeupdate')
  player.emit('pause')
  h.hide()
  h.pagehide()
  assert.deepEqual(h.read(), state)
  for (const duration of [NaN, 0, Infinity]) player.metadata(duration)
  assert.equal(player.seekCalls.length, 0)
  player.metadata(180, 'canplay')
  assert.equal(player.audio.currentTime, 61)
  player.progress(65)
  player.metadata()
  assert.equal(player.audio.currentTime, 65)
  assert.equal(player.seekCalls.length, 1)
})

test('a user track change cancels a pending restore before new metadata arrives', async () => {
  const h = harness({ storage: new Map([[storageKey, JSON.stringify(savedState(tracks[0], 80, false))]]) })
  h.run()
  const player = h.createPlayer()
  await h.attach(player)
  player.list.switch(1)
  await h.flush()
  player.metadata()
  assert.equal(player.audio.currentTime, 0)
  assert.equal(player.seekCalls.length, 0)
  assert.equal(player.playCalls, 0)
  assert.deepEqual(h.read().track, tracks[1])
  assert.equal(h.read().currentTime, 0)
})

test('a user pause while metadata is pending prevents the saved playing state from resuming', async () => {
  const h = harness({ storage: new Map([[storageKey, JSON.stringify(savedState(tracks[0], 28, false))]]) })
  h.run()
  const player = h.createPlayer()
  await h.attach(player)
  // A new APlayer initially has paused controls; the user starts then pauses it
  // during loading, so a real audio pause event changes the pending intent.
  player.play()
  player.pause()
  const playCallsBeforeMetadata = player.playCalls
  assert.equal(h.read().currentTime, 28)
  player.metadata()
  assert.equal(player.audio.currentTime, 28)
  assert.equal(player.playCalls, playCallsBeforeMetadata)
  assert.equal(player.paused, true)
  assert.equal(h.read().paused, true)
})

test('a user play while metadata is pending overrides the saved paused state', async () => {
  const h = harness({ storage: new Map([[storageKey, JSON.stringify(savedState(tracks[0], 36, true))]]) })
  h.run()
  const player = h.createPlayer()
  await h.attach(player)
  player.play()
  assert.equal(h.read().currentTime, 36)
  player.metadata()
  assert.equal(player.audio.currentTime, 36)
  assert.equal(player.paused, false)
  assert.equal(player.audio.paused, false)
  assert.equal(h.read().paused, false)
  assert.equal(h.read().currentTime, 36)
})

test('clamps a stale checkpoint to the current track duration', async () => {
  const h = harness({ storage: new Map([[storageKey, JSON.stringify(savedState(tracks[0], 240))]]) })
  h.run()
  const player = h.createPlayer()
  await h.attach(player)
  player.metadata(120)
  assert.ok(player.audio.currentTime >= 0 && player.audio.currentTime <= 120)
  assert.ok(player.audio.currentTime > 119)
})

test('throttles regular progress writes but immediately records seeks, pause, and page exit', async () => {
  const h = harness()
  h.run()
  const player = h.createPlayer()
  await h.attach(player)
  player.progress(10)
  const writesAfterFirst = h.writes
  h.advance(200)
  player.progress(10.2)
  assert.equal(h.writes, writesAfterFirst)
  h.advance(800)
  player.progress(11)
  assert.equal(h.writes, writesAfterFirst + 1)
  player.audio.currentTime = 50
  player.emit('seeked')
  assert.equal(h.read().currentTime, 50)
  player.play()
  assert.equal(h.read().paused, false)
  player.audio.currentTime = 50.2
  player.pause()
  assert.equal(h.read().currentTime, 50.2)
  assert.equal(h.read().paused, true)
  player.audio.currentTime = 50.4
  h.pagehide()
  assert.equal(h.read().currentTime, 50.4)
  player.audio.currentTime = 50.6
  h.hide()
  assert.equal(h.read().currentTime, 50.6)
})

test('ignores malformed or incompatible checkpoints', async () => {
  for (const checkpoint of [
    '{broken json',
    'null',
    JSON.stringify({ ...savedState(), version: 2 }),
    JSON.stringify({ ...savedState(), currentTime: -1 }),
    JSON.stringify({ ...savedState(), currentTime: '42' }),
    JSON.stringify({ ...savedState(), paused: 'false' }),
    JSON.stringify({ ...savedState(), track: { name: tracks[0].name } })
  ]) {
    const h = harness({ storage: new Map([[storageKey, checkpoint]]) })
    assert.doesNotThrow(() => h.run())
    const player = h.createPlayer()
    await h.attach(player)
    player.metadata()
    assert.equal(player.seekCalls.length, 0)
    assert.equal(player.playCalls, 0)
    player.progress(7)
    assert.equal(h.read().currentTime, 7)
  }
})

test('unavailable browser storage does not interrupt player events', async () => {
  const h = harness({ storageUnavailable: true })
  assert.doesNotThrow(() => h.run())
  const player = h.createPlayer()
  await h.attach(player)
  assert.doesNotThrow(() => {
    player.metadata()
    player.play()
    player.progress(15)
    player.pause()
    player.list.switch(1)
    h.hide()
    h.pagehide()
  })
  await h.flush()
  assert.equal(player.list.index, 1)
  assert.equal(h.writes, 0)
})

test('browser autoplay rejection leaves the saved position available for manual playback', async () => {
  const h = harness({ storage: new Map([[storageKey, JSON.stringify(savedState(tracks[0], 58, false))]]) })
  h.run()
  const player = h.createPlayer(tracks, { autoplayBlocked: true })
  await h.attach(player)
  assert.doesNotThrow(() => player.metadata())
  await h.flush()
  assert.equal(player.audio.currentTime, 58)
  assert.equal(player.paused, true)
  assert.equal(h.read().currentTime, 58)
})

test('repeated script execution does not duplicate player or page event listeners', async () => {
  const h = harness()
  h.run()
  const player = h.createPlayer()
  await h.attach(player)
  h.run()
  assert.equal(player.listenerCount('timeupdate'), 1)
  assert.equal(player.listenerCount('loadedmetadata'), 1)
  assert.equal(h.window.listenerCount('pagehide'), 1)
  assert.equal(h.document.listenerCount('visibilitychange'), 1)
})

test('pages without the marked music player do not register observers or handlers', () => {
  const h = harness({ hasContainer: false })
  assert.doesNotThrow(() => h.run())
  assert.equal(h.observers.length, 0)
  assert.equal(h.window.listenerCount('pagehide'), 0)
})

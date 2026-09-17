const subscribers = new Map()

function normalizeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').toLowerCase()
}

function getUserSubscribers(username) {
  const key = normalizeUsername(username)
  if (!subscribers.has(key)) subscribers.set(key, new Set())
  return subscribers.get(key)
}

export function addLiveSubscriber(username, response) {
  const bucket = getUserSubscribers(username)
  bucket.add(response)
  return response
}

export function removeLiveSubscriber(username, response) {
  const bucket = subscribers.get(normalizeUsername(username))
  if (!bucket) return
  bucket.delete(response)
  if (bucket.size === 0) subscribers.delete(normalizeUsername(username))
}

export function broadcastLiveEvent(usernames, eventName, payload) {
  const targets = Array.from(new Set((usernames || []).filter(Boolean).map(normalizeUsername)))
  if (!targets.length) return

  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`

  targets.forEach((username) => {
    const bucket = subscribers.get(username)
    if (!bucket || bucket.size === 0) return

    const dead = []
    bucket.forEach((response) => {
      try {
        response.write(serialized)
      } catch (error) {
        dead.push(response)
      }
    })

    dead.forEach((response) => removeLiveSubscriber(username, response))
  })
}

export function attachLiveStream(req, res, username) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(': connected\n\n')

  addLiveSubscriber(username, res)

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': ping\n\n')
    }
  }, 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    removeLiveSubscriber(username, res)
  })
}

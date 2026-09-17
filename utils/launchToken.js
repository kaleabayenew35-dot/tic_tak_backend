export async function verifyLaunchToken(launchToken, systemBackendUrl) {
  if (!launchToken || typeof launchToken !== 'string' || !launchToken.trim()) {
    return null
  }

  if (!systemBackendUrl || typeof systemBackendUrl !== 'string' || !systemBackendUrl.trim()) {
    throw new Error('System backend URL is required')
  }

  const normalizedBaseUrl = systemBackendUrl.trim().replace(/\/+$/, '')
  const endpointUrl = `${normalizedBaseUrl}/api/verify-launch-token`

  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ launch: launchToken }),
  })

  const rawText = await response.text()
  let payload = {}

  try {
    payload = rawText ? JSON.parse(rawText) : {}
  } catch {
    payload = { raw: rawText }
  }

  if (!payload || payload.valid !== true) {
    return null
  }

  if (!payload.phone || !payload.username) {
    return null
  }

  return {
    phone: payload.phone,
    username: payload.username,
    balance: payload.balance,
    gameId: payload.gameId,
  }
}

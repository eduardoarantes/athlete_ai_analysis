/**
 * Refresh Strava access token using refresh token
 */

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
const STRAVA_REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
}

async function refreshToken(): Promise<TokenResponse> {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
    throw new Error('Missing Strava OAuth credentials in environment variables')
  }

  const url = 'https://www.strava.com/oauth/token'
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    client_secret: STRAVA_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: STRAVA_REFRESH_TOKEN,
  })

  console.log('Refreshing Strava access token...')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`HTTP ${response.status}: ${error}`)
  }

  const data = (await response.json()) as TokenResponse

  console.log('✓ Token refreshed successfully')
  console.log(`Access Token: ${data.access_token}`)
  console.log(`Refresh Token: ${data.refresh_token}`)
  console.log(`Expires At: ${new Date(data.expires_at * 1000).toISOString()}`)

  return data
}

async function main() {
  const tokens = await refreshToken()
  console.log('\nUpdate your .env.local file with:')
  console.log(`STRAVA_ACCESS_TOKEN=${tokens.access_token}`)
  console.log(`STRAVA_REFRESH_TOKEN=${tokens.refresh_token}`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

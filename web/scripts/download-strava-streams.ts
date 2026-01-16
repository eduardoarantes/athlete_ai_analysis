/**
 * Download Strava activity streams (watts, time, cadence) for test activities
 */

import * as fs from 'fs'
import * as path from 'path'

const STRAVA_ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN
const OUTPUT_DIR = path.join(__dirname, '../test-results/strava-streams')

const ACTIVITY_IDS = [
  '15664598790',
  '14698802921',
  '14677009311',
  '14429811505',
  '14256926250',
  '11205974269',
  '11145023577',
  '11123154345',
  '11010699309',
  '16983317605',
  '11241924282',
  '11249429377',
  '10953881435',
  '10906026493',
  '11739391851',
]

interface StravaStream {
  type: string
  data: number[]
  series_type: string
  original_size: number
  resolution: string
}

async function downloadActivityStreams(activityId: string): Promise<void> {
  if (!STRAVA_ACCESS_TOKEN) {
    throw new Error('STRAVA_ACCESS_TOKEN environment variable is not set')
  }

  const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=watts,time,cadence&key_by_type=true`

  console.log(`Downloading streams for activity ${activityId}...`)

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${STRAVA_ACCESS_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const streams = (await response.json()) as Record<string, StravaStream>

    // Save to file
    const outputPath = path.join(OUTPUT_DIR, `${activityId}_streams.json`)
    fs.writeFileSync(outputPath, JSON.stringify(streams, null, 2))

    console.log(`✓ Saved: ${activityId}_streams.json`)

    // Also create a CSV file for easy inspection
    const csvPath = path.join(OUTPUT_DIR, `${activityId}_streams.csv`)
    const watts = streams.watts?.data || []
    const time = streams.time?.data || []
    const cadence = streams.cadence?.data || []

    const csvLines = ['watts,time,cadence']
    const maxLength = Math.max(watts.length, time.length, cadence.length)

    for (let i = 0; i < maxLength; i++) {
      csvLines.push(`${watts[i] || ''},${time[i] || ''},${cadence[i] || ''}`)
    }

    fs.writeFileSync(csvPath, csvLines.join('\n'))
    console.log(`✓ Saved: ${activityId}_streams.csv`)
  } catch (error) {
    console.error(`✗ Failed to download activity ${activityId}:`, error)
    throw error
  }
}

async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  console.log(`Downloading streams for ${ACTIVITY_IDS.length} activities...\n`)

  for (const activityId of ACTIVITY_IDS) {
    await downloadActivityStreams(activityId)
    // Rate limit: wait 1 second between requests
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  console.log(`\n✓ All streams downloaded to: ${OUTPUT_DIR}`)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

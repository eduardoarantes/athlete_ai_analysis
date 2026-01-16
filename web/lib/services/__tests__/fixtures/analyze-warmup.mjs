import { ACTIVITY_16983317605_POWER_STREAM } from './real-activity-streams.ts'

const powerStream = ACTIVITY_16983317605_POWER_STREAM
const FTP = 250
const warmupLow = FTP * 0.56 // 140W
const warmupHigh = FTP * 0.66 // 165W

console.log('First 900 seconds (expected warmup):')
const warmupData = powerStream.slice(0, 900)
const avgWarmup = warmupData.reduce((a, b) => a + b, 0) / warmupData.length
console.log(`  Average power: ${avgWarmup.toFixed(1)}W`)
console.log(`  Expected range: ${warmupLow.toFixed(0)}-${warmupHigh.toFixed(0)}W`)
console.log(`  In range: ${avgWarmup >= warmupLow && avgWarmup <= warmupHigh ? 'YES ✓' : 'NO ✗'}`)

// Check if there are any sprints in first 900s
const highPowerCount = warmupData.filter((p) => p > 200).length
console.log(`  High power samples (>200W): ${highPowerCount}`)

// Look for the first sprint (expected around 900s)
console.log('\nLooking for first sprint after warmup:')
for (let i = 850; i < 1000; i += 10) {
  const window = powerStream.slice(i, Math.min(i + 10, powerStream.length))
  const avg = window.reduce((a, b) => a + b, 0) / window.length
  if (avg > 200) {
    console.log(`  Time ${i}s: ${avg.toFixed(0)}W (SPRINT DETECTED)`)
    break
  }
}

// Total workout structure
console.log('\nExpected workout structure:')
console.log('  Warmup: 0-900s (15:00)')
console.log('  Sprint set 1: 900-1200s (15:00-20:00)')
console.log('  Main intervals: 1200-3000s (20:00-50:00)')
console.log('  Cooldown: 3000-3600s (50:00-60:00)')
console.log(
  `\nActual activity duration: ${powerStream.length}s (${(powerStream.length / 60).toFixed(1)} min)`
)

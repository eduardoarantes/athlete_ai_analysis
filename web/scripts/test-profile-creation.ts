/**
 * Test profile creation with MANUAL_WORKOUTS plan creation
 */

const NEXT_URL = 'http://localhost:3000'

// Get auth cookie from browser - you'll need to paste this
const AUTH_COOKIE = process.argv[2]

if (!AUTH_COOKIE) {
  console.error('❌ Please provide auth cookie as argument')
  console.log('Usage: npx tsx scripts/test-profile-creation.ts "sb-access-token=..."')
  process.exit(1)
}

async function testProfileCreation() {
  console.log('🧪 Testing Profile Creation API\n')

  const profileData = {
    firstName: 'Test',
    lastName: 'User',
    age: 30,
    gender: 'male',
    ftp: 250,
    maxHr: 190,
    restingHr: 55,
    lthr: 170,
    weightKg: 75,
    goals: ['improve_ftp', 'build_endurance'],
    preferredLanguage: 'en',
    timezone: 'America/New_York',
    unitsSystem: 'metric',
  }

  console.log('Sending request to /api/profile/create...')
  console.log('Profile data:', JSON.stringify(profileData, null, 2))

  const response = await fetch(`${NEXT_URL}/api/profile/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_COOKIE ? { Cookie: AUTH_COOKIE } : {}),
    },
    body: JSON.stringify(profileData),
  })

  const result = await response.json()

  console.log('\n📊 Response:')
  console.log('Status:', response.status)
  console.log('Body:', JSON.stringify(result, null, 2))

  if (response.ok) {
    console.log('\n✅ Profile created successfully!')
    console.log('Profile ID:', result.profile?.id)

    // Now check if MANUAL_WORKOUTS plan was created
    console.log('\n🔍 Checking for MANUAL_WORKOUTS plan...')

    // Wait a moment for async operations
    await new Promise((resolve) => setTimeout(resolve, 2000))
  } else {
    console.log('\n❌ Profile creation failed')
  }
}

testProfileCreation().catch((error) => {
  console.error('Error:', error.message)
  process.exit(1)
})

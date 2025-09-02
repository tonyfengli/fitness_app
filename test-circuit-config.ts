// Test script to verify public circuit config endpoints work
// Run with: npx tsx test-circuit-config.ts

const API_URL = 'https://fitness-app-nextjs-plum.vercel.app/api/trpc';
const SESSION_ID = 'e4645cd2-e402-4d5d-8871-d5d8e66faacd';

async function testPublicEndpoints() {
  console.log('Testing public circuit config endpoints...\n');

  // Test 1: Get public config
  console.log('1. Testing getPublic endpoint...');
  try {
    const getResponse = await fetch(`${API_URL}/circuitConfig.getPublic?input=${encodeURIComponent(JSON.stringify({ sessionId: SESSION_ID }))}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const getData = await getResponse.json();
    console.log('✅ Get public config response:', JSON.stringify(getData.result?.data, null, 2));
  } catch (error) {
    console.error('❌ Get public config failed:', error);
  }

  // Test 2: Update public config
  console.log('\n2. Testing updatePublic endpoint...');
  try {
    const updatePayload = {
      sessionId: SESSION_ID,
      config: {
        rounds: 5,
        exercisesPerRound: 4,
        workDuration: 45,
        restDuration: 15,
        restBetweenRounds: 60,
        repeatRounds: true
      }
    };

    const updateResponse = await fetch(`${API_URL}/circuitConfig.updatePublic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: updatePayload
      }),
    });
    
    const updateData = await updateResponse.json();
    
    if (updateResponse.ok) {
      console.log('✅ Update public config successful:', JSON.stringify(updateData.result?.data, null, 2));
    } else {
      console.error('❌ Update public config failed:', updateData);
    }
  } catch (error) {
    console.error('❌ Update public config error:', error);
  }
}

testPublicEndpoints();
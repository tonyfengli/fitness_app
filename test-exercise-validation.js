// Test script to check exercise validation end-to-end
const fetch = require('node-fetch');

async function testExerciseValidation() {
  try {
    // This script assumes you have:
    // 1. A user checked into a session
    // 2. The user's phone number
    // 3. A running ngrok tunnel for Twilio webhook
    
    console.log(`
Test Instructions:
1. Make sure your API server is running (npm run dev in packages/api)
2. Make sure ngrok is running (ngrok http 3000)
3. Update the Twilio webhook URL to your ngrok URL + /api/sms/webhook
4. Check into a session with a test user
5. Send a text message from the user's phone with exercise mentions like:
   - "Feeling good but please no heavy squats today"
   - "Let's avoid burpees and include some deadlifts"
   - "Skip bench press, my shoulder hurts"
6. Check the API logs for detailed exercise validation info
7. Check the session lobby to see if exercises appear in preference tags
    `);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testExerciseValidation();
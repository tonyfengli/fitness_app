// Test script for include exercise disambiguation flow

async function testIncludeExercise() {
  const baseUrl = 'http://localhost:3000/api/sms/inbound';
  
  // Test data
  const testPhone = '+12125551234';
  const businessId = 'test-business-id';
  
  console.log('Testing Include Exercise Disambiguation Flow\n');
  
  // Step 1: Simulate check-in
  console.log('1. Simulating check-in...');
  const checkInPayload = {
    From: testPhone,
    Body: 'here',
    MessageSid: 'SM' + Date.now() + '_checkin'
  };
  
  const checkInResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(checkInPayload).toString()
  });
  
  console.log('Check-in response:', checkInResponse.status);
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Step 2: Send preference with include exercises
  console.log('\n2. Sending preference with include exercises...');
  const preferencePayload = {
    From: testPhone,
    Body: 'I want to do bench press and deadlifts today',
    MessageSid: 'SM' + Date.now() + '_preference'
  };
  
  const preferenceResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(preferencePayload).toString()
  });
  
  console.log('Preference response:', preferenceResponse.status);
  
  // Wait for disambiguation message
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 3: Send disambiguation response
  console.log('\n3. Sending disambiguation selection...');
  const disambiguationPayload = {
    From: testPhone,
    Body: '1,4',
    MessageSid: 'SM' + Date.now() + '_disambiguation'
  };
  
  const disambiguationResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(disambiguationPayload).toString()
  });
  
  console.log('Disambiguation response:', disambiguationResponse.status);
  
  console.log('\nTest complete! Check the messages table and workout preferences.');
}

// Run the test
testIncludeExercise().catch(console.error);
#!/usr/bin/env node

// Test script to call the API directly
async function testAPI() {
  console.log('🧪 Testing exercise filter API...\n');
  
  try {
    const response = await fetch('http://localhost:3001/api/trpc/exercise.filter?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22clientName%22%3A%22Test%20User%22%2C%22strengthCapacity%22%3A%22low%22%2C%22skillCapacity%22%3A%22low%22%2C%22includeExercises%22%3A%5B%5D%2C%22avoidExercises%22%3A%5B%5D%2C%22avoidJoints%22%3A%5B%5D%2C%22muscleTarget%22%3A%5B%5D%2C%22muscleLessen%22%3A%5B%5D%2C%22businessId%22%3A%22d33b41e2-f700-4a08-9489-cb6e3daa7f20%22%7D%7D%7D', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ API Response received');
    console.log('📊 Exercise count:', result[0]?.result?.data?.json?.length || 0);
    
    // Check if LLM scoring was applied
    const exercises = result[0]?.result?.data?.json || [];
    const hasScoring = exercises.some(ex => ex.llmScore !== undefined);
    console.log('🤖 LLM Scoring:', hasScoring ? 'Applied' : 'Not applied');
    
    if (exercises.length > 0) {
      console.log('\n📋 First exercise:', {
        name: exercises[0].name,
        score: exercises[0].llmScore || 'none',
        reasons: exercises[0].llmReasons?.length || 0
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n⚠️  Make sure the Next.js server is running on http://localhost:3001');
    console.log('   Run: pnpm --filter @acme/nextjs dev');
  }
}

testAPI();
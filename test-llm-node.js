#!/usr/bin/env node

// Quick test script to trigger the LLM node via API
async function testLLMNode() {
  try {
    console.log('🧪 Testing LLM Preference Node...');
    
    const testData = {
      clientName: "Test User",
      strengthCapacity: "moderate",
      skillCapacity: "moderate", 
      includeExercises: [],
      avoidExercises: [],
      avoidJoints: [],
      primaryGoal: "hypertrophy",
      intensity: "moderate_local",
      muscleTarget: ["chest", "shoulders"],
      muscleLessen: [],
      routineGoal: "hypertrophy",
      routineMuscleTarget: ["chest", "shoulders", "triceps"],
      routineIntensity: "moderate_local",
      userInput: "I want to test the LLM node"
    };

    const response = await fetch('http://localhost:3001/api/trpc/exercise.filter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: testData
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ API call successful!');
    console.log('📊 Filtered exercises count:', result?.result?.data?.json?.length || 0);
    console.log('🔍 Check server console for "LLM preference node" log message');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLLMNode();
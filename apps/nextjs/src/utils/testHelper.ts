/**
 * Browser console helper for saving test scenarios
 * 
 * Usage:
 * 1. Click filter button to trigger issue
 * 2. Open console
 * 3. Run: saveScenario('name', 'description')
 * 4. Later, generate test with: npm run debug-to-test
 */

export async function saveScenario(name: string, description: string, notes?: string): Promise<void> {
  try {
    const response = await fetch('/api/debug/save-scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, notes })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Scenario saved!');
      console.log(`📁 Saved as: ${result.filename}`);
      console.log('\nTo convert to test later:');
      console.log(`npm run debug-to-test generate ${result.id}`);
    } else {
      console.error('❌ Failed to save scenario:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Make it globally available in browser console
if (typeof window !== 'undefined') {
  (window as any).saveScenario = saveScenario;
  
  console.log(`🧪 Test helper loaded! 
  
After clicking filter and seeing an issue:
saveScenario('bug_name', 'What went wrong')

Example:
saveScenario('joint_bug', 'Squats showing despite knee restriction')`);
}
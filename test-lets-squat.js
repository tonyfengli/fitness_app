const { PreferenceUpdateHandler } = require('./packages/api/dist/services/sms/handlers/preference-update-handler.js');
const { WorkoutPreferenceService } = require('./packages/api/dist/services/workoutPreferenceService.js');
const { getUserByPhone } = require('./packages/api/dist/services/checkInService.js');
const { saveMessage } = require('./packages/api/dist/services/messageService.js');
const { sessionTestDataLogger } = require('./packages/api/dist/utils/sessionTestDataLogger.js');

// Mock dependencies
const mocks = {
  getUserByPhone: jest.fn().mockResolvedValue({
    userId: 'user123',
    trainingSessionId: 'session123',
    businessId: 'business123'
  }),
  saveMessage: jest.fn().mockResolvedValue(undefined),
  getPreferences: jest.fn().mockResolvedValue({
    intensity: 'moderate',
    includeExercises: ['Box Pistol Squat', 'Bench Press'],
    avoidExercises: [],
    muscleTargets: [],
    muscleLessens: [],
    avoidJoints: [],
    sessionGoal: null,
    needsFollowUp: false
  }),
  savePreferences: jest.fn().mockResolvedValue(undefined)
};

// Replace actual implementations with mocks
Object.assign(require('./packages/api/dist/services/checkInService.js'), { getUserByPhone: mocks.getUserByPhone });
Object.assign(require('./packages/api/dist/services/messageService.js'), { saveMessage: mocks.saveMessage });
Object.assign(WorkoutPreferenceService, { 
  getPreferences: mocks.getPreferences,
  savePreferences: mocks.savePreferences
});

// Enable session test data logging
sessionTestDataLogger.isEnabled = () => true;
sessionTestDataLogger.initSession = jest.fn();
sessionTestDataLogger.logMessage = jest.fn();
sessionTestDataLogger.saveSessionData = jest.fn();

async function test() {
  console.log('Testing "Let\'s squat" message...\n');
  
  const handler = new PreferenceUpdateHandler();
  const result = await handler.handle(
    '+15624558688',
    "Let's squat",
    'SMtest123'
  );
  
  console.log('Result:', result);
  console.log('\n---\n');
  
  if (result.metadata?.requiresDisambiguation) {
    console.log('Disambiguation message:');
    console.log(result.message);
    
    // Count the options
    const lines = result.message.split('\n');
    const optionLines = lines.filter(line => /^\d+\./.test(line));
    console.log(`\nTotal options presented: ${optionLines.length}`);
  }
}

test().catch(console.error);
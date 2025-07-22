# Group Workout Debug Enhancements Summary

## Overview
Comprehensive error logging and debugging capabilities have been added to the group workout generation pipeline to aid in development and troubleshooting.

## Key Fixes Applied

### 1. **Critical Bug Fix: functionTags Property**
- **Issue**: Code was using `function_tags` (snake_case) but the Exercise type uses `functionTags` (camelCase)
- **Impact**: This prevented exercises from being categorized into blocks, causing Phase 2.5 to have no exercises
- **Fixed in**: 
  - `generateGroupWorkoutBlueprint.ts` (line 119)
  - `GroupWorkoutTemplateHandler.ts` (line 171)

### 2. **Enhanced Console Logging**

#### generateGroupWorkoutBlueprint.ts
- Entry point logging with parameters
- Phase-by-phase timing and progress tracking
- Debug output for function tags to diagnose categorization
- Detailed error information with stack traces
- Summary statistics after each phase

#### performGroupMergeScoring (mergeScores.ts)
- Block-by-block processing with exercise counts per client
- Overlap analysis showing shared exercises
- Top shared exercises by group score
- Quality metrics for shared exercises
- Integration with test data logger

#### GroupWorkoutTemplateHandler.ts
- Blueprint creation logging
- Block processing details
- Group pool size and top exercises
- Slot allocation summary
- Cohesion tracking progress

### 3. **Phase B Data Logging**
- Added proper logging of Phase B blueprint data to test data logger
- Creates cohesion analysis data structure
- Tracks slot allocation details for each block
- Saves complete blueprint information

### 4. **Visual Console Indicators**
The logging uses clear visual indicators for better readability:
- 🎯 Entry points and key parameters
- 🔄 Processing steps in progress
- ✅ Successful completions with timing
- ⚠️ Warnings for suboptimal conditions
- ❌ Errors with detailed context
- 📊 Summary statistics
- 📦 Block processing
- 🏗️ Blueprint creation

## Debug Data Structure

### Test Data Files
All debug data is automatically saved to:
- Individual sessions: `/session-test-data/group-workouts/group_[sessionId]_[timestamp].json`
- Latest session: `/session-test-data/group-workouts/latest-group-workout.json`

### Data Captured
1. **Phase A (Client Processing)**
   - Filter results and exclusion reasons
   - Score distributions
   - Top exercises per client

2. **Phase 2.5 (Group Merge Scoring)**
   - Block scoring data
   - Exercise overlap analysis
   - Cohesion bonus calculations
   - Quality metrics

3. **Phase B (Blueprint Generation)**
   - Blueprint structure
   - Cohesion analysis
   - Slot allocation details
   - Validation warnings

## Client-Side Debug Utilities
Access debug data in browser console:
```javascript
await groupTestData.listSessions()
await groupTestData.getLatest()
await groupTestData.analyzeCohesion('session-id')
await groupTestData.compareClients('session-id')
```

## Next Steps
With these enhancements in place:
1. Run a new group workout session
2. Check console output for detailed debugging information
3. Review saved test data files for complete session analysis
4. Use the visual indicators to quickly identify issues
5. The enhanced logging will reveal exactly where any problems occur

## Common Issues to Watch For
1. **No exercises in blocks**: Check function tags match between exercises and block configs
2. **No shared exercises**: Verify clients have overlapping preferences
3. **Empty blueprint**: Ensure group exercise pools are populated from Phase 2.5
4. **Cohesion warnings**: Adjust shared ratios or ensure more exercise overlap
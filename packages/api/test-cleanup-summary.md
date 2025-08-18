# Test Cleanup Summary

## Removed Tests (MVP-level, overly specific implementation tests)

### 1. **bulgarian-removal.test.ts**

- Tested very specific phrase: "Actually I don't want to Bulgarian, remove that"
- Too granular for MVP level

### 2. **exerciseUpdateParser.test.ts**

- Tested specific wording patterns like:
  - "remove bulgarian"
  - "don't want bulgarian"
  - "skip the squats"
  - "add bulgarian"
  - "include squats"
- Implementation detail tests that are not needed at MVP level

### 3. **preferenceUpdateParser.test.ts**

- Tested specific phrases like:
  - "kick my butt" → high intensity
  - "kick my ass" → high intensity
  - Other specific phrase mappings
- Too specific for MVP testing

### 4. **preferenceUpdateParser.async.test.ts**

- Duplicate tests with async handling
- Same overly specific phrase testing

### 5. **box-pistol-squat-removal.test.ts** (created and removed)

- Tested very specific edge case about Box Pistol Squat removal
- Not needed for MVP

### 6. **Partial cleanup in preference-collection-flow.test.ts**

- Removed specific disambiguation response parsing tests
- Removed specific preference update parsing tests
- Kept high-level handler integration tests

## Kept Tests (Important behavior/integration tests)

### 1. **intensity-preservation.test.ts**

- Tests important behavior about source tracking (explicit vs inherited vs default)
- Ensures user intent is preserved correctly through preference updates

### 2. **followup-preference-merging.test.ts**

- Tests critical behavior about how preferences merge during follow-up
- Ensures existing preferences aren't lost when new ones are added

### 3. **preference-update.test.ts**

- Tests high-level behavior that preference updates work in active state
- Integration test, not implementation detail

### 4. **preference-collection-flow.test.ts** (partially kept)

- Kept high-level handler tests
- Removed specific parsing tests

## Test Philosophy Going Forward

For MVP level testing:

- Focus on integration tests over unit tests
- Test behavior, not implementation
- Avoid testing specific phrases or wording
- Test that the system works end-to-end
- Keep tests that ensure critical business logic (like preference merging, source tracking)

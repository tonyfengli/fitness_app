# Lighting UI Integration Guide

This guide shows how to integrate the new hybrid lighting control into your TV app UI components.

## 1. Update CircuitLobbyComponent.tsx

Add these imports at the top:
```typescript
import { LightingStatusIndicator } from '../../components/LightingStatusIndicator';
```

Update the lighting control hook usage to get new properties:
```typescript
// Initialize lighting control
const { 
  isLightingOn, 
  turnOn, 
  turnOff, 
  getSceneForPhase,
  bridgeAvailable,      // NEW
  connectionError,      // NEW
  refreshConnection     // NEW
} = useLightingControl({ sessionId });
```

Add the status indicator near the lighting controls (example placement):
```tsx
{/* Add this somewhere visible, like near the header or lighting toggle */}
<LightingStatusIndicator
  bridgeAvailable={bridgeAvailable}
  connectionError={connectionError}
  onRefresh={refreshConnection}
  style={{ marginBottom: 16 }}
/>
```

Update the lighting toggle to be disabled when bridge is not available:
```typescript
const handleLightingToggle = async () => {
  // Check if bridge is available first
  if (!bridgeAvailable) {
    // Optionally show a toast or alert
    console.warn('[CircuitLobby] Cannot toggle lights - not on gym network');
    return;
  }
  
  try {
    if (isLightingOn) {
      await turnOff();
    } else {
      // Your existing logic for getting scene
      const sceneId = getSceneForPhase(0, 'preview');
      await turnOn(sceneId);
    }
  } catch (error) {
    console.error('[CircuitLobby] Failed to control lights:', error);
    // Show error to user - the error message will be clear like "Not on gym network"
  }
};
```

## 2. Example Full Integration

Here's a complete example of a lighting toggle with status:

```tsx
<View style={{ marginVertical: 16 }}>
  {/* Connection Status */}
  <LightingStatusIndicator
    bridgeAvailable={bridgeAvailable}
    connectionError={connectionError}
    onRefresh={refreshConnection}
    style={{ marginBottom: 8 }}
  />
  
  {/* Lighting Toggle Switch */}
  <View style={{
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    opacity: bridgeAvailable ? 1 : 0.5, // Dim when unavailable
  }}>
    <Text style={{ 
      color: '#FFF', 
      fontSize: 16,
      fontWeight: '600'
    }}>
      Gym Lighting
    </Text>
    
    <Switch
      value={isLightingOn}
      onValueChange={handleLightingToggle}
      disabled={!bridgeAvailable} // Disable when not connected
      trackColor={{ 
        false: 'rgba(255,255,255,0.2)', 
        true: '#4CAF50' 
      }}
      thumbColor={isLightingOn ? '#FFF' : '#999'}
    />
  </View>
</View>
```

## 3. Error Handling Best Practices

When lighting operations fail, the errors will now be clear:

```typescript
try {
  await turnOn(sceneId);
} catch (error) {
  if (error.message.includes('not on gym network')) {
    // Show network-specific error
    showToast('Please connect to gym Wi-Fi to control lights');
  } else if (error.message.includes('timeout')) {
    // Show timeout error
    showToast('Lights are not responding - please check connection');
  } else {
    // Generic error
    showToast('Failed to control lights');
  }
}
```

## 4. Testing the Integration

1. **On Gym Network**: 
   - Status should show "Lights connected" (green)
   - Toggle should work instantly (~50ms response)
   
2. **On Mobile Hotspot**:
   - Status should show "Not on gym network" (red)
   - Toggle should be disabled
   - Retry button should attempt reconnection

3. **Network Switch**:
   - Status should update within 30 seconds automatically
   - Or user can tap retry to check immediately
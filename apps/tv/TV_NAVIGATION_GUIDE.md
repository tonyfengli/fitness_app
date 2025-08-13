# React Native TV Navigation Guide

## How TV Navigation Works

TV apps use **focus-based navigation** instead of touch. Users navigate with a remote control's directional pad (D-pad).

## Basic Concepts

### 1. Focus System
- One element has focus at a time
- Focused elements are visually highlighted
- D-pad moves focus between elements
- "Select/OK" button activates the focused element

### 2. Making Components Focusable

#### TouchableOpacity (Recommended)
```jsx
<TouchableOpacity
  onPress={() => console.log('Selected!')}
  activeOpacity={0.7}
  // TV-specific props
  tvParallaxProperties={{
    enabled: true,
    shiftDistanceX: 2,
    shiftDistanceY: 2,
  }}
>
  <View className="bg-blue-500 p-4 rounded">
    <Text>Click Me</Text>
  </View>
</TouchableOpacity>
```

#### Pressable (Alternative)
```jsx
<Pressable
  onPress={() => console.log('Selected!')}
  style={({ focused }) => [
    styles.button,
    focused && styles.focused
  ]}
>
  <Text>Click Me</Text>
</Pressable>
```

### 3. Focus Styling

#### Using hasTVFocus prop
```jsx
<TouchableOpacity
  onPress={handlePress}
  style={({ hasTVFocus }) => [
    styles.button,
    hasTVFocus && styles.focusedButton
  ]}
>
  <Text>Button</Text>
</TouchableOpacity>
```

#### With Tailwind/NativeWind
```jsx
<TouchableOpacity
  onPress={handlePress}
  className="bg-gray-200 p-4 focus:bg-blue-500 focus:scale-105"
>
  <Text>Button</Text>
</TouchableOpacity>
```

### 4. Controlling Focus Navigation

#### nextFocusDirection props
```jsx
<TouchableOpacity
  nextFocusDown={nextButtonRef}
  nextFocusUp={prevButtonRef}
  nextFocusLeft={leftButtonRef}
  nextFocusRight={rightButtonRef}
>
  <Text>Button</Text>
</TouchableOpacity>
```

#### Focus Management
```jsx
import { findNodeHandle, TVFocusManager } from 'react-native';

// Set focus programmatically
const buttonRef = useRef(null);

const focusButton = () => {
  const node = findNodeHandle(buttonRef.current);
  if (node) {
    TVFocusManager.setFocus(node);
  }
};
```

### 5. TV Event Handling

```jsx
import { TVEventHandler, HWEvent } from 'react-native';

useEffect(() => {
  const tvEventHandler = new TVEventHandler();
  
  tvEventHandler.enable(undefined, (evt) => {
    if (evt && evt.eventType === 'select') {
      // Handle select button press
    } else if (evt && evt.eventType === 'left') {
      // Handle left navigation
    } else if (evt && evt.eventType === 'right') {
      // Handle right navigation
    }
  });

  return () => {
    tvEventHandler.disable();
  };
}, []);
```

### 6. Best Practices

#### Visual Focus Indicators
```jsx
<TouchableOpacity
  onPress={handlePress}
  className="bg-white border-2 border-transparent focus:border-blue-500"
>
  <View className="p-4">
    <Text className="text-black focus:text-blue-500">
      Button Text
    </Text>
  </View>
</TouchableOpacity>
```

#### Large Touch Targets
- Minimum 48x48dp for comfortable navigation
- Add padding around small elements
- Group related items

#### Grid Layouts
```jsx
<View className="flex-row flex-wrap">
  {items.map((item, index) => (
    <TouchableOpacity
      key={item.id}
      className="w-1/3 p-2"
      onPress={() => selectItem(item)}
    >
      <View className="bg-gray-100 p-4 rounded focus:bg-blue-500">
        <Text>{item.name}</Text>
      </View>
    </TouchableOpacity>
  ))}
</View>
```

### 7. Common Patterns

#### Menu Navigation
```jsx
const MenuScreen = () => {
  const menuItems = ['Start', 'Settings', 'Exit'];
  
  return (
    <View className="flex-1 justify-center items-center">
      {menuItems.map((item, index) => (
        <TouchableOpacity
          key={item}
          className="bg-gray-200 px-8 py-4 my-2 rounded-lg focus:bg-blue-500"
          onPress={() => handleMenuSelect(item)}
        >
          <Text className="text-xl">{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

#### List Navigation
```jsx
<ScrollView>
  {data.map((item) => (
    <TouchableOpacity
      key={item.id}
      className="border-b border-gray-200 p-4 focus:bg-gray-100"
      onPress={() => selectItem(item)}
    >
      <Text>{item.title}</Text>
    </TouchableOpacity>
  ))}
</ScrollView>
```

### 8. Accessibility

- Always provide clear focus indicators
- Use `accessibilityLabel` for screen readers
- Maintain logical navigation order
- Test with actual TV remote

### 9. Platform-Specific Code

```jsx
import { Platform } from 'react-native';

const isTV = Platform.isTV;

<TouchableOpacity
  className={`p-4 ${isTV ? 'p-6' : 'p-4'}`}
  tvParallaxProperties={isTV ? {
    enabled: true,
    shiftDistanceX: 2,
    shiftDistanceY: 2,
  } : undefined}
>
  <Text>Cross-platform Button</Text>
</TouchableOpacity>
```

## Example: TV-Optimized Component

```jsx
const TVButton = ({ title, onPress, icon, focused }) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`
        flex-row items-center justify-center
        px-6 py-4 rounded-lg
        ${focused ? 'bg-blue-500 scale-105' : 'bg-gray-700'}
        transition-all duration-200
      `}
    >
      {icon && <Icon name={icon} size={24} color="white" />}
      <Text className={`
        text-lg font-semibold ml-2
        ${focused ? 'text-white' : 'text-gray-300'}
      `}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};
```

## Testing Tips

1. Use Android TV emulator or physical device
2. Test with keyboard arrow keys (they simulate D-pad)
3. Ensure all interactive elements are reachable
4. Verify focus doesn't get "trapped"
5. Test back button behavior

## Common Issues

1. **Focus Lost**: Always have at least one focusable element
2. **Focus Trap**: Ensure users can navigate out of all areas
3. **Small Targets**: Make buttons larger for TV (min 48dp)
4. **No Visual Feedback**: Always show focus state clearly
import { setHueLights } from './hue-direct';
import { EXPO_PUBLIC_HUE_BRIDGE_IP, EXPO_PUBLIC_HUE_APP_KEY, EXPO_PUBLIC_HUE_GROUP_ID } from '../../env.generated';

// Animation state management
let currentAnimation: NodeJS.Timeout | null = null;
let animationActive = false;

// Stop any running animation
export function stopAnimation() {
  if (currentAnimation) {
    clearInterval(currentAnimation);
    currentAnimation = null;
    animationActive = false;
    console.log('[LIGHTING-ANIMATION] Animation stopped');
  }
}

// Drift animation for work phase - gentle hue movement
export function startDriftAnimation(baseHue: number = 47000) {
  stopAnimation(); // Always stop previous animation first
  
  let currentHue = baseHue;
  let direction = 1;
  const HUE_DRIFT = 1500;
  const INTERVAL = 3000; // 3 seconds
  
  console.log('[LIGHTING-ANIMATION] Starting drift animation');
  animationActive = true;
  
  // Apply initial state
  setHueLights({
    bri: 254,
    hue: currentHue,
    sat: 200,
    transitiontime: 20 // 2 second transition
  });
  
  currentAnimation = setInterval(() => {
    if (!animationActive) return;
    
    // Calculate next hue
    currentHue += (HUE_DRIFT * direction);
    
    // Reverse direction at boundaries
    if (currentHue >= baseHue + HUE_DRIFT || currentHue <= baseHue - HUE_DRIFT) {
      direction *= -1;
    }
    
    // Wrap hue value (0-65535)
    if (currentHue < 0) currentHue += 65536;
    if (currentHue > 65535) currentHue -= 65536;
    
    console.log('[LIGHTING-ANIMATION] Drift: hue =', currentHue);
    
    setHueLights({
      bri: 254,
      hue: Math.round(currentHue),
      sat: 200,
      transitiontime: 30 // 3 second smooth transition
    });
  }, INTERVAL);
}

// Breathe animation for rest phase - brightness oscillation
export function startBreatheAnimation() {
  stopAnimation(); // Always stop previous animation first
  
  let currentBri = 100;
  let direction = 1;
  const BRI_RANGE = 20; // ±20 brightness
  const INTERVAL = 2000; // 2 seconds
  
  console.log('[LIGHTING-ANIMATION] Starting breathe animation');
  animationActive = true;
  
  // Apply initial state
  setHueLights({
    bri: currentBri,
    hue: 25000, // Green
    sat: 100,
    transitiontime: 10 // 1 second transition
  });
  
  currentAnimation = setInterval(() => {
    if (!animationActive) return;
    
    // Calculate next brightness
    currentBri += (BRI_RANGE * direction);
    
    // Reverse at boundaries
    if (currentBri >= 120 || currentBri <= 80) {
      direction *= -1;
    }
    
    console.log('[LIGHTING-ANIMATION] Breathe: brightness =', currentBri);
    
    setHueLights({
      bri: currentBri,
      hue: 25000,
      sat: 100,
      transitiontime: 20 // 2 second smooth transition
    });
  }, INTERVAL);
}

// Round transition flash
export async function roundFlash() {
  console.log('[LIGHTING-ANIMATION] Round flash');
  
  // Quick flash using alert
  await fetch(`http://${EXPO_PUBLIC_HUE_BRIDGE_IP || '192.168.8.192'}/api/${EXPO_PUBLIC_HUE_APP_KEY}/groups/${EXPO_PUBLIC_HUE_GROUP_ID || '0'}/action`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert: 'select' })
  });
  
  // After 300ms, set the round preset
  setTimeout(() => {
    setHueLights({
      bri: 200,
      hue: 10000,
      sat: 140,
      transitiontime: 2
    });
  }, 300);
}

// Countdown pulse for last 5 seconds
export function startCountdownPulse(onComplete?: () => void) {
  stopAnimation(); // Stop any running animation
  
  console.log('[LIGHTING-ANIMATION] Starting countdown pulse');
  
  let count = 5;
  const baseBri = 180;
  
  currentAnimation = setInterval(() => {
    if (count <= 0) {
      stopAnimation();
      if (onComplete) onComplete();
      return;
    }
    
    console.log('[LIGHTING-ANIMATION] Countdown:', count);
    
    // Pulse up
    setHueLights({
      bri: baseBri + 60, // Spike brightness
      hue: 47000,
      sat: 200,
      transitiontime: 2 // Quick 200ms
    });
    
    // Return to base after 400ms
    setTimeout(() => {
      setHueLights({
        bri: baseBri,
        hue: 47000,
        sat: 200,
        transitiontime: 3 // 300ms
      });
    }, 400);
    
    count--;
  }, 1000); // Every second
}

// Pause state - neutral lighting
export function setPauseState() {
  stopAnimation();
  console.log('[LIGHTING-ANIMATION] Setting pause state');
  
  setHueLights({
    bri: 120,
    hue: 8000, // Warm orange
    sat: 80,
    transitiontime: 10 // 1 second
  });
}
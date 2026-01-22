import type Sound from 'react-native-sound';

export interface FadeOptions {
  from: number;
  to: number;
  durationMs: number;
  easing?: 'linear' | 'easeInOut' | 'easeIn' | 'easeOut';
}

/**
 * Easing functions for smooth volume transitions
 */
const easingFunctions = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

/**
 * Animate volume on a Sound object from one level to another.
 * Uses requestAnimationFrame for smooth, frame-rate independent animation.
 *
 * @param sound - The react-native-sound Sound object
 * @param options - Fade configuration
 * @returns Promise that resolves when fade completes, or rejects if cancelled
 */
export function fadeVolume(
  sound: Sound,
  options: FadeOptions
): { promise: Promise<void>; cancel: () => void } {
  const { from, to, durationMs, easing = 'easeInOut' } = options;
  const easingFn = easingFunctions[easing];

  let animationFrameId: number | null = null;
  let cancelled = false;

  const promise = new Promise<void>((resolve, reject) => {
    const startTime = Date.now();

    // Set initial volume
    try {
      sound.setVolume(from);
    } catch (error) {
      reject(error);
      return;
    }

    const animate = () => {
      if (cancelled) {
        reject(new Error('Animation cancelled'));
        return;
      }

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = easingFn(progress);
      const volume = from + (to - from) * easedProgress;

      try {
        sound.setVolume(Math.max(0, Math.min(1, volume)));
      } catch (error) {
        // Continue animation even if one setVolume fails
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        try {
          sound.setVolume(to);
        } catch (error) {
          // Ignore final volume errors
        }
        resolve();
      }
    };

    // Start animation
    animationFrameId = requestAnimationFrame(animate);
  });

  const cancel = () => {
    cancelled = true;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  return { promise, cancel };
}

/**
 * Convenience function for fade-in (0 → target volume)
 */
export function fadeIn(
  sound: Sound,
  targetVolume: number = 0.8,
  durationMs: number = 500
): { promise: Promise<void>; cancel: () => void } {
  return fadeVolume(sound, {
    from: 0,
    to: targetVolume,
    durationMs,
    easing: 'easeOut',
  });
}

/**
 * Convenience function for fade-out (current volume → 0)
 */
export function fadeOut(
  sound: Sound,
  currentVolume: number = 0.8,
  durationMs: number = 800
): { promise: Promise<void>; cancel: () => void } {
  return fadeVolume(sound, {
    from: currentVolume,
    to: 0,
    durationMs,
    easing: 'easeIn',
  });
}

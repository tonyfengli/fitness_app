import 'vitest';

interface CustomMatchers<R = unknown> {
  toContainExerciseWithComplexity(complexity: string): R;
  toContainJointLoad(joint: string): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
'use client';

import { useEffect } from 'react';
import { sessionTestData } from '~/utils/sessionTestDataClient';

export function SessionTestDataInitializer() {
  useEffect(() => {
    // Make sessionTestData available globally in development
    if (process.env.NODE_ENV === 'development') {
      (window as any).sessionTestData = sessionTestData;
    }
  }, []);

  return null;
}
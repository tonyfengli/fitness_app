import React from 'react';
import { ThemeProvider as RestyleThemeProvider } from '@shopify/restyle';
import theme, { Theme } from '../theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <RestyleThemeProvider theme={theme}>
      {children}
    </RestyleThemeProvider>
  );
}

export { theme };
export type { Theme };
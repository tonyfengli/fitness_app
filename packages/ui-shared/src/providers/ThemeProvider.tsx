import React, { createContext, useContext, useEffect } from 'react';
import { Theme, defaultTheme, generateCSSVariables } from '../styles/theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export function CustomThemeProvider({ 
  children, 
  theme = defaultTheme,
  onThemeChange,
}: ThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = React.useState(theme);

  // Apply CSS variables when theme changes
  useEffect(() => {
    const cssVars = generateCSSVariables(currentTheme);
    const root = document.documentElement;
    
    Object.entries(cssVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Add theme name as data attribute for theme-specific styles
    root.setAttribute('data-theme', currentTheme.name);
  }, [currentTheme]);

  const handleSetTheme = (newTheme: Theme) => {
    setCurrentTheme(newTheme);
    onThemeChange?.(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
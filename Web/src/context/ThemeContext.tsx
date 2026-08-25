'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { lightColors, darkColors } from '../lib/colors';

const ThemeContext = createContext<any>(null);

const toBoolean = (value: any) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return false;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [colors, setColors] = useState(lightColors);

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      const isDarkMode = toBoolean(isDark);
      setColors(isDarkMode ? darkColors : lightColors);
      saveTheme(isDarkMode);
    }
  }, [isDark, isLoading]);

  const loadTheme = () => {
    try {
      if (typeof window !== 'undefined') {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme !== null) {
          setIsDark(savedTheme === 'dark');
        }
      }
    } catch (error) {
      // Error loading theme
    } finally {
      setIsLoading(false);
    }
  };

  const saveTheme = (dark: boolean) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', dark ? 'dark' : 'light');
      }
    } catch (error) {
      // Error saving theme
    }
  };

  const toggleTheme = () => {
    setIsDark(prev => !toBoolean(prev));
  };

  const setTheme = (dark: boolean) => {
    setIsDark(toBoolean(dark));
  };

  const isDarkMode = toBoolean(isDark);

  return (
    <ThemeContext.Provider value={{ colors, isDark: isDarkMode, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
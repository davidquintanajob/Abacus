import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { lightColors, darkColors } from './colors';

const ThemeContext = createContext();

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return false;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [colors, setColors] = useState(lightColors);

  // Cargar tema guardado al iniciar
  useEffect(() => {
    loadTheme();
  }, []);

  // Actualizar colores cuando cambia el tema
  useEffect(() => {
    if (!isLoading) {
      const isDarkMode = toBoolean(isDark);
      setColors(isDarkMode ? darkColors : lightColors);
      saveTheme(isDarkMode);
    }
  }, [isDark, isLoading]);

  const loadTheme = async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync('theme');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTheme = async (dark) => {
    try {
      await SecureStore.setItemAsync('theme', dark ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleTheme = () => {
    setIsDark(prev => !toBoolean(prev));
  };

  const setTheme = (dark) => {
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

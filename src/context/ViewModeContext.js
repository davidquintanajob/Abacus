import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ViewModeContext = createContext();

const VIEW_MODE_STORAGE_KEY = 'view_mode_preference';

export const ViewModeProvider = ({ children }) => {
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'

  // Load view mode from AsyncStorage on mount
  useEffect(() => {
    loadViewMode();
  }, []);

  const loadViewMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (savedMode === 'card' || savedMode === 'table') {
        setViewMode(savedMode);
      }
    } catch (error) {
      console.error('Error loading view mode:', error);
    }
  };

  const toggleViewMode = async () => {
    const newMode = viewMode === 'card' ? 'table' : 'card';
    setViewMode(newMode);
    try {
      await AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Error saving view mode:', error);
    }
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, toggleViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
};

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within a ViewModeProvider');
  }
  return context;
};

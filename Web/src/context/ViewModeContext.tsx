'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const ViewModeContext = createContext<any>(null);

const VIEW_MODE_STORAGE_KEY = 'view_mode_preference';

export const ViewModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Load view mode from localStorage on mount
  useEffect(() => {
    loadViewMode();
  }, []);

  const loadViewMode = () => {
    try {
      if (typeof window !== 'undefined') {
        const savedMode = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
        if (savedMode === 'card' || savedMode === 'table') {
          setViewMode(savedMode);
        }
      }
    } catch (error) {
      console.error('Error loading view mode:', error);
    }
  };

  const toggleViewMode = () => {
    const newMode = viewMode === 'card' ? 'table' : 'card';
    setViewMode(newMode);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, newMode);
      }
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

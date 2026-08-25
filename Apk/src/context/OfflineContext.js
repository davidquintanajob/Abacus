import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

const OfflineContext = createContext(null);

export const OfflineProvider = ({ children }) => {
  const { isOfflineMode, setOfflineMode } = useAuth();

  const enableOfflineMode = () => {
    setOfflineMode(true);
  };

  const disableOfflineMode = () => {
    setOfflineMode(false);
  };

  const value = {
    isOfflineMode,
    enableOfflineMode,
    disableOfflineMode,
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

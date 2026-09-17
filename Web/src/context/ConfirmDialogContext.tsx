'use client';

import React, { createContext, useContext, useState } from 'react';

interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmDialogContextType {
  dialog: ConfirmDialogState;
  showConfirmDialog: (data: Omit<ConfirmDialogState, 'visible'>) => void;
  hideConfirmDialog: () => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null);

export const ConfirmDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [dialog, setDialog] = useState<ConfirmDialogState>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  const showConfirmDialog = (data: Omit<ConfirmDialogState, 'visible'>) => {
    setDialog({ ...data, visible: true });
  };

  const hideConfirmDialog = () => {
    setDialog(prev => ({ ...prev, visible: false }));
  };

  return (
    <ConfirmDialogContext.Provider value={{ dialog, showConfirmDialog, hideConfirmDialog }}>
      {children}
    </ConfirmDialogContext.Provider>
  );
};

export const useConfirmDialog = () => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return context;
};

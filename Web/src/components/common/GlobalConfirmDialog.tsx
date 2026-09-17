'use client';

import React from 'react';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { ConfirmDialog } from './ConfirmDialog';

export const GlobalConfirmDialog = () => {
  const { dialog, hideConfirmDialog } = useConfirmDialog();

  return (
    <ConfirmDialog
      visible={dialog.visible}
      title={dialog.title}
      message={dialog.message}
      onConfirm={dialog.onConfirm}
      onCancel={hideConfirmDialog}
      type={dialog.type}
    />
  );
};

'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useModal } from '../../context/ModalContext';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger'
}: ConfirmDialogProps) => {
  const { colors, isDark } = useTheme();
  const { setModalOpen } = useModal();

  // Update modal state when visibility changes
  useEffect(() => {
    setModalOpen(visible);
  }, [visible, setModalOpen]);

  if (!visible) return null;

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          iconColor: '#DC2626',
          iconBg: isDarkMode ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)',
          confirmBg: '#DC2626',
          confirmHover: '#B91C1C'
        };
      case 'warning':
        return {
          iconColor: '#D97706',
          iconBg: isDarkMode ? 'rgba(217, 119, 6, 0.2)' : 'rgba(217, 119, 6, 0.1)',
          confirmBg: '#D97706',
          confirmHover: '#B45309'
        };
      case 'info':
        return {
          iconColor: '#2563EB',
          iconBg: isDarkMode ? 'rgba(37, 99, 235, 0.2)' : 'rgba(37, 99, 235, 0.1)',
          confirmBg: '#2563EB',
          confirmHover: '#1D4ED8'
        };
      default:
        return {
          iconColor: '#DC2626',
          iconBg: isDarkMode ? 'rgba(220, 38, 38, 0.2)' : 'rgba(220, 38, 38, 0.1)',
          confirmBg: '#DC2626',
          confirmHover: '#B91C1C'
        };
    }
  };

  const dialogColors = getColors();

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl shadow-2xl max-w-md w-full"
        style={{ 
          backgroundColor: colors.surface,
          border: `1px solid ${colors.outlineVariant}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: colors.outlineVariant }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: dialogColors.iconBg }}
            >
              <AlertTriangle size={20} color={dialogColors.iconColor} />
            </div>
            <h3 className="text-lg font-semibold" style={{ color: colors.onSurface }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            style={{ color: colors.onSurfaceVariant }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p style={{ color: colors.onSurface, lineHeight: '1.5' }}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t" style={{ borderColor: colors.outlineVariant }}>
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl font-medium transition-colors"
            style={{
              backgroundColor: colors.surfaceVariant,
              color: colors.onSurface
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl font-medium text-white transition-colors"
            style={{
              backgroundColor: dialogColors.confirmBg
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = dialogColors.confirmHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = dialogColors.confirmBg;
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

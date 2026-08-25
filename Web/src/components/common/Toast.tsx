'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const TOAST_CONFIG = {
  success: {
    background: '#16A34A',
    icon: CheckCircle,
    label: 'Éxito',
  },
  warning: {
    background: '#D97706',
    icon: AlertTriangle,
    label: 'Advertencia',
  },
  error: {
    background: '#DC2626',
    icon: XCircle,
    label: 'Error',
  },
};

interface ToastProps {
  visible: boolean;
  type?: 'success' | 'warning' | 'error';
  message: string;
  code?: number | null;
  duration?: number;
  onHide: () => void;
  toastKey?: number;
}

export const Toast = ({ 
  visible, 
  type = 'error', 
  message, 
  code, 
  duration = 4000, 
  onHide, 
  toastKey 
}: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const config = TOAST_CONFIG[type] || TOAST_CONFIG.error;
  const Icon = config.icon;

  useEffect(() => {
    if (visible) {
      setIsVisible(true);
      setIsAnimating(true);
      
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(() => {
          setIsVisible(false);
          if (onHide) onHide();
        }, 250);
      }, duration);

      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      setTimeout(() => {
        setIsVisible(false);
      }, 250);
    }
  }, [visible, toastKey, duration, onHide]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50
        rounded-xl shadow-lg
        flex items-center gap-3 p-3
        transition-all duration-300 ease-out
        ${isAnimating ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
      `}
      style={{ backgroundColor: config.background }}
    >
      <div className="flex-shrink-0">
        <Icon size={22} className="text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white/75 uppercase tracking-wider">
          {config.label}
        </p>
        <p className="text-sm font-medium text-white line-clamp-3">
          {message}
        </p>
        {code !== undefined && code !== null && (
          <p className="text-xs text-white/70 mt-1">
            Código: {code}
          </p>
        )}
      </div>

      <button
        onClick={() => {
          setIsAnimating(false);
          setTimeout(() => {
            setIsVisible(false);
            if (onHide) onHide();
          }, 250);
        }}
        className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
      >
        <X size={18} className="text-white/85" />
      </button>
    </div>
  );
};
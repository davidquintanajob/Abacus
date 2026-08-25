import { useState, useCallback } from 'react';

interface ToastState {
  visible: boolean;
  type: 'success' | 'warning' | 'error';
  message: string;
  code: number | null;
  duration: number;
  key: number;
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    type: 'error',
    message: '',
    code: null,
    duration: 4000,
    key: 0,
  });

  const showToast = useCallback(({ 
    type = 'error', 
    message = '', 
    code = null, 
    duration = 4000 
  }: Partial<ToastState> = {}) => {
    setToast((prev) => ({
      visible: true,
      type: type as 'success' | 'warning' | 'error',
      message,
      code,
      duration,
      key: prev.key + 1,
    }));
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toast, showToast, hideToast };
};
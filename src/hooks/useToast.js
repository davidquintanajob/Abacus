import { useState, useCallback, useRef } from 'react';

/**
 * Hook para controlar el Toast.
 *
 * Uso:
 *   const { toast, showToast, hideToast } = useToast();
 *   showToast({ type: 'error', message: 'Algo salió mal', code: 401 });
 *
 *   <Toast {...toast} onHide={hideToast} />
 */
export const useToast = () => {
  const [toast, setToast] = useState({
    visible: false,
    type: 'error',   // 'success' | 'warning' | 'error'
    message: '',
    code: null,
    duration: 4000,
    // key incremental para forzar reset de animación cuando se muestra uno nuevo
    key: 0,
  });

  const showToast = useCallback(({ type = 'error', message = '', code = null, duration = 4000 } = {}) => {
    setToast((prev) => ({
      visible: true,
      type,
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

import { useState, useCallback } from 'react';

/**
 * Hook para controlar el Toast con soporte para múltiples notificaciones apiladas.
 *
 * Uso (nuevo formato con múltiples toasts):
 *   const { toasts, showToast, hideToast } = useToast();
 *   showToast({ type: 'error', message: 'Algo salió mal', code: 401 });
 *
 *   {toasts.map((toast, index) => <Toast {...toast} onHide={() => hideToast(toast.id)} index={index} />)}
 *
 * Uso (formato antiguo backward-compatible):
 *   const { toast, showToast, hideToast } = useToast();
 *   showToast({ type: 'error', message: 'Algo salió mal', code: 401 });
 *
 *   <Toast {...toast} onHide={hideToast} toastKey={toast.key} />
 */
export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const [toast, setToast] = useState({
    visible: false,
    type: 'error',
    message: '',
    code: null,
    duration: 4000,
    key: 0,
  });

  const showToast = useCallback(({ type = 'error', message = '', code = null, duration = 4000 } = {}) => {
    // Nuevo formato: agregar al array de toasts
    const id = Date.now();
    setToasts((prev) => [
      ...prev,
      {
        id,
        visible: true,
        type,
        message,
        code,
        duration,
      },
    ]);

    // Auto-ocultar después de duration ms
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    // Formato antiguo backward-compatible
    setToast((prev) => ({
      visible: true,
      type,
      message,
      code,
      duration,
      key: prev.key + 1,
    }));
  }, []);

  const hideToast = useCallback((id) => {
    if (id) {
      // Nuevo formato: eliminar por ID
      setToasts((prev) => prev.filter((t) => t.id !== id));
    } else {
      // Formato antiguo: ocultar el toast único
      setToast((prev) => ({ ...prev, visible: false }));
    }
  }, []);

  return { toast, toasts, showToast, hideToast };
};

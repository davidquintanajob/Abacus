'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { Header } from '../../../components/layout/Header';
import { Toast } from '../../../components/common/Toast';
import { createTienda, updateTienda, getTiendaById } from '../../../services/tiendaService';
import { Edit } from 'lucide-react';

export default function TiendaFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const id = searchParams.get('id');
  const mode = searchParams.get('mode') || 'add';

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tienda, setTienda] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: '',
    activo: true,
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    if (id && (isEditMode || isViewMode)) {
      fetchTienda();
    }
  }, [id, mode]);

  const fetchTienda = async () => {
    try {
      setIsLoading(true);
      const data = await getTiendaById(id!);
      setTienda(data);
      setFormData({
        nombre: data.nombre || '',
        tipo: data.tipo || '',
        activo: data.activo !== undefined ? data.activo : true,
      });
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al cargar tienda' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.nombre.trim()) {
      showToast({ type: 'warning', message: 'El nombre es requerido' });
      return;
    }
    if (formData.nombre.length < 3 || formData.nombre.length > 100) {
      showToast({ type: 'error', message: 'El nombre debe tener entre 3 y 100 caracteres' });
      return;
    }
    if (!formData.tipo.trim()) {
      showToast({ type: 'warning', message: 'El tipo es requerido' });
      return;
    }
    if (formData.tipo.length < 2 || formData.tipo.length > 50) {
      showToast({ type: 'error', message: 'El tipo debe tener entre 2 y 50 caracteres' });
      return;
    }

    try {
      setIsSaving(true);

      if (isEditMode && id) {
        await updateTienda(id, formData);
        showToast({ type: 'success', message: 'Tienda actualizada correctamente' });
      } else {
        await createTienda(formData);
        showToast({ type: 'success', message: 'Tienda creada correctamente' });
      }
      
      router.push('/tiendas');
    } catch (err: any) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          showBackButton={true}
          onBackPress={() => router.push('/tiendas')}
          isDark={isDarkMode}
          title={isViewMode ? 'Información de la Tienda' : isEditMode ? 'Editar Tienda' : 'Agregar Tienda'}
          currentRoute="Tiendas"
        />

        <div className="pt-24 px-4 md:px-4 lg:px-4 pb-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando tienda...</p>
            </div>
          ) : (
            <div 
              className="rounded-2xl p-5 shadow-lg max-w-2xl mx-auto"
              style={{ backgroundColor: colors.surface }}
            >
              <div className="mb-5">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Nombre *
                </label>
                <input
                  type="text"
                  className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant,
                    fontFamily: 'Inter, sans-serif'
                  }}
                  placeholder="Nombre de la tienda"
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  disabled={isViewMode}
                />
              </div>

              <div className="mb-5">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Tipo *
                </label>
                <input
                  type="text"
                  className={`w-full rounded-lg px-4 py-3 md:px-4 md:py-3 border focus:outline-none focus:ring-2 ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant,
                    fontFamily: 'Inter, sans-serif'
                  }}
                  placeholder="Tipo de tienda"
                  value={formData.tipo}
                  onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                  disabled={isViewMode}
                />
              </div>

              <div className="mb-5">
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: colors.outline }}
                >
                  Estado
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    className={`relative w-20 h-7 rounded-full transition-colors ${isViewMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{ 
                      backgroundColor: formData.activo ? '#4CAF50' : '#F44336',
                    }}
                    onClick={() => !isViewMode && setFormData(prev => ({ ...prev, activo: !prev.activo }))}
                    disabled={isViewMode}
                  >
                    <div
                      className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform"
                      style={{
                        transform: formData.activo ? 'translateX(52px)' : 'translateX(0)',
                      }}
                    />
                  </button>
                  <span 
                    className="ml-3 font-medium"
                    style={{ color: colors.onSurface }}
                  >
                    {formData.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>

              {!isViewMode && (
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: colors.surface, 
                      borderColor: colors.outlineVariant,
                      color: colors.onSurface
                    }}
                    onClick={() => router.push('/tiendas')}
                  >
                    <span className="font-medium">Cancelar</span>
                  </button>
                  <button
                    className="flex-1 rounded-lg px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <span className="font-medium">Guardar</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {isViewMode && isAdmin && (
            <button
              className="w-full max-w-2xl mx-auto rounded-xl px-4 py-3 md:px-4 md:py-3 flex items-center justify-center gap-2 mt-6 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={() => router.push(`/tiendas/form?id=${id}&mode=edit`)}
            >
              <Edit size={18} />
              <span className="font-medium">Editar Tienda</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

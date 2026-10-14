'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { Header } from '../../../components/layout/Header';
import { Toast } from '../../../components/common/Toast';
import { createCuenta, updateCuenta, getCuentaById } from '../../../services/cuentaService';
import { ChevronDown, ArrowLeft, Save } from 'lucide-react';

const CuentaForm = ({ cuentaId: propCuentaId }: { cuentaId?: string } = {}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { toast, showToast } = useToast();

  const mode = searchParams.get('mode') || 'add';
  const cuentaId = propCuentaId || searchParams.get('id');

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCuenta, setIsFetchingCuenta] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    tipo_cuenta: '',
    num_cuenta: '',
    nota: '',
  });

  const [showTipoCuentaDropdown, setShowTipoCuentaDropdown] = useState(false);

  const tiposCuenta = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];

  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    const fetchCompleteCuenta = async () => {
      console.log('fetchCompleteCuenta called - cuentaId:', cuentaId, 'isEditMode:', isEditMode);
      if (cuentaId && isEditMode) {
        try {
          setIsFetchingCuenta(true);
          console.log('Fetching cuenta with ID:', cuentaId);
          const completeCuenta = await getCuentaById(cuentaId);
          console.log('Fetched cuenta data:', completeCuenta);
          setFormData({
            nombre: completeCuenta.nombre || '',
            tipo_cuenta: completeCuenta.tipo_cuenta || '',
            num_cuenta: completeCuenta.num_cuenta || '',
            nota: completeCuenta.nota || '',
          });
          console.log('FormData set to:', {
            nombre: completeCuenta.nombre || '',
            tipo_cuenta: completeCuenta.tipo_cuenta || '',
            num_cuenta: completeCuenta.num_cuenta || '',
            nota: completeCuenta.nota || '',
          });
        } catch (error) {
          console.error('Error fetching cuenta:', error);
          showToast({ type: 'error', message: error.message });
        } finally {
          setIsFetchingCuenta(false);
        }
      } else {
        console.log('Skipping fetch - cuentaId:', cuentaId, 'isEditMode:', isEditMode);
      }
    };

    fetchCompleteCuenta();
  }, [cuentaId, isEditMode]);

  const handleSave = async () => {
    if (!formData.nombre || formData.nombre.trim() === '') {
      showToast({ type: 'warning', message: 'Debe ingresar un nombre' });
      return;
    }
    if (!formData.tipo_cuenta) {
      showToast({ type: 'warning', message: 'Debe seleccionar un tipo de cuenta' });
      return;
    }

    try {
      setIsSaving(true);

      const cuentaData = {
        nombre: formData.nombre.trim(),
        tipo_cuenta: formData.tipo_cuenta,
        num_cuenta: formData.num_cuenta || null,
        nota: formData.nota.trim() || null,
      };

      if (isEditMode) {
        await updateCuenta(cuentaId, cuentaData);
        showToast({ type: 'success', message: 'Cuenta actualizada correctamente' });
      } else {
        await createCuenta(cuentaData);
        showToast({ type: 'success', message: 'Cuenta creada correctamente' });
      }

      router.push('/cuentas');
    } catch (error) {
      showToast({ type: 'error', message: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const getTipoCuentaColor = (tipo) => {
    switch (tipo) {
      case 'Efectivo CUP':
        return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50' };
      case 'Transferencia CUP':
        return { color: '#2196F3', bgColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', borderColor: '#2196F3' };
      case 'Efectivo USD':
        return { color: '#FF9800', bgColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', borderColor: '#FF9800' };
      case 'Transferencia USD':
        return { color: '#9C27B0', bgColor: isDarkMode ? 'rgba(156, 39, 176, 0.2)' : '#F3E5F5', borderColor: '#9C27B0' };
      default:
        return { color: '#757575', bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : '#F5F5F5', borderColor: '#757575' };
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: colors.background }}>
      <Header
        title={isEditMode ? 'Editar Cuenta' : isAddMode ? 'Nueva Cuenta' : 'Ver Cuenta'}
        showBackButton={true}
        onBackPress={() => router.push('/cuentas')}
        showLogo={false}
        currentRoute="/cuentas/form"
        isDark={isDarkMode}
      />

      <main className="max-w-2xl mx-auto p-6" style={{ marginTop: '100px' }}>
        {isFetchingCuenta ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" style={{ borderColor: colors.primary }}></div>
            <p className="mt-4" style={{ color: colors.outline }}>Cargando cuenta...</p>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6 shadow-lg"
            style={{ backgroundColor: colors.surface }}
          >
            {/* Nombre */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                Nombre *
              </label>
              <input
                type="text"
                className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant
                }}
                placeholder="Nombre de la cuenta"
                value={formData.nombre}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                disabled={isReadOnly}
              />
            </div>

            {/* Tipo de Cuenta */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                Tipo de Cuenta *
              </label>
              {!isReadOnly ? (
                <div className="relative">
                  <button
                    className="w-full rounded-lg px-4 py-3 border flex items-center justify-between focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant
                    }}
                    onClick={() => setShowTipoCuentaDropdown(!showTipoCuentaDropdown)}
                  >
                    <span>{formData.tipo_cuenta || 'Seleccionar tipo'}</span>
                    <ChevronDown size={18} style={{ color: colors.primary }} />
                  </button>
                  {showTipoCuentaDropdown && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                    >
                      {tiposCuenta.map((tipo) => (
                        <div
                          key={tipo}
                          className="px-4 py-3 cursor-pointer hover:opacity-80 border-b"
                          style={{ borderColor: colors.outlineVariant }}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, tipo_cuenta: tipo }));
                            setShowTipoCuentaDropdown(false);
                          }}
                        >
                          <span style={{ color: colors.onSurface }}>
                            {tipo}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="w-full rounded-lg px-4 py-3 border"
                  style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant }}
                >
                  <span
                    className="inline-flex items-center gap-2 px-2 py-1 rounded-full text-sm"
                    style={{
                      backgroundColor: getTipoCuentaColor(formData.tipo_cuenta).bgColor,
                      color: getTipoCuentaColor(formData.tipo_cuenta).color,
                      borderColor: getTipoCuentaColor(formData.tipo_cuenta).borderColor,
                      borderWidth: '1px'
                    }}
                  >
                    {formData.tipo_cuenta}
                  </span>
                </div>
              )}
            </div>

            {/* Número de Cuenta */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                Número de Cuenta
              </label>
              <input
                type="text"
                className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant
                }}
                placeholder="Número de cuenta (opcional)"
                value={formData.num_cuenta}
                onChange={(e) => setFormData(prev => ({ ...prev, num_cuenta: e.target.value }))}
                disabled={isReadOnly}
              />
            </div>

            {/* Nota */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                Nota
              </label>
              <textarea
                className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 resize-none"
                style={{
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                  minHeight: '100px'
                }}
                placeholder="Notas adicionales (opcional)"
                value={formData.nota}
                onChange={(e) => setFormData(prev => ({ ...prev, nota: e.target.value }))}
                disabled={isReadOnly}
                rows={4}
              />
            </div>

            {/* Actions */}
            {!isReadOnly && (
              <div className="flex gap-3">
                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px', color: colors.onSurface }}
                  onClick={() => router.push('/cuentas')}
                >
                  <span>Cancelar</span>
                </button>
                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Guardar</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        duration={toast.duration}
        onHide={() => {}}
      />
    </div>
  );
};

export default CuentaForm;

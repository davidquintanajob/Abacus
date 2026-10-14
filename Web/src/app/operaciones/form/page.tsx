'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { Header } from '../../../components/layout/Header';
import { SidebarNavigation } from '../../../components/layout/SidebarNavigation';
import { Toast } from '../../../components/common/Toast';
import { createOperacion, updateOperacion, getOperacionById } from '../../../services/operacionService';
import { getCuentas } from '../../../services/cuentaService';
import { configService } from '../../../services/configService';
import { ArrowLeft, Save, X, ChevronDown, Calendar } from 'lucide-react';
import { useRef } from 'react';

export default function OperacionFormPage({ operacionId: propOperacionId }: { operacionId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, operacionAccessLevels, operacionManagePermissions } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const sidebarNavRef = useRef<any>(null);

  const mode = searchParams.get('mode') || 'add';
  const operacionId = propOperacionId || searchParams.get('id');

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingOperacion, setIsFetchingOperacion] = useState(false);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentaSearchText, setCuentaSearchText] = useState('');
  const [config, setConfig] = useState<any>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [showTipoOperacionDropdown, setShowTipoOperacionDropdown] = useState(false);

  const [formData, setFormData] = useState({
    id_cuenta: null as number | null,
    id_usuario: null as number | null,
    cantidad_operacion: '',
    tipo_operacion: 'Ingreso',
    fecha_hora: new Date().toISOString(),
    motivo: '',
    cambio_moneda: '',
    cuenta: null as any,
    usuario: null as any,
  });

  const tiposOperacion = ['Ingreso', 'Retiro'];

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  const canManageOperaciones = 
    isAdmin ||
    (userRole === 'dependiente' && operacionManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && operacionManagePermissions?.almacenero) ||
    (userRole === 'económico' && operacionManagePermissions?.economico);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  useEffect(() => {
    fetchCuentas();
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchCompleteOperacion = async () => {
      if (operacionId) {
        try {
          setIsFetchingOperacion(true);
          const completeOperacion = await getOperacionById(operacionId);
          
          setFormData({
            id_cuenta: completeOperacion.id_cuenta,
            id_usuario: completeOperacion.id_usuario,
            cantidad_operacion: completeOperacion.cantidad_operacion?.toString() || '',
            tipo_operacion: completeOperacion.tipo_operacion,
            fecha_hora: completeOperacion.fecha_hora,
            motivo: completeOperacion.motivo || '',
            cambio_moneda: completeOperacion.cambio_moneda?.toString() || '',
            cuenta: completeOperacion.cuenta,
            usuario: completeOperacion.usuario,
          });
          
          if (completeOperacion.cuenta) {
            setCuentaSearchText(completeOperacion.cuenta.nombre);
          }
        } catch (err: any) {
          console.error('[fetchCompleteOperacion] Error:', err);
          showToast({ type: 'error', message: 'Error al cargar la operación' });
        } finally {
          setIsFetchingOperacion(false);
        }
      }
    };

    fetchCompleteOperacion();
  }, [operacionId]);

  const fetchCuentas = async () => {
    try {
      const response = await getCuentas({}, 1, 1000);
      setCuentas(response.data || []);
    } catch (error) {
      console.error('[fetchCuentas] Error:', error);
      setCuentas([]);
    }
  };

  const fetchConfig = async () => {
    try {
      const data = await configService.getConfig();
      setConfig(data);
      if (data && data.cupToUsdRate !== undefined) {
        const rate = data.cupToUsdRate;
        setExchangeRate(rate);
        if (isAddMode) {
          setFormData(prev => ({ ...prev, cambio_moneda: rate.toString() }));
        }
      }
    } catch (err) {
      console.error('[fetchConfig] Error:', err);
    }
  };

  const handleSave = async () => {
    if (!formData.cuenta) {
      showToast({ type: 'warning', message: 'Debe seleccionar una cuenta' });
      return;
    }
    if (!formData.cantidad_operacion || parseFloat(formData.cantidad_operacion) < 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor o igual a 0' });
      return;
    }
    if (!formData.tipo_operacion) {
      showToast({ type: 'warning', message: 'Debe seleccionar un tipo de operación' });
      return;
    }
    if (!formData.motivo || formData.motivo.trim() === '') {
      showToast({ type: 'warning', message: 'Debe ingresar un motivo' });
      return;
    }

    if (isEditMode && !isAdmin && formData.usuario?.id_usuario !== user?.id_usuario) {
      showToast({ type: 'error', message: 'No tiene permisos para modificar operaciones de otros usuarios' });
      return;
    }

    try {
      setIsSaving(true);

      const operacionData: any = {
        id_cuenta: formData.id_cuenta,
        cantidad_operacion: parseFloat(formData.cantidad_operacion),
        tipo_operacion: formData.tipo_operacion,
        fecha_hora: formData.fecha_hora,
        motivo: formData.motivo.trim(),
        cambio_moneda: parseFloat(formData.cambio_moneda) || 1,
        id_usuario: user.id_usuario,
      };

      if (isEditMode && operacionId) {
        await updateOperacion(operacionId, operacionData);
        showToast({ type: 'success', message: 'Operación actualizada correctamente' });
      } else {
        await createOperacion(operacionData);
        showToast({ type: 'success', message: 'Operación creada correctamente' });
      }

      router.push('/operaciones');
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al guardar la operación' });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredCuentas = cuentas.filter(cuenta =>
    cuenta.nombre.toLowerCase().includes(cuentaSearchText.toLowerCase())
  );

  const formatNumber = (value: number | string) => {
    if (value === null || value === undefined || value === '') return '0.00';
    const num = parseFloat(String(value));
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getOperacionTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'Ingreso':
        return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50' };
      case 'Retiro':
        return { color: '#F44336', bgColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#FFEBEE', borderColor: '#F44336' };
      default:
        return { color: '#757575', bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : '#F5F5F5', borderColor: '#757575' };
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
      
      <SidebarNavigation 
        currentRoute="Operaciones" 
        ref={sidebarNavRef}
      />

      <div
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header
          showBackButton={true}
          onBackPress={() => router.push('/operaciones')}
          isDark={isDarkMode}
          title={isEditMode ? 'Editar Operación' : isAddMode ? 'Nueva Operación' : 'Ver Operación'}
          showLogo={false}
          showMinimalHeader={true}
          currentRoute="Operaciones"
        />

        <div className="pt-20 px-4 md:px-4 lg:px-4 pb-8 max-w-4xl mx-auto">

          {isFetchingOperacion ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando datos...</p>
            </div>
          ) : (
            <div 
              className="rounded-2xl p-6 shadow-lg"
              style={{ backgroundColor: colors.surface }}
            >
              {/* Cuenta */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cuenta *
                </label>
                {!isReadOnly ? (
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant 
                      }}
                      placeholder="Buscar cuenta..."
                      value={cuentaSearchText}
                      onChange={(e) => setCuentaSearchText(e.target.value)}
                      onFocus={() => setShowCuentaDropdown(true)}
                    />
                    {cuentaSearchText && (
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        onClick={() => {
                          setCuentaSearchText('');
                          setFormData(prev => ({ ...prev, cuenta: null, id_cuenta: null }));
                        }}
                      >
                        <X size={18} style={{ color: colors.outline }} />
                      </button>
                    )}
                    {showCuentaDropdown && filteredCuentas.length > 0 && (
                      <div 
                        className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                        style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                      >
                        {filteredCuentas.map((cuenta) => (
                          <div
                            key={cuenta.id_cuenta}
                            className="px-4 py-3 cursor-pointer hover:opacity-80 border-b"
                            style={{ borderColor: colors.outlineVariant }}
                            onClick={() => {
                              setFormData(prev => ({ 
                                ...prev, 
                                id_cuenta: cuenta.id_cuenta,
                                cuenta: cuenta 
                              }));
                              setCuentaSearchText(cuenta.nombre);
                              setShowCuentaDropdown(false);
                            }}
                          >
                            <div className="font-medium" style={{ color: colors.onSurface }}>
                              {cuenta.nombre}
                            </div>
                            <div className="text-sm" style={{ color: colors.outline }}>
                              {cuenta.tipo_cuenta} • Fondo: {formatNumber(cuenta.fondo)}
                            </div>
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
                    <p style={{ color: colors.onSurface }}>
                      {formData.cuenta?.nombre || 'N/A'}
                    </p>
                  </div>
                )}
              </div>

              {/* Tipo de Operación y Fecha */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Tipo de Operación *
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
                      onClick={() => setShowTipoOperacionDropdown(!showTipoOperacionDropdown)}
                    >
                      <span>{formData.tipo_operacion}</span>
                      <ChevronDown size={18} style={{ color: colors.primary }} />
                    </button>
                    {showTipoOperacionDropdown && (
                      <div
                        className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10"
                        style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                      >
                        {tiposOperacion.map((tipo) => (
                          <div
                            key={tipo}
                            className="px-4 py-3 cursor-pointer hover:opacity-80 border-b"
                            style={{ borderColor: colors.outlineVariant }}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, tipo_operacion: tipo }));
                              setShowTipoOperacionDropdown(false);
                            }}
                          >
                            <span style={{ color: colors.onSurface }}>{tipo}</span>
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
                    <p style={{ color: colors.onSurface }}>
                      {formData.tipo_operacion}
                    </p>
                  </div>
                )}
              </div>

              {/* Cantidad and Fecha - Side by side on mobile/tablet */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Cantidad *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant
                    }}
                    placeholder="0.00"
                    value={formData.cantidad_operacion}
                    onChange={(e) => setFormData(prev => ({ ...prev, cantidad_operacion: e.target.value }))}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Fecha *
                  </label>
                  {!isReadOnly ? (
                    <input
                      type="date"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                        colorScheme: isDarkMode ? 'dark' : 'light'
                      }}
                      value={formData.fecha_hora ? new Date(formData.fecha_hora).toISOString().slice(0, 10) : ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, fecha_hora: new Date(e.target.value).toISOString() }))}
                    />
                  ) : (
                    <div
                      className="w-full rounded-lg px-4 py-3 border"
                      style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant }}
                    >
                      <p style={{ color: colors.onSurface }}>
                        {new Date(formData.fecha_hora).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Motivo */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Motivo *
                </label>
                <textarea
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 resize-none"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant,
                    minHeight: '100px'
                  }}
                  placeholder="Descripción del motivo..."
                  value={formData.motivo}
                  onChange={(e) => setFormData(prev => ({ ...prev, motivo: e.target.value }))}
                  disabled={isReadOnly}
                  rows={4}
                />
              </div>

              {/* Info de Cuenta */}
              {formData.cuenta && (
                <div 
                  className="rounded-xl p-4 mb-6"
                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#F5F5F5', borderColor: colors.primary, borderWidth: '1px' }}
                >
                  <h3 className="font-semibold mb-3" style={{ color: isDarkMode ? colors.onSurface : '#212121' }}>
                    Información de la Cuenta
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span style={{ color: isDarkMode ? colors.outline : '#616161' }}>Tipo:</span>
                      <span className="ml-2" style={{ color: isDarkMode ? colors.onSurface : '#212121' }}>
                        {formData.cuenta.tipo_cuenta}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: isDarkMode ? colors.outline : '#616161' }}>Fondo Actual:</span>
                      <span className="ml-2 font-medium" style={{ color: colors.primary }}>
                        {formatNumber(formData.cuenta.fondo)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: isDarkMode ? colors.outline : '#616161' }}>Tasa de Cambio:</span>
                      <span className="ml-2" style={{ color: isDarkMode ? colors.onSurface : '#212121' }}>
                        {exchangeRate ? formatNumber(exchangeRate) : 'N/A'}
                      </span>
                    </div>
                    {formData.cantidad_operacion && formData.tipo_operacion && (
                      <div>
                        <span style={{ color: isDarkMode ? colors.outline : '#616161' }}>
                          Fondo después de {formData.tipo_operacion.toLowerCase()}:
                        </span>
                        <span 
                          className="ml-2 font-medium"
                          style={{ color: formData.tipo_operacion === 'Retiro' ? '#F44336' : '#4CAF50' }}
                        >
                          {(() => {
                            const currentFund = parseFloat(formData.cuenta.fondo || 0);
                            const cantidad = parseFloat(formData.cantidad_operacion) || 0;
                            let newFund = currentFund;
                            if (formData.tipo_operacion === 'Ingreso') {
                              newFund = currentFund + cantidad;
                            } else if (formData.tipo_operacion === 'Retiro') {
                              newFund = currentFund - cantidad;
                            }
                            return formatNumber(newFund);
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                  {formData.cuenta.num_cuenta && (
                    <div className="mt-2 text-sm">
                      <span style={{ color: isDarkMode ? colors.outline : '#616161' }}>Número:</span>
                      <span className="ml-2" style={{ color: isDarkMode ? colors.onSurface : '#212121' }}>
                        {formData.cuenta.num_cuenta}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              {!isReadOnly && (
                <div className="flex gap-3">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px', color: colors.onSurface }}
                    onClick={() => router.push('/operaciones')}
                  >
                    <X size={18} />
                    <span>Cancelar</span>
                  </button>
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <>
                        <Save size={18} />
                        <span>{isEditMode ? 'Actualizar' : 'Crear'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

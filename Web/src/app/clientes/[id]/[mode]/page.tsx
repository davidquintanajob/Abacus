'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../hooks/useToast';
import { useNavigationLoading } from '../../../../context/NavigationLoadingContext';
import { useResponsive } from '../../../../hooks/useResponsive';
import { Header } from '../../../../components/layout/Header';
import { SidebarNavigation } from '../../../../components/layout/SidebarNavigation';
import { Toast } from '../../../../components/common/Toast';
import { getClienteById, createCliente, updateCliente, deleteCliente } from '../../../../services/clienteService';
import { getDeudas } from '../../../../services/deudaService';
import { getCuentas } from '../../../../services/cuentaService';
import { ArrowLeft, Save, Phone, MapPin, FileText, DollarSign, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

export default function ClienteFormPage() {
  const router = useRouter();
  const params = useParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, clienteManagePermissions } = useAuth();
  const isAdmin = user?.rol === 'Administrador';
  const { toast, showToast, hideToast } = useToast();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = React.useRef<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const id = params.id as string;
  const mode = params.mode as string;

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'create';
  const isReadOnly = isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [deudas, setDeudas] = useState<any[]>([]);
  const [isLoadingDeudas, setIsLoadingDeudas] = useState(false);
  const [expandedDeudas, setExpandedDeudas] = useState<Record<string, boolean>>({});
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedDeuda, setSelectedDeuda] = useState<any>(null);
  const [pagoFormData, setPagoFormData] = useState({
    cantidad_pagada: '',
    forma_pago: '',
    id_cuenta_operacion: '',
    nota: '',
  });
  const [showFormaPagoDropdown, setShowFormaPagoDropdown] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [formasPago] = useState(['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD']);
  const [cuentas, setCuentas] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    nombre: '',
    nota: '',
    direccion: '',
    telefono: '',
    localizacion_coordenadas_gps: '',
    tipo_cliente: '',
    descuento: '',
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const canManageClientes = isAdmin || clienteManagePermissions === true;

  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  useEffect(() => {
    const fetchCliente = async () => {
      if (id && id !== 'create') {
        try {
          setIsLoading(true);
          const clienteData = await getClienteById(id);
          setFormData({
            nombre: clienteData.nombre || '',
            nota: clienteData.nota || '',
            direccion: clienteData.direccion || '',
            telefono: clienteData.telefono || '',
            localizacion_coordenadas_gps: clienteData.localizacion_coordenadas_gps || '',
            tipo_cliente: clienteData.tipo_cliente || '',
            descuento: clienteData.descuento || '',
          });
        } catch (error: any) {
          showToast({ type: 'error', message: error.message || 'Error al cargar datos del cliente' });
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchCliente();
  }, [id]);

  // Cargar deudas del cliente
  useEffect(() => {
    const fetchDeudas = async () => {
      if (id && id !== 'create' && (isEditMode || isViewMode)) {
        try {
          setIsLoadingDeudas(true);
          const deudasData = await getDeudas({ id_cliente: id }, 1, 1000);
          setDeudas(deudasData.data || []);
        } catch (error: any) {
          console.error('Error al cargar deudas:', error);
          setDeudas([]);
        } finally {
          setIsLoadingDeudas(false);
        }
      }
    };

    fetchDeudas();
  }, [id, isEditMode, isViewMode]);

  // Cargar cuentas
  useEffect(() => {
    const fetchCuentas = async () => {
      try {
        const cuentasData = await getCuentas({}, 1, 1000);
        setCuentas(cuentasData.data || []);
      } catch (error: any) {
        console.error('Error al cargar cuentas:', error);
        setCuentas([]);
      }
    };

    fetchCuentas();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      showToast({ type: 'error', message: 'El nombre es obligatorio' });
      return;
    }

    try {
      setIsSaving(true);

      if (isAddMode) {
        await createCliente(formData);
        showToast({ type: 'success', message: 'Cliente creado correctamente' });
      } else if (isEditMode) {
        await updateCliente(id, formData);
        showToast({ type: 'success', message: 'Cliente actualizado correctamente' });
      }

      router.push('/clientes');
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al guardar cliente' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCall = () => {
    if (!formData.telefono) {
      showToast({ type: 'error', message: 'El cliente no tiene teléfono' });
      return;
    }

    if (isMobile) {
      window.location.href = `tel:${formData.telefono}`;
    } else {
      showToast({ type: 'warning', message: 'La función de llamada solo está disponible en dispositivos móviles' });
    }
  };

  const handleOpenMaps = () => {
    setShowInstructionsModal(true);
  };

  const handleConfirmOpenMaps = () => {
    setShowInstructionsModal(false);
    const url = 'https://www.google.com/maps';
    window.open(url, '_blank');
  };

  const handleOpenPagoModal = (deuda: any) => {
    setSelectedDeuda(deuda);
    setPagoFormData({
      cantidad_pagada: '',
      forma_pago: '',
      id_cuenta_operacion: '',
      nota: '',
    });
    setShowPagoModal(true);
  };

  const handleClosePagoModal = () => {
    setShowPagoModal(false);
    setSelectedDeuda(null);
    setPagoFormData({
      cantidad_pagada: '',
      forma_pago: '',
      id_cuenta_operacion: '',
      nota: '',
    });
  };

  const handleAddPago = async () => {
    if (!pagoFormData.cantidad_pagada || !pagoFormData.forma_pago) {
      showToast({ type: 'error', message: 'La cantidad y la forma de pago son obligatorias' });
      return;
    }

    try {
      const pago = {
        cantidad_pagada: parseFloat(pagoFormData.cantidad_pagada),
        forma_pago: pagoFormData.forma_pago,
        id_cuenta_operacion: pagoFormData.id_cuenta_operacion,
        nota: pagoFormData.nota,
        fecha_pago: new Date().toISOString(),
      };

      // Recargar deudas
      const deudasData = await getDeudas({ id_cliente: id }, 1, 1000);
      setDeudas(deudasData.data || []);

      handleClosePagoModal();
      showToast({ type: 'success', message: 'Pago agregado correctamente' });
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al agregar pago' });
    }
  };

  if (!canManageClientes && !isViewMode) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background }}>
        <div className="text-center">
          <p style={{ color: colors.onSurface }}>No tienes permisos para gestionar clientes</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        showBackButton={true}
        onBackPress={() => router.push('/clientes')}
        isDark={isDarkMode}
        title={isAddMode ? 'Nuevo Cliente' : isEditMode ? 'Editar Cliente' : 'Ver Cliente'}
        showLogo={false}
      />
      <SidebarNavigation ref={sidebarNavRef} currentRoute="Clientes" />

      <div
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <div
          style={{
            marginTop: '80px',
            marginRight: 'auto',
            marginBottom: '0',
            marginLeft: 'auto',
            paddingTop: isMobile ? '20px' : isTablet ? '32px' : '20px',
            paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
            paddingBottom: '120px',
            paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
            maxWidth: isDesktop ? '800px' : '100%',
          }}
        >
          {isLoading ? (
            <div className="rounded-2xl p-8 flex items-center justify-center" style={{ backgroundColor: colors.surface }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: colors.primary }}></div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: colors.surface }}>
              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      opacity: isReadOnly ? 0.6 : 1,
                    }}
                    placeholder="Nombre del cliente"
                    value={formData.nombre}
                    onChange={(e) => handleInputChange('nombre', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Teléfono y Tipo de Cliente */}
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Teléfono
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                        opacity: isReadOnly ? 0.6 : 1,
                      }}
                      placeholder="Teléfono"
                      value={formData.telefono}
                      onChange={(e) => handleInputChange('telefono', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Tipo de Cliente
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                        opacity: isReadOnly ? 0.6 : 1,
                      }}
                      placeholder="Tipo de cliente"
                      value={formData.tipo_cliente}
                      onChange={(e) => handleInputChange('tipo_cliente', e.target.value)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Dirección
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      opacity: isReadOnly ? 0.6 : 1,
                    }}
                    placeholder="Dirección"
                    value={formData.direccion}
                    onChange={(e) => handleInputChange('direccion', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Coordenadas GPS */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Coordenadas GPS
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                        opacity: isReadOnly ? 0.6 : 1,
                      }}
                      placeholder="Coordenadas GPS"
                      value={formData.localizacion_coordenadas_gps}
                      onChange={(e) => handleInputChange('localizacion_coordenadas_gps', e.target.value)}
                      disabled={isReadOnly}
                    />
                    <button
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD' }}
                      onClick={() => setShowInstructionsModal(true)}
                    >
                      <MapPin size={20} style={{ color: '#2196F3' }} />
                    </button>
                  </div>
                </div>

                {/* Descuento */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Descuento
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      opacity: isReadOnly ? 0.6 : 1,
                    }}
                    placeholder="Descuento"
                    value={formData.descuento}
                    onChange={(e) => handleInputChange('descuento', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Nota */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Nota
                  </label>
                  <textarea
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      opacity: isReadOnly ? 0.6 : 1,
                      minHeight: '100px',
                    }}
                    placeholder="Notas adicionales"
                    value={formData.nota}
                    onChange={(e) => handleInputChange('nota', e.target.value)}
                    disabled={isReadOnly}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              {!isReadOnly && (
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      border: '1px solid'
                    }}
                    onClick={() => router.push('/clientes')}
                  >
                    Cancelar
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
                        <Save size={20} />
                        <span>{isAddMode ? 'Crear Cliente' : 'Guardar Cambios'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {isReadOnly && canManageClientes && (
                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={() => router.push(`/clientes/${id}/edit`)}
                  >
                    <Edit size={20} />
                    <span>Editar</span>
                  </button>
                  <button
                    className="rounded-lg px-4 py-3 transition-colors hover:opacity-80"
                    style={{ backgroundColor: colors.outlineVariant, color: colors.onSurface }}
                    onClick={() => router.push('/clientes')}
                  >
                    Volver
                  </button>
                </div>
              )}

              {isReadOnly && !canManageClientes && (
                <div className="mt-6">
                  <button
                    className="w-full rounded-lg px-4 py-3 transition-colors hover:opacity-80"
                    style={{ backgroundColor: colors.outlineVariant, color: colors.onSurface }}
                    onClick={() => router.push('/clientes')}
                  >
                    Volver
                  </button>
                </div>
              )}

              {/* Sección de Deudas del Cliente */}
              {(isEditMode || isViewMode) && (
                <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: colors.background }}>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: colors.onSurface }}>Deudas del Cliente</h3>

                  {isLoadingDeudas ? (
                    <div className="text-center py-4" style={{ color: colors.outline }}>
                      Cargando deudas...
                    </div>
                  ) : deudas.length === 0 ? (
                    <div className="text-center py-4" style={{ color: colors.outline }}>
                      No hay deudas registradas para este cliente
                    </div>
                  ) : (
                    deudas.map((deuda) => {
                      const isExpanded = expandedDeudas[deuda.id_deuda];
                      const montoRestanteCup = (deuda.monto_cup || 0) - (deuda.pagos?.reduce((sum: number, pago: any) => sum + (pago.cantidad_pagada || 0), 0) || 0);
                      const montoRestanteUsd = (deuda.monto_usd || 0) - (deuda.pagos?.reduce((sum: number, pago: any) => sum + (pago.cantidad_pagada || 0), 0) || 0);
                      const isSaldada = deuda.estado === true || (montoRestanteCup <= 0 && montoRestanteUsd <= 0);

                      return (
                        <div
                          key={deuda.id_deuda}
                          className="mb-3 p-4 rounded-lg border"
                          style={{
                            backgroundColor: isSaldada ? (isDarkMode ? 'rgba(76, 175, 80, 0.1)' : '#E8F5E9') : (isDarkMode ? 'rgba(33, 150, 243, 0.1)' : '#E3F2FD'),
                            borderColor: isSaldada ? '#4CAF50' : '#2196F3',
                          }}
                        >
                          <div
                            className="w-full flex items-center justify-between cursor-pointer"
                            onClick={() => setExpandedDeudas(prev => ({ ...prev, [deuda.id_deuda]: !prev[deuda.id_deuda] }))}
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown size={20} style={{ color: isSaldada ? '#4CAF50' : '#2196F3' }} /> : <ChevronUp size={20} style={{ color: isSaldada ? '#4CAF50' : '#2196F3' }} />}
                              <div>
                                <div className="text-sm" style={{ color: colors.onSurface }}>
                                  {new Date(deuda.fecha_hora).toLocaleDateString()}
                                </div>
                                <div className="text-xs font-semibold" style={{ color: isSaldada ? '#4CAF50' : '#F44336' }}>
                                  {isSaldada ? 'Saldada' : 'Pendiente'}
                                </div>
                              </div>
                            </div>
                            {!isSaldada && (
                              <button
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPagoModal(deuda);
                                }}
                              >
                                <span className="text-2xl font-bold" style={{ color: colors.primary }}>+</span>
                              </button>
                            )}
                          </div>

                          {isExpanded && (
                            <div className="mt-3 space-y-2">
                              <div>
                                <span className="text-sm" style={{ color: colors.outline }}>Monto deuda: </span>
                                {(deuda.monto_cup && parseFloat(deuda.monto_cup) > 0) && (
                                  <span className="text-sm" style={{ color: colors.onSurface }}>CUP = ${deuda.monto_cup}</span>
                                )}
                                {(deuda.monto_usd && parseFloat(deuda.monto_usd) > 0) && (
                                  <span className="text-sm ml-2" style={{ color: colors.onSurface }}>USD = ${deuda.monto_usd}</span>
                                )}
                              </div>

                              {(!isSaldada && (montoRestanteCup > 0 || montoRestanteUsd > 0)) && (
                                <div>
                                  <span className="text-sm" style={{ color: colors.outline }}>Restante: </span>
                                  {montoRestanteCup > 0 && (
                                    <span className="text-sm font-bold" style={{ color: '#F44336' }}>CUP = ${montoRestanteCup.toFixed(2)}</span>
                                  )}
                                  {montoRestanteUsd > 0 && (
                                    <span className="text-sm font-bold ml-2" style={{ color: '#F44336' }}>USD = ${montoRestanteUsd.toFixed(2)}</span>
                                  )}
                                </div>
                              )}

                              {deuda.nota && (
                                <div className="text-sm" style={{ color: colors.outline }}>
                                  {deuda.nota}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />

      {/* Google Maps Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{ backgroundColor: colors.surface }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: colors.onSurface }}>
              Abrir Google Maps
            </h2>
            <p className="mb-6" style={{ color: colors.outline }}>
              Se abrirá Google Maps para que puedas buscar y copiar las coordenadas GPS de la ubicación del cliente.
            </p>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.outlineVariant, color: colors.onSurface }}
                onClick={() => setShowInstructionsModal(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleConfirmOpenMaps}
              >
                Abrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar pago de deuda */}
      {showPagoModal && selectedDeuda && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{ backgroundColor: colors.surface }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: colors.onSurface }}>
              Agregar Pago
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cantidad a pagar
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  placeholder="Cantidad"
                  value={pagoFormData.cantidad_pagada}
                  onChange={(e) => setPagoFormData(prev => ({ ...prev, cantidad_pagada: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Forma de pago
                </label>
                <div className="relative">
                  <button
                    className="w-full rounded-lg px-4 py-3 border flex items-center justify-between"
                    style={{
                      backgroundColor: colors.background,
                      color: pagoFormData.forma_pago ? colors.onSurface : colors.outline,
                      borderColor: colors.outlineVariant,
                    }}
                    onClick={() => setShowFormaPagoDropdown(!showFormaPagoDropdown)}
                  >
                    <span>{pagoFormData.forma_pago || 'Seleccionar forma de pago'}</span>
                    <span style={{ color: colors.outline }}>
                      {showFormaPagoDropdown ? '▲' : '▼'}
                    </span>
                  </button>
                  {showFormaPagoDropdown && (
                    <div className="absolute w-full mt-1 rounded-lg shadow-lg z-10" style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, border: '1px solid' }}>
                      {formasPago.map((forma) => (
                        <button
                          key={forma}
                          className="w-full px-4 py-3 text-left hover:opacity-80"
                          style={{ color: colors.onSurface }}
                          onClick={() => {
                            setPagoFormData(prev => ({ ...prev, forma_pago: forma, id_cuenta_operacion: '' }));
                            setShowFormaPagoDropdown(false);
                          }}
                        >
                          {forma}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cuenta de Operación
                </label>
                <div className="relative">
                  <button
                    className="w-full rounded-lg px-4 py-3 border flex items-center justify-between"
                    style={{
                      backgroundColor: colors.background,
                      color: pagoFormData.id_cuenta_operacion ? colors.onSurface : colors.outline,
                      borderColor: colors.outlineVariant,
                    }}
                    onClick={() => setShowCuentaDropdown(!showCuentaDropdown)}
                  >
                    <span>
                      {pagoFormData.id_cuenta_operacion
                        ? cuentas.find(c => c.id_cuenta === parseInt(pagoFormData.id_cuenta_operacion))?.nombre || 'Cuenta seleccionada'
                        : 'Seleccionar cuenta'}
                    </span>
                    <span style={{ color: colors.outline }}>
                      {showCuentaDropdown ? '▲' : '▼'}
                    </span>
                  </button>
                  {showCuentaDropdown && (
                    <div className="absolute w-full mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto" style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, border: '1px solid' }}>
                      {cuentas
                        .filter(cuenta => !pagoFormData.forma_pago || cuenta.tipo_cuenta === pagoFormData.forma_pago)
                        .map((cuenta) => (
                          <button
                            key={cuenta.id_cuenta}
                            className="w-full px-4 py-3 text-left hover:opacity-80"
                            style={{ color: colors.onSurface }}
                            onClick={() => {
                              setPagoFormData(prev => ({
                                ...prev,
                                id_cuenta_operacion: String(cuenta.id_cuenta),
                                forma_pago: cuenta.tipo_cuenta || prev.forma_pago
                              }));
                              setShowCuentaDropdown(false);
                            }}
                          >
                            {cuenta.nombre} ({cuenta.tipo_cuenta || 'Sin tipo'})
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Nota del pago
                </label>
                <textarea
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                    minHeight: '60px',
                  }}
                  placeholder="Notas sobre el pago"
                  value={pagoFormData.nota}
                  onChange={(e) => setPagoFormData(prev => ({ ...prev, nota: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.outlineVariant, color: colors.onSurface }}
                onClick={handleClosePagoModal}
              >
                Cancelar
              </button>
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleAddPago}
              >
                Agregar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

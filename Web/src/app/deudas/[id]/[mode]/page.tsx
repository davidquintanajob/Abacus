'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../hooks/useToast';
import { useNavigationLoading } from '../../../../context/NavigationLoadingContext';
import { useResponsive } from '../../../../hooks/useResponsive';
import { Header } from '../../../../components/layout/Header';
import { SidebarNavigation } from '../../../../components/layout/SidebarNavigation';
import { Toast } from '../../../../components/common/Toast';
import { getDeudaById, createDeuda, updateDeuda, saldarDeuda, deleteDeuda } from '../../../../services/deudaService';
import { getClientes } from '../../../../services/clienteService';
import { getCuentas } from '../../../../services/cuentaService';
import { configService } from '../../../../services/configService';
import { ArrowLeft, Save, DollarSign, Calendar, FileText, Edit, Trash2, Plus, ChevronDown, ChevronUp, X } from 'lucide-react';

export default function DeudaFormPage() {
  const router = useRouter();
  const params = useParams();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, deudaManagePermissions } = useAuth();
  const isAdmin = user?.rol === 'Administrador';
  const { toast, showToast, hideToast } = useToast();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

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
  const [clientes, setClientes] = useState<any[]>([]);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [clienteSearchText, setClienteSearchText] = useState('');
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [editingPago, setEditingPago] = useState<any>(null);
  const [pagosList, setPagosList] = useState<any[]>([]);
  const [showFormaPagoDropdown, setShowFormaPagoDropdown] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [formasPago] = useState(['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD']);

  const [formData, setFormData] = useState({
    id_cliente: '',
    monto_cup: '',
    monto_usd: '',
    nota: '',
    fecha_hora: new Date().toISOString().split('T')[0],
    cambio_moneda: '1',
  });

  const [pagoFormData, setPagoFormData] = useState({
    cantidad_pagada: '',
    forma_pago: '',
    cambio_moneda: '1',
    id_cuenta_operacion: '',
    nota: '',
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const canManageDeudas = isAdmin || deudaManagePermissions === true;

  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const data = await getClientes({}, 1, 1000);
        setClientes(data.data || []);
      } catch (error) {
        console.error('Error al cargar clientes:', error);
        setClientes([]);
      }
    };

    const fetchCuentas = async () => {
      try {
        const cuentasData = await getCuentas({}, 1, 1000);
        let allCuentas = cuentasData.data || [];
        
        if (user?.id_tienda) {
          try {
            const config = await configService.getConfig();
            const tiendaCuentasConfig = config.tiendaCuentasConfig || {};
            const tiendaConfig = tiendaCuentasConfig[user.id_tienda];
            
            if (tiendaConfig) {
              const cuentasPermitidas = [
                ...(tiendaConfig.efectivo_cup || []),
                ...(tiendaConfig.efectivo_usd || []),
                ...(tiendaConfig.transferencia_cup || []),
                ...(tiendaConfig.transferencia_usd || []),
              ];
              const cuentaIdsPermitidos = new Set(cuentasPermitidas.map((c: any) => c.id_cuenta));
              allCuentas = allCuentas.filter((cuenta: any) => cuentaIdsPermitidos.has(cuenta.id_cuenta));
            }
          } catch (error) {
            console.error('Error al cargar configuración de cuentas:', error);
          }
        }
        
        setCuentas(allCuentas);
      } catch (error) {
        console.error('Error al cargar cuentas:', error);
        setCuentas([]);
      }
    };

    fetchClientes();
    fetchCuentas();
  }, [user?.id_tienda]);

  useEffect(() => {
    const fetchDeuda = async () => {
      if (id && id !== 'create') {
        try {
          setIsLoading(true);
          const deudaData = await getDeudaById(id);
          setFormData({
            id_cliente: deudaData.id_cliente?.toString() || '',
            monto_cup: deudaData.monto_cup?.toString() || '',
            monto_usd: deudaData.monto_usd?.toString() || '',
            nota: deudaData.nota || '',
            fecha_hora: deudaData.fecha_hora ? deudaData.fecha_hora.split('T')[0] : new Date().toISOString().split('T')[0],
            cambio_moneda: deudaData.cambio_moneda?.toString() || '1',
          });
          setPagosList(deudaData.pagos || []);
        } catch (error: any) {
          showToast({ type: 'error', message: error.message || 'Error al cargar datos de la deuda' });
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchDeuda();
  }, [id]);

  const handleSave = async () => {
    if (!formData.id_cliente) {
      showToast({ type: 'warning', message: 'Debe seleccionar un cliente' });
      return;
    }
    if (!formData.monto_cup && !formData.monto_usd) {
      showToast({ type: 'warning', message: 'Debe ingresar al menos un monto (CUP o USD)' });
      return;
    }

    setIsSaving(true);
    try {
      const deudaData = {
        id_cliente: parseInt(formData.id_cliente),
        monto_cup: formData.monto_cup ? parseFloat(formData.monto_cup) : 0,
        monto_usd: formData.monto_usd ? parseFloat(formData.monto_usd) : 0,
        nota: formData.nota,
        fecha_hora: new Date(formData.fecha_hora).toISOString(),
        cambio_moneda: parseFloat(formData.cambio_moneda) || 1,
        pagos: pagosList,
      };

      if (isAddMode) {
        await createDeuda(deudaData);
        showToast({ type: 'success', message: 'Deuda creada correctamente' });
      } else if (isEditMode) {
        await updateDeuda(id, deudaData, pagosList);
        showToast({ type: 'success', message: 'Deuda actualizada correctamente' });
      }

      router.push('/deudas');
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al guardar la deuda' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta deuda?')) return;

    try {
      await deleteDeuda(id);
      showToast({ type: 'success', message: 'Deuda eliminada correctamente' });
      router.push('/deudas');
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al eliminar la deuda' });
    }
  };

  const handleAddPago = async () => {
    if (!pagoFormData.cantidad_pagada || pagoFormData.cantidad_pagada.trim() === '') {
      showToast({ type: 'warning', message: 'La cantidad es obligatoria' });
      return;
    }
    const cantidad = parseFloat(pagoFormData.cantidad_pagada);
    if (isNaN(cantidad) || cantidad <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor que cero' });
      return;
    }
    if (!pagoFormData.forma_pago || pagoFormData.forma_pago.trim() === '') {
      showToast({ type: 'warning', message: 'La forma de pago es obligatoria' });
      return;
    }
    if (!pagoFormData.id_cuenta_operacion || pagoFormData.id_cuenta_operacion.trim() === '') {
      showToast({ type: 'warning', message: 'Debe seleccionar una cuenta de operación' });
      return;
    }

    try {
      const nuevoPago = {
        id_pago_deuda: editingPago?.id_pago_deuda || Date.now(),
        cantidad_pagada: parseFloat(pagoFormData.cantidad_pagada),
        forma_pago: pagoFormData.forma_pago,
        cambio_moneda: parseFloat(pagoFormData.cambio_moneda) || 1,
        id_cuenta_operacion: parseInt(pagoFormData.id_cuenta_operacion),
        fecha_hora: new Date().toISOString(),
        nota: pagoFormData.nota || null,
        temp: !editingPago,
      };

      if (editingPago) {
        setPagosList(prev => prev.map(p => p.id_pago_deuda === editingPago.id_pago_deuda ? nuevoPago : p));
        showToast({ type: 'success', message: 'Pago actualizado (guarda los cambios para aplicar)' });
      } else {
        setPagosList(prev => [...prev, nuevoPago]);
        showToast({ type: 'success', message: 'Pago agregado (guarda los cambios para aplicar)' });
      }

      setEditingPago(null);
      setShowPagoModal(false);
      setPagoFormData({
        cantidad_pagada: '',
        forma_pago: '',
        cambio_moneda: '1',
        id_cuenta_operacion: '',
        nota: '',
      });
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al agregar pago' });
    }
  };

  const handleEditPago = (pago: any) => {
    setEditingPago(pago);
    setPagoFormData({
      cantidad_pagada: pago.cantidad_pagada?.toString() || '',
      forma_pago: pago.forma_pago || '',
      cambio_moneda: pago.cambio_moneda?.toString() || '1',
      id_cuenta_operacion: pago.id_cuenta_operacion?.toString() || '',
      nota: pago.nota || '',
    });
    setShowPagoModal(true);
  };

  const handleDeletePago = (pagoId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este pago?')) return;
    setPagosList(prev => prev.filter(p => p.id_pago_deuda !== pagoId));
    showToast({ type: 'success', message: 'Pago eliminado (guarda los cambios para aplicar)' });
  };

  const filteredClientes = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(clienteSearchText.toLowerCase())
  );

  const selectedCliente = clientes.find(c => c.id_cliente === parseInt(formData.id_cliente));

  if (isLoading) {
    return (
      <>
        <Header
          onMenuPress={handleMenuPress}
          onThemePress={toggleTheme}
          onNotificationsPress={() => {}}
          onProfilePress={() => router.push('/profile')}
          showBackButton={true}
          onBackPress={() => router.push('/deudas')}
          showLogo={false}
          isDark={isDarkMode}
          title={isAddMode ? 'Nueva Deuda' : isEditMode ? 'Editar Deuda' : 'Ver Deuda'}
        />
        <SidebarNavigation ref={sidebarNavRef} currentRoute="Deudas" />
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2" style={{ borderColor: colors.primary }}></div>
        </div>
        <Toast
          visible={toast.visible}
          type={toast.type}
          message={toast.message}
          onHide={hideToast}
        />
      </>
    );
  }

  return (
    <>
      <Header
        onMenuPress={handleMenuPress}
        onThemePress={toggleTheme}
        onNotificationsPress={() => {}}
        onProfilePress={() => router.push('/profile')}
        showBackButton={true}
        onBackPress={() => router.push('/deudas')}
        showLogo={false}
        isDark={isDarkMode}
        title={isAddMode ? 'Nueva Deuda' : isEditMode ? 'Editar Deuda' : 'Ver Deuda'}
        showMinimalHeader={true}
      />
      <SidebarNavigation ref={sidebarNavRef} currentRoute="Deudas" />

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
          <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: colors.surface }}>
            <h1 className="text-2xl font-bold mb-6" style={{ color: colors.onSurface }}>
              {isAddMode ? 'Crear Nueva Deuda' : isEditMode ? 'Editar Deuda' : 'Detalle de Deuda'}
            </h1>

            <div className="space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cliente *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => !isReadOnly && setShowClienteDropdown(!showClienteDropdown)}
                      className="w-full px-4 py-3 rounded-lg border-2 text-left flex justify-between items-center"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                      }}
                    >
                      <span>{selectedCliente?.nombre || 'Seleccionar cliente...'}</span>
                      {!isReadOnly && <ChevronDown size={20} style={{ color: colors.outline }} />}
                    </button>
                  {showClienteDropdown && !isReadOnly && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                      <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={clienteSearchText}
                        onChange={(e) => setClienteSearchText(e.target.value)}
                        className="w-full px-4 py-2 border-b"
                        style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }}
                      />
                      <div className="max-h-60 overflow-y-auto">
                        {filteredClientes.map((cliente) => (
                          <button
                            key={cliente.id_cliente}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, id_cliente: cliente.id_cliente.toString() }));
                              setShowClienteDropdown(false);
                              setClienteSearchText('');
                            }}
                            className="w-full px-4 py-2 text-left hover:opacity-80"
                            style={{ color: colors.onSurface }}
                          >
                            {cliente.nombre}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                  {isAddMode && (
                    <button
                      onClick={() => router.push('/clientes/create/create?returnTo=/deudas/create/create')}
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Plus size={20} style={{ color: '#fff' }} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Monto CUP */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Monto CUP
                  </label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={formData.monto_cup}
                    onChange={(e) => setFormData(prev => ({ ...prev, monto_cup: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border-2"
                    style={{
                      backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    }}
                    placeholder="0.00"
                  />
                </div>

                {/* Monto USD */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Monto USD
                  </label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={formData.monto_usd}
                    onChange={(e) => setFormData(prev => ({ ...prev, monto_usd: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border-2"
                    style={{
                      backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Fecha
                </label>
                <input
                  type="date"
                  disabled={isReadOnly}
                  value={formData.fecha_hora}
                  onChange={(e) => setFormData(prev => ({ ...prev, fecha_hora: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border-2"
                  style={{
                    backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                />
              </div>

              {/* Nota */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Nota
                </label>
                <textarea
                  disabled={isReadOnly}
                  value={formData.nota}
                  onChange={(e) => setFormData(prev => ({ ...prev, nota: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border-2"
                  style={{
                    backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                    minHeight: '100px',
                  }}
                  placeholder="Notas adicionales..."
                />
              </div>

              {/* Pagos */}
              {!isAddMode && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium" style={{ color: colors.outline }}>
                      Pagos Realizados ({pagosList.length})
                    </label>
                    {!isReadOnly && canManageDeudas && (
                      <button
                        onClick={() => {
                          setEditingPago(null);
                          setPagoFormData({
                            cantidad_pagada: '',
                            forma_pago: '',
                            cambio_moneda: '1',
                            id_cuenta_operacion: '',
                            nota: '',
                          });
                          setShowPagoModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1 rounded-lg"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                      >
                        <Plus size={16} />
                        <span>Agregar Pago</span>
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {pagosList.length === 0 ? (
                      <p className="text-sm" style={{ color: colors.outline }}>No hay pagos registrados</p>
                    ) : (
                      pagosList.map((pago) => (
                        <div
                          key={pago.id_pago_deuda}
                          className="rounded-lg p-3 flex justify-between items-center"
                          style={{ backgroundColor: colors.surfaceVariant }}
                        >
                          <div>
                            <p style={{ color: colors.onSurface, fontWeight: 'bold' }}>
                              ${parseFloat(pago.cantidad_pagada).toFixed(2)}
                            </p>
                            <p className="text-sm" style={{ color: colors.outline }}>
                              {pago.forma_pago} - {new Date(pago.fecha_hora).toLocaleDateString()}
                            </p>
                          </div>
                          {!isReadOnly && canManageDeudas && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditPago(pago)}
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                              >
                                <Edit size={16} style={{ color: colors.primary }} />
                              </button>
                              <button
                                onClick={() => handleDeletePago(pago.id_pago_deuda)}
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                              >
                                <Trash2 size={16} style={{ color: colors.error }} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4">
                {!isReadOnly && canManageDeudas && (
                  <>
                    <button
                      onClick={() => router.push('/deudas')}
                      className="flex-1 px-4 py-3 rounded-lg flex items-center justify-center gap-2"
                      style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant, border: '1px solid' }}
                    >
                      <X size={18} />
                      <span>Cancelar</span>
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 px-4 py-3 rounded-lg flex items-center justify-center gap-2"
                      style={{ backgroundColor: colors.primary, color: '#fff', opacity: isSaving ? 0.7 : 1 }}
                    >
                      <Save size={18} />
                      <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pago */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl" style={{ backgroundColor: colors.surface }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold" style={{ color: colors.onSurface }}>
                {editingPago ? 'Editar Pago' : 'Agregar Pago'}
              </h2>
              <button onClick={() => setShowPagoModal(false)}>
                <X size={24} style={{ color: colors.outline }} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cantidad *
                </label>
                <input
                  type="number"
                  value={pagoFormData.cantidad_pagada}
                  onChange={(e) => setPagoFormData(prev => ({ ...prev, cantidad_pagada: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Forma de Pago *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowFormaPagoDropdown(!showFormaPagoDropdown)}
                    className="w-full px-4 py-3 rounded-lg border-2 text-left flex justify-between items-center"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    }}
                  >
                    <span>{pagoFormData.forma_pago || 'Seleccionar...'}</span>
                    <ChevronDown size={20} style={{ color: colors.outline }} />
                  </button>
                  {showFormaPagoDropdown && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                      {formasPago.map((forma) => (
                        <button
                          key={forma}
                          onClick={() => {
                            setPagoFormData(prev => ({ ...prev, forma_pago: forma }));
                            setShowFormaPagoDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:opacity-80"
                          style={{ color: colors.onSurface }}
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
                  Cuenta de Operación *
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCuentaDropdown(!showCuentaDropdown)}
                    className="w-full px-4 py-3 rounded-lg border-2 text-left flex justify-between items-center"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    }}
                  >
                    <span>{cuentas.find(c => c.id_cuenta === parseInt(pagoFormData.id_cuenta_operacion))?.nombre || 'Seleccionar...'}</span>
                    <ChevronDown size={20} style={{ color: colors.outline }} />
                  </button>
                  {showCuentaDropdown && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                      {cuentas.map((cuenta) => (
                        <button
                          key={cuenta.id_cuenta}
                          onClick={() => {
                            setPagoFormData(prev => ({ ...prev, id_cuenta_operacion: cuenta.id_cuenta.toString() }));
                            setShowCuentaDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:opacity-80"
                          style={{ color: colors.onSurface }}
                        >
                          {cuenta.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Nota
                </label>
                <textarea
                  value={pagoFormData.nota}
                  onChange={(e) => setPagoFormData(prev => ({ ...prev, nota: e.target.value }))}
                  className="w-full px-4 py-3 rounded-lg border-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                    minHeight: '80px',
                  }}
                  placeholder="Notas del pago..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPagoModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg"
                  style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant, border: '1px solid' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddPago}
                  className="flex-1 px-4 py-3 rounded-lg"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                >
                  {editingPago ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={hideToast}
      />
    </>
  );
}

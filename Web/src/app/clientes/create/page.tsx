'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../hooks/useToast';
import { useNavigationLoading } from '../../../context/NavigationLoadingContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { Header } from '../../../components/layout/Header';
import { SidebarNavigation } from '../../../components/layout/SidebarNavigation';
import { Toast } from '../../../components/common/Toast';
import { createCliente } from '../../../services/clienteService';
import { Save, Phone, MapPin, DollarSign } from 'lucide-react';

export default function CreateClientePage() {
  const router = useRouter();
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

  const [isSaving, setIsSaving] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [createWithDeuda, setCreateWithDeuda] = useState(false);
  const [createWithPago, setCreateWithPago] = useState(false);
  const [deudaData, setDeudaData] = useState({
    monto_cup: '',
    monto_usd: '',
    nota: ''
  });
  const [pagoData, setPagoData] = useState({
    cantidad: '',
    forma_pago: '',
    id_cuenta_operacion: '',
    nota: ''
  });
  const [showFormaPagoDropdown, setShowFormaPagoDropdown] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentas, setCuentas] = useState([]);
  const [formasPago] = useState(['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD']);

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
      await createCliente(formData);
      showToast({ type: 'success', message: 'Cliente creado correctamente' });
      router.push('/clientes');
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al crear cliente' });
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

  if (!canManageClientes) {
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
        title="Nuevo Cliente"
        showLogo={false}
        hideUserIcon={true}
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
                  }}
                  placeholder="Nombre del cliente"
                  value={formData.nombre}
                  onChange={(e) => handleInputChange('nombre', e.target.value)}
                />
              </div>

              {/* Teléfono y Tipo de Cliente */}
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Teléfono
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 min-w-0 rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                      }}
                      placeholder="Teléfono"
                      value={formData.telefono}
                      onChange={(e) => handleInputChange('telefono', e.target.value)}
                    />
                    {formData.telefono && (
                      <button
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }}
                        onClick={handleCall}
                      >
                        <Phone size={20} style={{ color: '#4CAF50' }} />
                      </button>
                    )}
                  </div>
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
                    }}
                    placeholder="Tipo de cliente"
                    value={formData.tipo_cliente}
                    onChange={(e) => handleInputChange('tipo_cliente', e.target.value)}
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
                  }}
                  placeholder="Dirección"
                  value={formData.direccion}
                  onChange={(e) => handleInputChange('direccion', e.target.value)}
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
                    }}
                    placeholder="Coordenadas GPS"
                    value={formData.localizacion_coordenadas_gps}
                    onChange={(e) => handleInputChange('localizacion_coordenadas_gps', e.target.value)}
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
                  }}
                  placeholder="Descuento"
                  value={formData.descuento}
                  onChange={(e) => handleInputChange('descuento', e.target.value)}
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
                    minHeight: '100px',
                  }}
                  placeholder="Notas adicionales"
                  value={formData.nota}
                  onChange={(e) => handleInputChange('nota', e.target.value)}
                />
              </div>
            </div>

            {/* Create with Debt Toggle */}
            <div className="flex items-center gap-2 mt-4">
              <button
                className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{
                  backgroundColor: createWithDeuda ? colors.primary : colors.surface,
                  borderColor: colors.primary,
                  border: '1px solid',
                  color: createWithDeuda ? '#fff' : colors.onSurface
                }}
                onClick={() => setCreateWithDeuda(!createWithDeuda)}
              >
                <DollarSign size={20} />
                <span>Crear con deuda asociada</span>
              </button>
            </div>

            {/* Deuda Form */}
            {createWithDeuda && (
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: colors.background }}>
                <h3 className="text-lg font-semibold mb-4" style={{ color: colors.onSurface }}>Datos de la Deuda</h3>

                {/* Monto CUP y USD */}
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Monto CUP
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.surface,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                      }}
                      placeholder="Monto en CUP"
                      value={deudaData.monto_cup}
                      onChange={(e) => setDeudaData(prev => ({ ...prev, monto_cup: e.target.value }))}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Monto USD
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.surface,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                      }}
                      placeholder="Monto en USD"
                      value={deudaData.monto_usd}
                      onChange={(e) => setDeudaData(prev => ({ ...prev, monto_usd: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Nota de deuda */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Nota de deuda
                  </label>
                  <textarea
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      minHeight: '80px',
                    }}
                    placeholder="Notas sobre la deuda"
                    value={deudaData.nota}
                    onChange={(e) => setDeudaData(prev => ({ ...prev, nota: e.target.value }))}
                  />
                </div>

                {/* Agregar primer pago toggle */}
                <button
                  className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90 mb-4"
                  style={{
                    backgroundColor: createWithPago ? colors.primary : colors.surface,
                    borderColor: colors.primary,
                    border: '1px solid',
                    color: createWithPago ? '#fff' : colors.onSurface
                  }}
                  onClick={() => setCreateWithPago(!createWithPago)}
                >
                  <DollarSign size={18} />
                  <span>Agregar primer pago</span>
                </button>

                {/* Pago Form */}
                {createWithPago && (
                  <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                        Cantidad a pagar
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: colors.background,
                          color: colors.onSurface,
                          borderColor: colors.outlineVariant,
                        }}
                        placeholder="Cantidad"
                        value={pagoData.cantidad}
                        onChange={(e) => setPagoData(prev => ({ ...prev, cantidad: e.target.value }))}
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                        Forma de pago
                      </label>
                      <div className="relative">
                        <button
                          className="w-full rounded-lg px-4 py-3 border flex items-center justify-between"
                          style={{
                            backgroundColor: colors.background,
                            color: pagoData.forma_pago ? colors.onSurface : colors.outline,
                            borderColor: colors.outlineVariant,
                          }}
                          onClick={() => setShowFormaPagoDropdown(!showFormaPagoDropdown)}
                        >
                          <span>{pagoData.forma_pago || 'Seleccionar forma de pago'}</span>
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
                                  setPagoData(prev => ({ ...prev, forma_pago: forma }));
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

                    <div className="mb-4">
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
                        value={pagoData.nota}
                        onChange={(e) => setPagoData(prev => ({ ...prev, nota: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
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
                  <div className="w-4 h-4 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                ) : (
                  <>
                    <Save size={20} />
                    <span>Crear Cliente</span>
                  </>
                )}
              </button>
            </div>
          </div>
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
    </>
  );
}

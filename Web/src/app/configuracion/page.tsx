'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Header } from '../../components/layout/Header';
import { Sidebar } from '../../components/layout/Sidebar';
import { Toast } from '../../components/common/Toast';
import { configService } from '../../services/configService';
import { RefreshCw, Info, ChevronUp, ChevronDown, Package } from 'lucide-react';

export default function ConfiguracionPage() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('');
  const [config, setConfig] = useState<any>({});
  const [permissions, setPermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [showPermissions, setShowPermissions] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<any>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useEffect(() => {
    fetchConfig();
    fetchExchangeRates();
  }, []);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const data = await configService.getConfig();
      setConfig(data);
      if (data.cupToUsdRate) {
        setExchangeRate(data.cupToUsdRate.toString());
      }
      if (data.permissions) {
        setPermissions({
          dependiente: data.permissions.dependiente || false,
          almacenero: data.permissions.almacenero || false,
          economico: data.permissions.economico || false,
        });
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar configuración' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExchangeRates = async () => {
    try {
      setIsLoadingRates(true);
      // Simular tasas de cambio (en producción esto vendría de una API real)
      const mockRates = {
        tasas: {
          USD: 630,
          ECU: 680,
          MLC: 640,
          USDT_TRC20: 635,
        },
        date: new Date().toLocaleDateString('es-ES'),
        hour: new Date().getHours(),
        minutes: new Date().getMinutes(),
      };
      setExchangeRates(mockRates);
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      setExchangeRates(null);
    } finally {
      setIsLoadingRates(false);
    }
  };

  const handleSave = async () => {
    if (!exchangeRate.trim()) {
      showToast({ type: 'warning', message: 'El tipo de cambio es requerido' });
      return;
    }

    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) {
      showToast({ type: 'warning', message: 'El tipo de cambio debe ser un número positivo' });
      return;
    }

    try {
      setIsSaving(true);
      const updatedConfig = {
        ...config,
        cupToUsdRate: rate,
        permissions: permissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración guardada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar configuración' });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newPermissions = { ...permissions, [role]: !permissions[role] };
    setPermissions(newPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        permissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso' });
      setPermissions(permissions);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    // Profile
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
      
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRoute="Configuración"
      />

      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          onMenuPress={() => setSidebarOpen(true)}
          onThemePress={toggleTheme}
          onNotificationsPress={handleNotificationsPress}
          onProfilePress={handleProfilePress}
          showViewToggle={false}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="Configuración"
        />

        <div className="pt-20 px-4 md:px-4 lg:px-4 pb-8 max-w-4xl mx-auto">
          <h1 
            className="text-2xl md:text-3xl font-bold mb-6 text-center"
            style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
          >
            Configuraciones del Admin
          </h1>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando configuración...</p>
            </div>
          ) : (
            <>
              {/* Tasas de cambio en vivo según elTOQUE */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <RefreshCw size={20} style={{ color: colors.primary }} />
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Tasas de cambio en vivo según elTOQUE
                    </h2>
                  </div>
                  <button
                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                    style={{ backgroundColor: 'transparent' }}
                    onClick={() => fetchExchangeRates()}
                    disabled={isLoadingRates}
                  >
                    {isLoadingRates ? (
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                    ) : (
                      <RefreshCw size={18} style={{ color: colors.primary }} />
                    )}
                  </button>
                </div>
                
                {isLoadingRates ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-6 h-6 border-2 border-t-2 rounded-full animate-spin mr-3" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                    <p style={{ color: colors.outline }}>Cargando tasas...</p>
                  </div>
                ) : exchangeRates ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl" style={{ fontSize: '24px' }}>🇺🇸</span>
                        <div>
                          <p className="font-semibold" style={{ color: colors.onSurface }}>USD</p>
                          <p className="text-xs" style={{ color: colors.outline }}>Dólar Americano</p>
                        </div>
                      </div>
                      <p className="font-bold" style={{ color: colors.primary }}>
                        {formatCurrency(exchangeRates.tasas.USD)} CUP
                      </p>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl" style={{ fontSize: '24px' }}>🇪🇺</span>
                        <div>
                          <p className="font-semibold" style={{ color: colors.onSurface }}>ECU</p>
                          <p className="text-xs" style={{ color: colors.outline }}>Euro</p>
                        </div>
                      </div>
                      <p className="font-bold" style={{ color: colors.primary }}>
                        {formatCurrency(exchangeRates.tasas.ECU)} CUP
                      </p>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🏦</span>
                        <div>
                          <p className="font-semibold" style={{ color: colors.onSurface }}>MLC</p>
                          <p className="text-xs" style={{ color: colors.outline }}>Divisa Cubana</p>
                        </div>
                      </div>
                      <p className="font-bold" style={{ color: colors.primary }}>
                        {formatCurrency(exchangeRates.tasas.MLC)} CUP
                      </p>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">💵</span>
                        <div>
                          <p className="font-semibold" style={{ color: colors.onSurface }}>USDT</p>
                          <p className="text-xs" style={{ color: colors.outline }}>Tether TRC20</p>
                        </div>
                      </div>
                      <p className="font-bold" style={{ color: colors.primary }}>
                        {formatCurrency(exchangeRates.tasas.USDT_TRC20)} CUP
                      </p>
                    </div>

                    <p className="text-xs text-center mt-3" style={{ color: colors.outline }}>
                      Actualizado: {exchangeRates.date} {exchangeRates.hour}:{exchangeRates.minutes.toString().padStart(2, '0')}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <Info size={20} style={{ color: colors.error }} />
                    <p className="ml-2" style={{ color: colors.error }}>No se pudieron cargar las tasas de cambio</p>
                  </div>
                )}
              </div>

              {/* Tipo de Cambio CUP USD */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="mb-4">
                  <label 
                    className="block text-sm font-medium mb-2"
                    style={{ color: colors.outline }}
                  >
                    Tipo de Cambio CUP → USD *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant,
                      fontFamily: 'Inter, sans-serif'
                    }}
                    placeholder="Ej: 630"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                  />
                  <p className="text-xs mt-2" style={{ color: colors.outline }}>
                    Ingresa el valor de 1 CUP en USD
                  </p>
                </div>

                <div 
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={24} style={{ color: colors.primary }} />
                    <h3 className="font-semibold" style={{ color: colors.onSurface }}>
                      Información
                    </h3>
                  </div>
                  <p className="text-sm" style={{ color: colors.outline }}>
                    Esta configuración se utiliza para convertir precios de CUP a USD en toda la aplicación.
                  </p>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px', color: colors.onSurface }}
                    onClick={() => window.history.back()}
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
                      <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    ) : (
                      <span>Guardar</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Permisos de Productos y Servicios */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Package size={20} style={{ color: colors.primary }} />
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Permisos de Productos y Servicios
                    </h2>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowPermissions(!showPermissions)}
                  >
                    {showPermissions ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                {showPermissions && (
                  <>
                    <p className="text-sm mb-4" style={{ color: colors.outline }}>
                      Configura qué roles pueden ver productos y servicios de otras tiendas
                    </p>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: colors.onSurface }}>Dependiente</span>
                          <button
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: colors.primary, color: '#fff' }}
                            title="Cuando está activo, los usuarios con rol Dependiente pueden ver productos y servicios de todas las tiendas, no solo la suya."
                          >
                            !
                          </button>
                        </div>
                        <button
                          className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                          style={{
                            backgroundColor: permissions.dependiente ? colors.primary : colors.outlineVariant,
                          }}
                          onClick={() => togglePermission('dependiente')}
                        >
                          <div 
                            className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                            style={{
                              transform: permissions.dependiente ? 'translateX(24px)' : 'translateX(0)',
                              backgroundColor: permissions.dependiente ? '#fff' : colors.outline,
                            }}
                          />
                        </button>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: colors.onSurface }}>Almacenero</span>
                          <button
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: colors.primary, color: '#fff' }}
                            title="Cuando está activo, los usuarios con rol Almacenero pueden ver productos y servicios de todas las tiendas, no solo la suya."
                          >
                            !
                          </button>
                        </div>
                        <button
                          className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                          style={{
                            backgroundColor: permissions.almacenero ? colors.primary : colors.outlineVariant,
                          }}
                          onClick={() => togglePermission('almacenero')}
                        >
                          <div 
                            className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                            style={{
                              transform: permissions.almacenero ? 'translateX(24px)' : 'translateX(0)',
                              backgroundColor: permissions.almacenero ? '#fff' : colors.outline,
                            }}
                          />
                        </button>
                      </div>

                      <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium" style={{ color: colors.onSurface }}>Económico</span>
                          <button
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: colors.primary, color: '#fff' }}
                            title="Cuando está activo, los usuarios con rol Económico pueden ver productos y servicios de todas las tiendas, no solo la suya."
                          >
                            !
                          </button>
                        </div>
                        <button
                          className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                          style={{
                            backgroundColor: permissions.economico ? colors.primary : colors.outlineVariant,
                          }}
                          onClick={() => togglePermission('economico')}
                        >
                          <div 
                            className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                            style={{
                              transform: permissions.economico ? 'translateX(24px)' : 'translateX(0)',
                              backgroundColor: permissions.economico ? '#fff' : colors.outline,
                            }}
                          />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

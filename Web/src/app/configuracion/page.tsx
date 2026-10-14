'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { configService } from '../../services/configService';
import { exchangeRateService } from '../../services/exchangeRateService';
import { RefreshCw, Info, ChevronUp, ChevronDown, Package, Lock, Store, Globe, X } from 'lucide-react';

export default function ConfiguracionPage() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const sidebarNavRef = useRef<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

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
  const [showEntradaConfig, setShowEntradaConfig] = useState(false);
  const [showEntradaPermissions, setShowEntradaPermissions] = useState(false);
  const [showSalidaPermissions, setShowSalidaPermissions] = useState(false);
  const [showOperacionPermissions, setShowOperacionPermissions] = useState(false);
  const [showEntradaManage, setShowEntradaManage] = useState(false);
  const [showSalidaManage, setShowSalidaManage] = useState(false);
  const [showOperacionManage, setShowOperacionManage] = useState(false);
  const [entradaAccessLevels, setEntradaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [salidaAccessLevels, setSalidaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [operacionAccessLevels, setOperacionAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [entradaManagePermissions, setEntradaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [salidaManagePermissions, setSalidaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [operacionManagePermissions, setOperacionManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [applyWeightedAverageCost, setApplyWeightedAverageCost] = useState(false);
  const [autoApplySuggestedCost, setAutoApplySuggestedCost] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [showEntradaModalAfterProductCreation, setShowEntradaModalAfterProductCreation] = useState(false);
  const [infoModal, setInfoModal] = useState<{ title: string; content: string } | null>(null);
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
      if (data.entradaAccessLevels) {
        setEntradaAccessLevels({
          dependiente: data.entradaAccessLevels.dependiente || 'none',
          almacenero: data.entradaAccessLevels.almacenero || 'none',
          economico: data.entradaAccessLevels.economico || 'none',
        });
      }
      if (data.salidaAccessLevels) {
        setSalidaAccessLevels({
          dependiente: data.salidaAccessLevels.dependiente || 'none',
          almacenero: data.salidaAccessLevels.almacenero || 'none',
          economico: data.salidaAccessLevels.economico || 'none',
        });
      }
      if (data.entradaManagePermissions) {
        setEntradaManagePermissions({
          dependiente: data.entradaManagePermissions.dependiente || false,
          almacenero: data.entradaManagePermissions.almacenero || false,
          economico: data.entradaManagePermissions.economico || false,
        });
      }
      if (data.salidaManagePermissions) {
        setSalidaManagePermissions({
          dependiente: data.salidaManagePermissions.dependiente || false,
          almacenero: data.salidaManagePermissions.almacenero || false,
          economico: data.salidaManagePermissions.economico || false,
        });
      }
      if (data.operacionAccessLevels) {
        setOperacionAccessLevels({
          dependiente: data.operacionAccessLevels.dependiente || 'none',
          almacenero: data.operacionAccessLevels.almacenero || 'none',
          economico: data.operacionAccessLevels.economico || 'none',
        });
      }
      if (data.operacionManagePermissions) {
        setOperacionManagePermissions({
          dependiente: data.operacionManagePermissions.dependiente || false,
          almacenero: data.operacionManagePermissions.almacenero || false,
          economico: data.operacionManagePermissions.economico || false,
        });
      }
      if (data.autoApplySuggestedCost) {
        setAutoApplySuggestedCost({
          dependiente: data.autoApplySuggestedCost.dependiente || false,
          almacenero: data.autoApplySuggestedCost.almacenero || false,
          economico: data.autoApplySuggestedCost.economico || false,
        });
      }
      if (data.applyWeightedAverageCost !== undefined) {
        setApplyWeightedAverageCost(data.applyWeightedAverageCost);
      }
      if (data.showEntradaModalAfterProductCreation !== undefined) {
        setShowEntradaModalAfterProductCreation(data.showEntradaModalAfterProductCreation);
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
      const data = await exchangeRateService.getExchangeRates();
      setExchangeRates(data);
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
        entradaAccessLevels: entradaAccessLevels,
        salidaAccessLevels: salidaAccessLevels,
        operacionAccessLevels: operacionAccessLevels,
        entradaManagePermissions: entradaManagePermissions,
        salidaManagePermissions: salidaManagePermissions,
        operacionManagePermissions: operacionManagePermissions,
        applyWeightedAverageCost: applyWeightedAverageCost,
        autoApplySuggestedCost: autoApplySuggestedCost,
        showEntradaModalAfterProductCreation: showEntradaModalAfterProductCreation,
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

  const updateEntradaAccessLevel = async (role: 'dependiente' | 'almacenero' | 'economico', level: string) => {
    const newLevels = { ...entradaAccessLevels, [role]: level };
    setEntradaAccessLevels(newLevels);
    
    try {
      const updatedConfig = {
        ...config,
        entradaAccessLevels: newLevels,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Nivel de acceso actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso' });
      setEntradaAccessLevels(entradaAccessLevels);
    }
  };

  const updateSalidaAccessLevel = async (role: 'dependiente' | 'almacenero' | 'economico', level: string) => {
    const newLevels = { ...salidaAccessLevels, [role]: level };
    setSalidaAccessLevels(newLevels);
    
    try {
      const updatedConfig = {
        ...config,
        salidaAccessLevels: newLevels,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Nivel de acceso actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso' });
      setSalidaAccessLevels(salidaAccessLevels);
    }
  };

  const updateOperacionAccessLevel = async (role: 'dependiente' | 'almacenero' | 'economico', level: string) => {
    const newLevels = { ...operacionAccessLevels, [role]: level };
    setOperacionAccessLevels(newLevels);
    
    try {
      const updatedConfig = {
        ...config,
        operacionAccessLevels: newLevels,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Nivel de acceso actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso' });
      setOperacionAccessLevels(operacionAccessLevels);
    }
  };

  const toggleEntradaManagePermission = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newPermissions = { ...entradaManagePermissions, [role]: !entradaManagePermissions[role] };
    setEntradaManagePermissions(newPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        entradaManagePermissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de gestión actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión' });
      setEntradaManagePermissions(entradaManagePermissions);
    }
  };

  const toggleSalidaManagePermission = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newPermissions = { ...salidaManagePermissions, [role]: !salidaManagePermissions[role] };
    setSalidaManagePermissions(newPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        salidaManagePermissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de gestión actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión' });
      setSalidaManagePermissions(salidaManagePermissions);
    }
  };

  const toggleOperacionManagePermission = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newPermissions = { ...operacionManagePermissions, [role]: !operacionManagePermissions[role] };
    setOperacionManagePermissions(newPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        operacionManagePermissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de gestión actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión' });
      setOperacionManagePermissions(operacionManagePermissions);
    }
  };

  const toggleAutoApplySuggestedCost = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newAutoApply = { ...autoApplySuggestedCost, [role]: !autoApplySuggestedCost[role] };
    setAutoApplySuggestedCost(newAutoApply);
    
    try {
      const updatedConfig = {
        ...config,
        autoApplySuggestedCost: newAutoApply,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración actualizada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar configuración' });
      setAutoApplySuggestedCost(autoApplySuggestedCost);
    }
  };

  const toggleApplyWeightedAverageCost = async () => {
    const newValue = !applyWeightedAverageCost;
    setApplyWeightedAverageCost(newValue);
    
    try {
      const updatedConfig = {
        ...config,
        applyWeightedAverageCost: newValue,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración actualizada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar configuración' });
      setApplyWeightedAverageCost(!newValue);
    }
  };

  const toggleShowEntradaModal = async () => {
    const newValue = !showEntradaModalAfterProductCreation;
    setShowEntradaModalAfterProductCreation(newValue);
    
    try {
      const updatedConfig = {
        ...config,
        showEntradaModalAfterProductCreation: newValue,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración actualizada correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar configuración' });
      setShowEntradaModalAfterProductCreation(!newValue);
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
      
      <SidebarNavigation 
        currentRoute="Configuración" 
        ref={sidebarNavRef}
      />

      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header
          onMenuPress={handleMenuPress}
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
                        <div style={{ width: '32px', height: '32px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                          <Image
                            src="/dollar.png"
                            alt="USD"
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                          />
                        </div>
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
                        <div style={{ width: '32px', height: '32px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                          <Image
                            src="/euro.png"
                            alt="EUR"
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: colors.onSurface }}>EUR</p>
                          <p className="text-xs" style={{ color: colors.outline }}>Euro</p>
                        </div>
                      </div>
                      <p className="font-bold" style={{ color: colors.primary }}>
                        {formatCurrency(exchangeRates.tasas.ECU)} CUP
                      </p>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-3">
                        <div style={{ width: '32px', height: '32px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                          <Image
                            src="/coin.png"
                            alt="MLC"
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                          />
                        </div>
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
                        <div style={{ width: '32px', height: '32px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                          <Image
                            src="/russian-ruble.png"
                            alt="USDT"
                            width={32}
                            height={32}
                            className="w-full h-full object-contain"
                          />
                        </div>
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

              {/* Configuración de Entradas */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div style={{ width: '24px', height: '24px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                      <img
                        src="/package-add-copia.png"
                        alt="Configuración de Entradas"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Configuración de Entradas
                    </h2>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowEntradaConfig(!showEntradaConfig)}
                  >
                    {showEntradaConfig ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                {showEntradaConfig && (
                  <>
                    <p className="text-sm mb-4" style={{ color: colors.outline }}>
                      Configura el cálculo automático de costo promedio ponderado y el modal de entrada para nuevos productos
                    </p>

                    <div className="flex justify-between items-center p-3 rounded-lg mb-3" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: colors.onSurface }}>Aplicar Fórmula de Costo Promedio Ponderado</span>
                        <button
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: colors.primary, color: '#fff' }}
                          onClick={() => setInfoModal({
                            title: 'Fórmula de Costo Promedio Ponderado',
                            content: 'Cuando está activo, el costo de los productos se recalcula automáticamente al crear una entrada usando la fórmula: (costo_actual × cantidad_actual + costo_entrada × cantidad_entrada) / (cantidad_actual + cantidad_entrada)'
                          })}
                        >
                          !
                        </button>
                      </div>
                      <button
                        className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                        style={{
                          backgroundColor: applyWeightedAverageCost ? colors.primary : colors.outlineVariant,
                        }}
                        onClick={() => toggleApplyWeightedAverageCost()}
                      >
                        <div 
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                          style={{
                            transform: applyWeightedAverageCost ? 'translateX(24px)' : 'translateX(0)',
                            backgroundColor: applyWeightedAverageCost ? '#fff' : colors.outline,
                          }}
                        />
                      </button>
                    </div>

                    {applyWeightedAverageCost && (
                      <>
                        <p className="text-sm mb-4" style={{ color: colors.outline }}>
                          Configura qué roles pueden aplicar automáticamente el costo sugerido por la fórmula sin confirmación
                        </p>

                        {['dependiente', 'almacenero', 'economico'].map((role) => (
                          <div key={role} className="flex justify-between items-center p-3 rounded-lg mb-3" style={{ backgroundColor: colors.background }}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>{role}</span>
                              <button
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{ backgroundColor: colors.primary, color: '#fff' }}
                                onClick={() => setInfoModal({
                                  title: `Auto-aplicar Costo Sugerido - ${role}`,
                                  content: 'Activo: Aplica costo sugerido automáticamente, actualiza el costo del producto en todas las tiendas. NO muestra ventana para elegir entre costos.\n\nInactivo: Usa costo ingresado solo para la entrada sin modificar el costo original del producto. NO muestra ventana para elegir entre costos.'
                                })}
                              >
                                !
                              </button>
                            </div>
                            <button
                              className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                              style={{
                                backgroundColor: autoApplySuggestedCost[role as keyof typeof autoApplySuggestedCost] ? colors.primary : colors.outlineVariant,
                              }}
                              onClick={() => toggleAutoApplySuggestedCost(role as 'dependiente' | 'almacenero' | 'economico')}
                            >
                              <div 
                                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                style={{
                                  transform: autoApplySuggestedCost[role as keyof typeof autoApplySuggestedCost] ? 'translateX(24px)' : 'translateX(0)',
                                  backgroundColor: autoApplySuggestedCost[role as keyof typeof autoApplySuggestedCost] ? '#fff' : colors.outline,
                                }}
                              />
                            </button>
                          </div>
                        ))}
                      </>
                    )}

                    <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium" style={{ color: colors.onSurface }}>Preguntar si Agregar Entrada al Crear Producto</span>
                        <button
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: colors.primary, color: '#fff' }}
                          onClick={() => setInfoModal({
                            title: 'Pregunta de Entrada al Crear Producto',
                            content: 'Cuando está activo, después de crear un nuevo producto se preguntará si deseas agregar una entrada de stock para ese producto (solo para usuarios con permisos de gestión de entradas).'
                          })}
                        >
                          !
                        </button>
                      </div>
                      <button
                        className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                        style={{
                          backgroundColor: showEntradaModalAfterProductCreation ? colors.primary : colors.outlineVariant,
                        }}
                        onClick={() => toggleShowEntradaModal()}
                      >
                        <div 
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                          style={{
                            transform: showEntradaModalAfterProductCreation ? 'translateX(24px)' : 'translateX(0)',
                            backgroundColor: showEntradaModalAfterProductCreation ? '#fff' : colors.outline,
                          }}
                        />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Permisos de Entradas */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div style={{ width: '24px', height: '24px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                      <img
                        src="/package-add.png"
                        alt="Permisos de Entradas"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Permisos de Entradas
                    </h2>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowEntradaPermissions(!showEntradaPermissions)}
                  >
                    {showEntradaPermissions ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                {showEntradaPermissions && (
                  <>
                    <p className="text-sm mb-4" style={{ color: colors.outline }}>
                      Configura el nivel de acceso a las entradas para cada rol
                    </p>

                    <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Lock size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Sin acceso:</strong> No puede ver la pantalla de Entradas ni ninguna entrada del sistema</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Store size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Mi tienda:</strong> Puede ver la pantalla de Entradas pero solo las entradas de su tienda</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Todas las tiendas:</strong> Puede ver la pantalla de Entradas y las entradas de todas las tiendas</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {['dependiente', 'almacenero', 'economico'].map((role) => (
                        <div key={role} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>{role}</span>
                            <button
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: colors.primary, color: '#fff' }}
                              onClick={() => setInfoModal({
                                title: `Acceso a Entradas - ${role}`,
                                content: 'Define si los usuarios con rol ' + role + ' no tienen acceso a entradas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                              })}
                            >
                              !
                            </button>
                          </div>
                          <div className="flex gap-2">
                            {['none', 'own_store', 'all_stores'].map((level) => (
                              <button
                                key={level}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors`}
                                style={{
                                  backgroundColor: entradaAccessLevels[role as keyof typeof entradaAccessLevels] === level ? colors.primary : 'transparent',
                                  borderColor: entradaAccessLevels[role as keyof typeof entradaAccessLevels] === level ? colors.primary : colors.outlineVariant,
                                }}
                                onClick={() => updateEntradaAccessLevel(role as 'dependiente' | 'almacenero' | 'economico', level)}
                              >
                                {level === 'none' && <Lock size={18} style={{ color: entradaAccessLevels[role as keyof typeof entradaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'own_store' && <Store size={18} style={{ color: entradaAccessLevels[role as keyof typeof entradaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'all_stores' && <Globe size={18} style={{ color: entradaAccessLevels[role as keyof typeof entradaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {(entradaAccessLevels.dependiente !== 'none' || entradaAccessLevels.almacenero !== 'none' || entradaAccessLevels.economico !== 'none') && (
                      <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-semibold" style={{ color: colors.onSurface }}>Gestión de Entradas</h3>
                          <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                            style={{ 
                              backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                              borderColor: colors.primary 
                            }}
                            onClick={() => setShowEntradaManage(!showEntradaManage)}
                          >
                            {showEntradaManage ? <ChevronUp size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                          </button>
                        </div>
                        {showEntradaManage && (
                          <>
                            <p className="text-sm mb-3" style={{ color: colors.outline }}>
                              Configura qué roles pueden crear, editar y eliminar entradas (solo visible para roles con acceso)
                            </p>
                            {entradaAccessLevels.dependiente !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Dependiente</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Entradas - Dependiente',
                                      content: 'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: entradaManagePermissions.dependiente ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleEntradaManagePermission('dependiente')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: entradaManagePermissions.dependiente ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: entradaManagePermissions.dependiente ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {entradaAccessLevels.almacenero !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Almacenero</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Entradas - Almacenero',
                                      content: 'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: entradaManagePermissions.almacenero ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleEntradaManagePermission('almacenero')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: entradaManagePermissions.almacenero ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: entradaManagePermissions.almacenero ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {entradaAccessLevels.economico !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Económico</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Entradas - Económico',
                                      content: 'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar entradas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: entradaManagePermissions.economico ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleEntradaManagePermission('economico')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: entradaManagePermissions.economico ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: entradaManagePermissions.economico ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Permisos de Salidas */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div style={{ width: '24px', height: '24px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                      <img
                        src="/box.png"
                        alt="Permisos de Salidas"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Permisos de Salidas
                    </h2>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowSalidaPermissions(!showSalidaPermissions)}
                  >
                    {showSalidaPermissions ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                {showSalidaPermissions && (
                  <>
                    <p className="text-sm mb-4" style={{ color: colors.outline }}>
                      Configura el nivel de acceso a las salidas para cada rol
                    </p>

                    <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Lock size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Sin acceso:</strong> No puede ver la pantalla de Salidas ni ninguna salida del sistema</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Store size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Mi tienda:</strong> Puede ver la pantalla de Salidas pero solo las salidas de su tienda</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Todas las tiendas:</strong> Puede ver la pantalla de Salidas y las salidas de todas las tiendas</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {['dependiente', 'almacenero', 'economico'].map((role) => (
                        <div key={role} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>{role}</span>
                            <button
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: colors.primary, color: '#fff' }}
                              onClick={() => setInfoModal({
                                title: `Acceso a Salidas - ${role}`,
                                content: 'Define si los usuarios con rol ' + role + ' no tienen acceso a salidas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                              })}
                            >
                              !
                            </button>
                          </div>
                          <div className="flex gap-2">
                            {['none', 'own_store', 'all_stores'].map((level) => (
                              <button
                                key={level}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors`}
                                style={{
                                  backgroundColor: salidaAccessLevels[role as keyof typeof salidaAccessLevels] === level ? colors.primary : 'transparent',
                                  borderColor: salidaAccessLevels[role as keyof typeof salidaAccessLevels] === level ? colors.primary : colors.outlineVariant,
                                }}
                                onClick={() => updateSalidaAccessLevel(role as 'dependiente' | 'almacenero' | 'economico', level)}
                              >
                                {level === 'none' && <Lock size={18} style={{ color: salidaAccessLevels[role as keyof typeof salidaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'own_store' && <Store size={18} style={{ color: salidaAccessLevels[role as keyof typeof salidaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'all_stores' && <Globe size={18} style={{ color: salidaAccessLevels[role as keyof typeof salidaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {(salidaAccessLevels.dependiente !== 'none' || salidaAccessLevels.almacenero !== 'none' || salidaAccessLevels.economico !== 'none') && (
                      <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-semibold" style={{ color: colors.onSurface }}>Gestión de Salidas</h3>
                          <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                            style={{ 
                              backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                              borderColor: colors.primary 
                            }}
                            onClick={() => setShowSalidaManage(!showSalidaManage)}
                          >
                            {showSalidaManage ? <ChevronUp size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                          </button>
                        </div>
                        {showSalidaManage && (
                          <>
                            <p className="text-sm mb-3" style={{ color: colors.outline }}>
                              Configura qué roles pueden crear, editar y eliminar salidas (solo visible para roles con acceso)
                            </p>
                            {salidaAccessLevels.dependiente !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Dependiente</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Salidas - Dependiente',
                                      content: 'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: salidaManagePermissions.dependiente ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleSalidaManagePermission('dependiente')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: salidaManagePermissions.dependiente ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: salidaManagePermissions.dependiente ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {salidaAccessLevels.almacenero !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Almacenero</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Salidas - Almacenero',
                                      content: 'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: salidaManagePermissions.almacenero ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleSalidaManagePermission('almacenero')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: salidaManagePermissions.almacenero ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: salidaManagePermissions.almacenero ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {salidaAccessLevels.economico !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Económico</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Salidas - Económico',
                                      content: 'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar salidas y ver los costos de los productos. Cuando está desactivado, solo pueden ver la información sin acceso a los costos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: salidaManagePermissions.economico ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleSalidaManagePermission('economico')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: salidaManagePermissions.economico ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: salidaManagePermissions.economico ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Permisos de Operaciones */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div style={{ width: '24px', height: '24px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                      <img
                        src="/icon-operaciones.png"
                        alt="Permisos de Operaciones"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Permisos de Operaciones
                    </h2>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowOperacionPermissions(!showOperacionPermissions)}
                  >
                    {showOperacionPermissions ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                {showOperacionPermissions && (
                  <>
                    <p className="text-sm mb-4" style={{ color: colors.outline }}>
                      Configura el nivel de acceso a las operaciones para cada rol
                    </p>

                    <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Lock size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Sin acceso:</strong> No puede ver la pantalla de Operaciones ni ninguna operación del sistema</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Store size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Mi tienda:</strong> Puede ver la pantalla de Operaciones pero solo las operaciones de su tienda</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Todas las tiendas:</strong> Puede ver la pantalla de Operaciones y las operaciones de todas las tiendas</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {['dependiente', 'almacenero', 'economico'].map((role) => (
                        <div key={role} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>{role}</span>
                            <button
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: colors.primary, color: '#fff' }}
                              onClick={() => setInfoModal({
                                title: `Acceso a Operaciones - ${role}`,
                                content: 'Define si los usuarios con rol ' + role + ' no tienen acceso a operaciones, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
                              })}
                            >
                              !
                            </button>
                          </div>
                          <div className="flex gap-2">
                            {['none', 'own_store', 'all_stores'].map((level) => (
                              <button
                                key={level}
                                className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 transition-colors`}
                                style={{
                                  backgroundColor: operacionAccessLevels[role as keyof typeof operacionAccessLevels] === level ? colors.primary : 'transparent',
                                  borderColor: operacionAccessLevels[role as keyof typeof operacionAccessLevels] === level ? colors.primary : colors.outlineVariant,
                                }}
                                onClick={() => updateOperacionAccessLevel(role as 'dependiente' | 'almacenero' | 'economico', level)}
                              >
                                {level === 'none' && <Lock size={18} style={{ color: operacionAccessLevels[role as keyof typeof operacionAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'own_store' && <Store size={18} style={{ color: operacionAccessLevels[role as keyof typeof operacionAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'all_stores' && <Globe size={18} style={{ color: operacionAccessLevels[role as keyof typeof operacionAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {(operacionAccessLevels.dependiente !== 'none' || operacionAccessLevels.almacenero !== 'none' || operacionAccessLevels.economico !== 'none') && (
                      <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-semibold" style={{ color: colors.onSurface }}>Gestión de Operaciones</h3>
                          <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                            style={{ 
                              backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                              borderColor: colors.primary 
                            }}
                            onClick={() => setShowOperacionManage(!showOperacionManage)}
                          >
                            {showOperacionManage ? <ChevronUp size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                          </button>
                        </div>
                        {showOperacionManage && (
                          <>
                            <p className="text-sm mb-3" style={{ color: colors.outline }}>
                              Configura qué roles pueden crear, editar y eliminar operaciones (solo visible para roles con acceso)
                            </p>
                            {operacionAccessLevels.dependiente !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Dependiente</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Operaciones - Dependiente',
                                      content: 'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar operaciones. Cuando está desactivado, solo pueden ver la información sin poder gestionar operaciones.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: operacionManagePermissions.dependiente ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleOperacionManagePermission('dependiente')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: operacionManagePermissions.dependiente ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: operacionManagePermissions.dependiente ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {operacionAccessLevels.almacenero !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Almacenero</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Operaciones - Almacenero',
                                      content: 'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar operaciones. Cuando está desactivado, solo pueden ver la información sin poder gestionar operaciones.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: operacionManagePermissions.almacenero ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleOperacionManagePermission('almacenero')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: operacionManagePermissions.almacenero ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: operacionManagePermissions.almacenero ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {operacionAccessLevels.economico !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Económico</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Operaciones - Económico',
                                      content: 'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar operaciones. Cuando está desactivado, solo pueden ver la información sin poder gestionar operaciones.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: operacionManagePermissions.economico ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleOperacionManagePermission('economico')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: operacionManagePermissions.economico ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: operacionManagePermissions.economico ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Info Modal */}
              {infoModal && (
                <div 
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  onClick={() => setInfoModal(null)}
                >
                  <div 
                    className="rounded-2xl p-6 max-w-md w-full shadow-lg"
                    style={{ backgroundColor: colors.surface }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 
                        className="text-lg font-bold"
                        style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                      >
                        {infoModal.title}
                      </h3>
                      <button
                        className="p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.background, color: colors.onSurface }}
                        onClick={() => setInfoModal(null)}
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <p 
                      className="text-sm whitespace-pre-line"
                      style={{ color: colors.onSurface }}
                    >
                      {infoModal.content}
                    </p>
                    <button
                      className="w-full mt-4 rounded-lg px-4 py-2 transition-colors hover:opacity-90"
                      style={{ backgroundColor: colors.primary, color: '#fff' }}
                      onClick={() => setInfoModal(null)}
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

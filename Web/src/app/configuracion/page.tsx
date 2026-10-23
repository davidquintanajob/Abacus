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
import { getTiendas } from '../../services/tiendaService';
import { getCuentas } from '../../services/cuentaService';
import { RefreshCw, Info, ChevronUp, ChevronDown, ChevronLeft, Plus, Package, Lock, Store, Globe, X, Settings, ArrowRightLeft } from 'lucide-react';

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
  const [showVentaPermissions, setShowVentaPermissions] = useState(false);
  const [showVentaManage, setShowVentaManage] = useState(false);
  const [showMovimientoPermissions, setShowMovimientoPermissions] = useState(false);
  const [showMovimientoManage, setShowMovimientoManage] = useState(false);
  const [showSalesConfigurations, setShowSalesConfigurations] = useState(false);
  const [showComprobanteConfig, setShowComprobanteConfig] = useState(false);
  const [showSalesConfigModal, setShowSalesConfigModal] = useState(false);
  const [showComprobanteConfigModal, setShowComprobanteConfigModal] = useState(false);
  const [selectedTienda, setSelectedTienda] = useState<any>(null);
  const [availableTiendas, setAvailableTiendas] = useState<any[]>([]);
  const [availableCuentas, setAvailableCuentas] = useState<any[]>([]);
  const [tiendaCuentasSelection, setTiendaCuentasSelection] = useState<any>({});
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
  const [ventaAccessLevels, setVentaAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [ventaManagePermissions, setVentaManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [cuentaChangePermissions, setCuentaChangePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [movimientoAccessLevels, setMovimientoAccessLevels] = useState({
    dependiente: 'none',
    almacenero: 'none',
    economico: 'none',
  });
  const [movimientoManagePermissions, setMovimientoManagePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [priceChangePermissions, setPriceChangePermissions] = useState({
    dependiente: false,
    almacenero: false,
    economico: false,
  });
  const [comprobanteConfig, setComprobanteConfig] = useState<{
    logo: string | null | undefined;
    nombreNegocio: string;
  }>({
    logo: null,
    nombreNegocio: '',
  });
  const [tiendaCuentasConfig, setTiendaCuentasConfig] = useState<any>({});
  const [showTiendaSelection, setShowTiendaSelection] = useState(true);
  const [showCuentaSelector, setShowCuentaSelector] = useState(false);
  const [selectorTipoCuenta, setSelectorTipoCuenta] = useState('');
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
      if (data.ventaAccessLevels) {
        setVentaAccessLevels({
          dependiente: data.ventaAccessLevels.dependiente || 'none',
          almacenero: data.ventaAccessLevels.almacenero || 'none',
          economico: data.ventaAccessLevels.economico || 'none',
        });
      }
      if (data.ventaManagePermissions) {
        setVentaManagePermissions({
          dependiente: data.ventaManagePermissions.dependiente || false,
          almacenero: data.ventaManagePermissions.almacenero || false,
          economico: data.ventaManagePermissions.economico || false,
        });
      }
      if (data.cuentaChangePermissions) {
        setCuentaChangePermissions({
          dependiente: data.cuentaChangePermissions.dependiente || false,
          almacenero: data.cuentaChangePermissions.almacenero || false,
          economico: data.cuentaChangePermissions.economico || false,
        });
      }
      if (data.movimientoAccessLevels) {
        setMovimientoAccessLevels({
          dependiente: data.movimientoAccessLevels.dependiente || 'none',
          almacenero: data.movimientoAccessLevels.almacenero || 'none',
          economico: data.movimientoAccessLevels.economico || 'none',
        });
      }
      if (data.movimientoManagePermissions) {
        setMovimientoManagePermissions({
          dependiente: data.movimientoManagePermissions.dependiente || false,
          almacenero: data.movimientoManagePermissions.almacenero || false,
          economico: data.movimientoManagePermissions.economico || false,
        });
      }
      if (data.priceChangePermissions) {
        setPriceChangePermissions({
          dependiente: data.priceChangePermissions.dependiente || false,
          almacenero: data.priceChangePermissions.almacenero || false,
          economico: data.priceChangePermissions.economico || false,
        });
      }
      if (data.comprobanteConfig) {
        setComprobanteConfig({
          logo: data.comprobanteConfig.logo ?? null,
          nombreNegocio: data.comprobanteConfig.nombreNegocio ?? '',
        });
      }
      if (data.tiendaCuentasConfig) {
        setTiendaCuentasConfig(data.tiendaCuentasConfig);
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
        ventaAccessLevels: ventaAccessLevels,
        entradaManagePermissions: entradaManagePermissions,
        salidaManagePermissions: salidaManagePermissions,
        operacionManagePermissions: operacionManagePermissions,
        ventaManagePermissions: ventaManagePermissions,
        cuentaChangePermissions: cuentaChangePermissions,
        priceChangePermissions: priceChangePermissions,
        comprobanteConfig: comprobanteConfig,
        tiendaCuentasConfig: tiendaCuentasConfig,
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

  const updateVentaAccessLevel = async (role: 'dependiente' | 'almacenero' | 'economico', level: string) => {
    const newLevels = { ...ventaAccessLevels, [role]: level };
    setVentaAccessLevels(newLevels);
    
    try {
      const updatedConfig = {
        ...config,
        ventaAccessLevels: newLevels,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Nivel de acceso actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso' });
      setVentaAccessLevels(ventaAccessLevels);
    }
  };

  const toggleVentaManagePermission = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newPermissions = { ...ventaManagePermissions, [role]: !ventaManagePermissions[role] };
    setVentaManagePermissions(newPermissions);

    try {
      const updatedConfig = {
        ...config,
        ventaManagePermissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de gestión actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión' });
      setVentaManagePermissions(ventaManagePermissions);
    }
  };

  const updateMovimientoAccessLevel = async (role: 'dependiente' | 'almacenero' | 'economico', level: string) => {
    const newLevels = { ...movimientoAccessLevels, [role]: level };
    setMovimientoAccessLevels(newLevels);

    try {
      const updatedConfig = {
        ...config,
        movimientoAccessLevels: newLevels,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Nivel de acceso a movimientos actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar nivel de acceso a movimientos' });
      setMovimientoAccessLevels(movimientoAccessLevels);
    }
  };

  const toggleMovimientoManagePermission = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newPermissions = { ...movimientoManagePermissions, [role]: !movimientoManagePermissions[role] };
    setMovimientoManagePermissions(newPermissions);

    try {
      const updatedConfig = {
        ...config,
        movimientoManagePermissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de gestión de movimientos actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de gestión de movimientos' });
      setMovimientoManagePermissions(movimientoManagePermissions);
    }
  };

  const toggleCuentaChangePermission = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newPermissions = { ...cuentaChangePermissions, [role]: !cuentaChangePermissions[role] };
    setCuentaChangePermissions(newPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        cuentaChangePermissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de cambio de cuenta actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de cambio de cuenta' });
      setCuentaChangePermissions(cuentaChangePermissions);
    }
  };

  const togglePriceChangePermission = async (role: 'dependiente' | 'almacenero' | 'economico') => {
    const newPermissions = { ...priceChangePermissions, [role]: !priceChangePermissions[role] };
    setPriceChangePermissions(newPermissions);
    
    try {
      const updatedConfig = {
        ...config,
        priceChangePermissions: newPermissions,
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Permiso de cambio de precio actualizado correctamente' });
    } catch (error) {
      showToast({ type: 'error', message: 'Error al actualizar permiso de cambio de precio' });
      setPriceChangePermissions(priceChangePermissions);
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

  const handleOpenSalesConfigModal = async () => {
    try {
      setShowSalesConfigModal(true);
      const tiendasData = await getTiendas({}, 1, 1000);
      setAvailableTiendas(tiendasData.data || []);
      const cuentasData = await getCuentas({}, 1, 1000);
      setAvailableCuentas(cuentasData.data || []);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar datos' });
    }
  };

  const handleSaveTiendaCuentas = async () => {
    try {
      const updatedConfig = {
        ...config,
        tiendaCuentasConfig: {
          ...tiendaCuentasConfig,
          [selectedTienda.id_tienda]: tiendaCuentasSelection
        }
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      setTiendaCuentasConfig(updatedConfig.tiendaCuentasConfig);
      showToast({ type: 'success', message: 'Configuración guardada correctamente' });
      setShowSalesConfigModal(false);
      setShowTiendaSelection(true);
      setSelectedTienda(null);
      setTiendaCuentasSelection({});
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar configuración' });
    }
  };

  const handleOpenCuentaSelector = (tipoCuenta: string) => {
    if (!tipoCuenta) {
      showToast({ type: 'error', message: 'Tipo de cuenta no especificado' });
      return;
    }
    setSelectorTipoCuenta(tipoCuenta);
    setShowCuentaSelector(true);
  };

  const handleSelectCuenta = (cuenta: any) => {
    const currentSelection = tiendaCuentasSelection[selectorTipoCuenta] || [];
    if (currentSelection.length >= 4) {
      showToast({ type: 'warning', message: 'Máximo 4 cuentas por tipo' });
      return;
    }
    if (currentSelection.some((c: any) => c.id_cuenta === cuenta.id_cuenta)) {
      showToast({ type: 'warning', message: 'Cuenta ya seleccionada' });
      return;
    }
    setTiendaCuentasSelection((prev: any) => ({
      ...prev,
      [selectorTipoCuenta]: [...currentSelection, cuenta]
    }));
    setShowCuentaSelector(false);
  };

  const handleSaveComprobanteConfig = async () => {
    try {
      const updatedConfig = {
        ...config,
        comprobanteConfig: comprobanteConfig
      };
      await configService.updateConfig(updatedConfig);
      setConfig(updatedConfig);
      showToast({ type: 'success', message: 'Configuración de comprobante guardada correctamente' });
      setShowComprobanteConfigModal(false);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al guardar configuración' });
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

              {/* Configuraciones de Ventas */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div style={{ width: '24px', height: '24px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                      <img
                        src="/sales-config.png"
                        alt="Configuraciones de Ventas"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Configuraciones de Ventas
                    </h2>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowSalesConfigurations(!showSalesConfigurations)}
                  >
                    {showSalesConfigurations ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                {showSalesConfigurations && (
                  <>
                    {/* Configurar Cuentas para Ventas */}
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2" style={{ color: colors.onSurface }}>Configurar Cuentas para Ventas</h3>
                      <p className="text-sm mb-3" style={{ color: colors.outline }}>
                        Configura hasta 4 cuentas por tipo de cuenta para cada tienda. Estas cuentas se usarán por defecto al realizar ventas.
                      </p>
                      <div className="flex justify-center">
                        <button
                          className="rounded-lg px-4 py-2 flex items-center gap-2 transition-colors hover:opacity-90"
                          style={{ backgroundColor: colors.primary, color: '#fff' }}
                          onClick={handleOpenSalesConfigModal}
                        >
                          <Settings size={20} />
                          <span>Configurar Cuentas</span>
                        </button>
                      </div>
                    </div>

                    {/* Cambio de Cuenta en Ventas */}
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2" style={{ color: colors.onSurface }}>Cambio de Cuenta en Ventas</h3>
                      <p className="text-sm mb-3" style={{ color: colors.outline }}>
                        Configura qué roles pueden cambiar la cuenta seleccionada al momento de realizar una venta
                      </p>

                      {['dependiente', 'almacenero', 'economico'].map((role) => (
                        <div key={role} className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.background }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>{role}</span>
                            <button
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: colors.primary, color: '#fff' }}
                              onClick={() => setInfoModal({
                                title: `Cambio de Cuenta - ${role}`,
                                content: 'Cuando está activo, los usuarios con rol ' + role + ' pueden cambiar la cuenta seleccionada al momento de realizar una venta.'
                              })}
                            >
                              !
                            </button>
                          </div>
                          <button
                            className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                            style={{
                              backgroundColor: cuentaChangePermissions[role as keyof typeof cuentaChangePermissions] ? colors.primary : colors.outlineVariant,
                            }}
                            onClick={() => toggleCuentaChangePermission(role as 'dependiente' | 'almacenero' | 'economico')}
                          >
                            <div 
                              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                              style={{
                                transform: cuentaChangePermissions[role as keyof typeof cuentaChangePermissions] ? 'translateX(24px)' : 'translateX(0)',
                                backgroundColor: cuentaChangePermissions[role as keyof typeof cuentaChangePermissions] ? '#fff' : colors.outline,
                              }}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Cambio de Precio en Ventas */}
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2" style={{ color: colors.onSurface }}>Cambio de Precio en Ventas</h3>
                      <p className="text-sm mb-3" style={{ color: colors.outline }}>
                        Configura qué roles pueden cambiar el precio de los productos al momento de realizar una venta
                      </p>

                      {['dependiente', 'almacenero', 'economico'].map((role) => (
                        <div key={role} className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.background }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>{role}</span>
                            <button
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: colors.primary, color: '#fff' }}
                              onClick={() => setInfoModal({
                                title: `Cambio de Precio - ${role}`,
                                content: 'Cuando está activo, los usuarios con rol ' + role + ' pueden cambiar el precio de los productos al momento de realizar una venta.'
                              })}
                            >
                              !
                            </button>
                          </div>
                          <button
                            className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                            style={{
                              backgroundColor: priceChangePermissions[role as keyof typeof priceChangePermissions] ? colors.primary : colors.outlineVariant,
                            }}
                            onClick={() => togglePriceChangePermission(role as 'dependiente' | 'almacenero' | 'economico')}
                          >
                            <div 
                              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                              style={{
                                transform: priceChangePermissions[role as keyof typeof priceChangePermissions] ? 'translateX(24px)' : 'translateX(0)',
                                backgroundColor: priceChangePermissions[role as keyof typeof priceChangePermissions] ? '#fff' : colors.outline,
                              }}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Configuración de Comprobante */}
                    <div>
                      <h3 className="font-semibold mb-2" style={{ color: colors.onSurface }}>Configuración de Comprobante</h3>
                      <p className="text-sm mb-3" style={{ color: colors.outline }}>
                        Personaliza el logo y nombre del negocio que aparecerán en los comprobantes de venta
                      </p>
                      <div className="flex justify-center">
                        <button
                          className="rounded-lg px-4 py-2 flex items-center gap-2 transition-colors hover:opacity-90"
                          style={{ backgroundColor: colors.primary, color: '#fff' }}
                          onClick={() => setShowComprobanteConfigModal(true)}
                        >
                          <Settings size={20} />
                          <span>Configurar</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Permisos de Movimientos */}
              <div
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div style={{ width: '24px', height: '24px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                      <img
                        src="/lanza-libre.svg"
                        alt="Permisos de Movimientos"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h2
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Permisos de Movimientos
                    </h2>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary
                    }}
                    onClick={() => setShowMovimientoPermissions(!showMovimientoPermissions)}
                  >
                    {showMovimientoPermissions ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                {showMovimientoPermissions && (
                  <>
                    <div className="space-y-4">
                      {['dependiente', 'almacenero', 'economico'].map((role) => (
                        <div key={role} className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>{role}</span>
                            <button
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: colors.primary, color: '#fff' }}
                              onClick={() => setInfoModal({
                                title: `Acceso Movimientos - ${role.charAt(0).toUpperCase() + role.slice(1)}`,
                                content: 'Sin acceso: No puede ver movimientos. Mi tienda: Solo puede ver movimientos de su tienda (origen o destino). Todas: Puede ver movimientos de todas las tiendas.'
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
                                  backgroundColor: movimientoAccessLevels[role as keyof typeof movimientoAccessLevels] === level ? colors.primary : 'transparent',
                                  borderColor: movimientoAccessLevels[role as keyof typeof movimientoAccessLevels] === level ? colors.primary : colors.outlineVariant,
                                }}
                                onClick={() => updateMovimientoAccessLevel(role as 'dependiente' | 'almacenero' | 'economico', level)}
                              >
                                {level === 'none' && <Lock size={18} style={{ color: movimientoAccessLevels[role as keyof typeof movimientoAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'own_store' && <Store size={18} style={{ color: movimientoAccessLevels[role as keyof typeof movimientoAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'all_stores' && <Globe size={18} style={{ color: movimientoAccessLevels[role as keyof typeof movimientoAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {(movimientoAccessLevels.dependiente !== 'none' || movimientoAccessLevels.almacenero !== 'none' || movimientoAccessLevels.economico !== 'none') && (
                      <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-semibold" style={{ color: colors.onSurface }}>Gestión de Movimientos</h3>
                          <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                            style={{
                              backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                              borderColor: colors.primary
                            }}
                            onClick={() => setShowMovimientoManage(!showMovimientoManage)}
                          >
                            {showMovimientoManage ? <ChevronUp size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                          </button>
                        </div>
                        <p className="text-sm mb-3" style={{ color: colors.outline }}>
                          Configura qué roles pueden crear, editar y eliminar movimientos (solo visible para roles con acceso)
                        </p>
                        {showMovimientoManage && (
                          <>
                            {movimientoAccessLevels.dependiente !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Dependiente</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Movimientos - Dependiente',
                                      content: 'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar movimientos. Cuando está desactivado, solo pueden ver la información sin poder gestionar movimientos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: movimientoManagePermissions.dependiente ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleMovimientoManagePermission('dependiente')}
                                >
                                  <div
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: movimientoManagePermissions.dependiente ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: movimientoManagePermissions.dependiente ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {movimientoAccessLevels.almacenero !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Almacenero</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Movimientos - Almacenero',
                                      content: 'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar movimientos. Cuando está desactivado, solo pueden ver la información sin poder gestionar movimientos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: movimientoManagePermissions.almacenero ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleMovimientoManagePermission('almacenero')}
                                >
                                  <div
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: movimientoManagePermissions.almacenero ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: movimientoManagePermissions.almacenero ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {movimientoAccessLevels.economico !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Económico</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Movimientos - Económico',
                                      content: 'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar movimientos. Cuando está desactivado, solo pueden ver la información sin poder gestionar movimientos.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: movimientoManagePermissions.economico ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleMovimientoManagePermission('economico')}
                                >
                                  <div
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: movimientoManagePermissions.economico ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: movimientoManagePermissions.economico ? '#fff' : colors.outline,
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

              {/* Permisos de Ventas */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <div style={{ width: '24px', height: '24px', filter: isDarkMode ? 'invert(1)' : 'none' }}>
                      <img
                        src="/icon-ventas.png"
                        alt="Permisos de Ventas"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Permisos de Ventas
                    </h2>
                  </div>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowVentaPermissions(!showVentaPermissions)}
                  >
                    {showVentaPermissions ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                {showVentaPermissions && (
                  <>
                    <p className="text-sm mb-4" style={{ color: colors.outline }}>
                      Configura el nivel de acceso a las ventas para cada rol
                    </p>

                    <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: colors.background }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Lock size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Sin acceso:</strong> No puede ver la pantalla de Ventas ni ninguna venta del sistema</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Store size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Mi tienda:</strong> Puede ver la pantalla de Ventas pero solo las ventas de su tienda</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe size={16} style={{ color: colors.outline }} />
                        <span className="text-sm" style={{ color: colors.outline }}><strong>Todas las tiendas:</strong> Puede ver la pantalla de Ventas y las ventas de todas las tiendas</span>
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
                                title: `Acceso a Ventas - ${role}`,
                                content: 'Define si los usuarios con rol ' + role + ' no tienen acceso a ventas, solo pueden ver las de su tienda, o pueden ver las de todas las tiendas.'
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
                                  backgroundColor: ventaAccessLevels[role as keyof typeof ventaAccessLevels] === level ? colors.primary : 'transparent',
                                  borderColor: ventaAccessLevels[role as keyof typeof ventaAccessLevels] === level ? colors.primary : colors.outlineVariant,
                                }}
                                onClick={() => updateVentaAccessLevel(role as 'dependiente' | 'almacenero' | 'economico', level)}
                              >
                                {level === 'none' && <Lock size={18} style={{ color: ventaAccessLevels[role as keyof typeof ventaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'own_store' && <Store size={18} style={{ color: ventaAccessLevels[role as keyof typeof ventaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                                {level === 'all_stores' && <Globe size={18} style={{ color: ventaAccessLevels[role as keyof typeof ventaAccessLevels] === level ? '#fff' : colors.onSurface }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {(ventaAccessLevels.dependiente !== 'none' || ventaAccessLevels.almacenero !== 'none' || ventaAccessLevels.economico !== 'none') && (
                      <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: colors.background }}>
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-semibold" style={{ color: colors.onSurface }}>Gestión de Ventas</h3>
                          <button
                            className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                            style={{ 
                              backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                              borderColor: colors.primary 
                            }}
                            onClick={() => setShowVentaManage(!showVentaManage)}
                          >
                            {showVentaManage ? <ChevronUp size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={16} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                          </button>
                        </div>
                        {showVentaManage && (
                          <>
                            <p className="text-sm mb-3" style={{ color: colors.outline }}>
                              Configura qué roles pueden crear, editar y eliminar ventas (solo visible para roles con acceso)
                            </p>
                            {ventaAccessLevels.dependiente !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Dependiente</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Ventas - Dependiente',
                                      content: 'Cuando está activo, los usuarios con rol Dependiente pueden crear, editar y eliminar ventas. Cuando está desactivado, solo pueden ver la información sin poder gestionar ventas.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: ventaManagePermissions.dependiente ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleVentaManagePermission('dependiente')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: ventaManagePermissions.dependiente ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: ventaManagePermissions.dependiente ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {ventaAccessLevels.almacenero !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg mb-2" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Almacenero</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Ventas - Almacenero',
                                      content: 'Cuando está activo, los usuarios con rol Almacenero pueden crear, editar y eliminar ventas. Cuando está desactivado, solo pueden ver la información sin poder gestionar ventas.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: ventaManagePermissions.almacenero ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleVentaManagePermission('almacenero')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: ventaManagePermissions.almacenero ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: ventaManagePermissions.almacenero ? '#fff' : colors.outline,
                                    }}
                                  />
                                </button>
                              </div>
                            )}
                            {ventaAccessLevels.economico !== 'none' && (
                              <div className="flex justify-between items-center p-3 rounded-lg" style={{ backgroundColor: colors.surface }}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium" style={{ color: colors.onSurface, textTransform: 'capitalize' }}>Económico</span>
                                  <button
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                                    onClick={() => setInfoModal({
                                      title: 'Gestión Ventas - Económico',
                                      content: 'Cuando está activo, los usuarios con rol Económico pueden crear, editar y eliminar ventas. Cuando está desactivado, solo pueden ver la información sin poder gestionar ventas.'
                                    })}
                                  >
                                    !
                                  </button>
                                </div>
                                <button
                                  className={`relative w-14 h-8 rounded-full transition-colors duration-200`}
                                  style={{
                                    backgroundColor: ventaManagePermissions.economico ? colors.primary : colors.outlineVariant,
                                  }}
                                  onClick={() => toggleVentaManagePermission('economico')}
                                >
                                  <div 
                                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200`}
                                    style={{
                                      transform: ventaManagePermissions.economico ? 'translateX(24px)' : 'translateX(0)',
                                      backgroundColor: ventaManagePermissions.economico ? '#fff' : colors.outline,
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

              {/* Sales Config Modal */}
              {showSalesConfigModal && (
                <div 
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  onClick={() => setShowSalesConfigModal(false)}
                >
                  <div 
                    className="rounded-2xl p-6 max-w-2xl w-full shadow-lg max-h-[90vh] overflow-y-auto"
                    style={{ backgroundColor: colors.surface }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 
                        className="text-lg font-bold"
                        style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                      >
                        Configurar Cuentas por Tienda
                      </h3>
                      <button
                        className="p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.background, color: colors.onSurface }}
                        onClick={() => {
                          setShowSalesConfigModal(false);
                          setShowTiendaSelection(true);
                          setSelectedTienda(null);
                          setTiendaCuentasSelection({});
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {!showTiendaSelection ? (
                      <>
                        {/* Vista de configuración de tienda seleccionada */}
                        <div className="flex items-center gap-3 mb-4">
                          <button
                            onClick={() => {
                              setShowTiendaSelection(true);
                              setSelectedTienda(null);
                              setTiendaCuentasSelection({});
                            }}
                            className="p-2 rounded-lg transition-colors hover:opacity-80"
                            style={{ backgroundColor: colors.background, color: colors.primary }}
                          >
                            <ChevronLeft size={20} />
                          </button>
                          <h4 
                            className="text-base font-semibold"
                            style={{ color: colors.onSurface }}
                          >
                            {selectedTienda?.nombre}
                          </h4>
                        </div>

                        <div className="space-y-4">
                          {[
                            { tipo: 'efectivo_cup', label: 'Efectivo CUP', icon: '💵', color: '#4CAF50' },
                            { tipo: 'efectivo_usd', label: 'Efectivo USD', icon: '💲', color: '#2196F3' },
                            { tipo: 'transferencia_cup', label: 'Transferencia CUP', icon: '🔄', color: '#FF9800' },
                            { tipo: 'transferencia_usd', label: 'Transferencia USD', icon: '💳', color: '#9C27B0' }
                          ].map((config) => (
                            <div key={config.tipo} className="rounded-lg p-4 border" style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant }}>
                              <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl">{config.icon}</span>
                                  <span className="font-semibold" style={{ color: colors.onSurface }}>{config.label}</span>
                                </div>
                                <span className="text-sm" style={{ color: colors.outline }}>
                                  {(tiendaCuentasSelection[config.tipo] || []).length}/4
                                </span>
                              </div>

                              <div className="space-y-2 mb-3">
                                {(tiendaCuentasSelection[config.tipo] || []).length === 0 ? (
                                  <p className="text-sm text-center py-2" style={{ color: colors.outline }}>
                                    No hay cuentas seleccionadas
                                  </p>
                                ) : (
                                  (tiendaCuentasSelection[config.tipo] || []).map((cuenta: any, index: number) => (
                                    <div key={cuenta.id_cuenta} className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: colors.surface }}>
                                      <span className="text-sm" style={{ color: colors.onSurface }}>{cuenta.nombre}</span>
                                      <button
                                        onClick={() => {
                                          const newSelection = [...(tiendaCuentasSelection[config.tipo] || [])];
                                          newSelection.splice(index, 1);
                                          setTiendaCuentasSelection((prev: any) => ({
                                            ...prev,
                                            [config.tipo]: newSelection
                                          }));
                                        }}
                                        className="p-1 rounded"
                                        style={{ backgroundColor: `${config.color}20`, color: config.color }}
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>

                              {(tiendaCuentasSelection[config.tipo] || []).length < 4 && (
                                <button
                                  onClick={() => handleOpenCuentaSelector(config.tipo)}
                                  className="w-full py-2 rounded-lg flex items-center justify-center gap-2 transition-colors hover:opacity-80"
                                  style={{ backgroundColor: `${config.color}20`, border: `1px solid ${config.color}`, color: config.color }}
                                >
                                  <Plus size={16} />
                                  <span className="text-sm">Agregar cuenta {config.label}</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-4 mt-6">
                          <button
                            className="flex-1 rounded-lg px-4 py-2 transition-colors hover:opacity-90"
                            style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}`, color: colors.onSurface }}
                            onClick={() => {
                              setShowSalesConfigModal(false);
                              setShowTiendaSelection(true);
                              setSelectedTienda(null);
                              setTiendaCuentasSelection({});
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            className="flex-1 rounded-lg px-4 py-2 transition-colors hover:opacity-90"
                            style={{ backgroundColor: colors.primary, color: '#fff' }}
                            onClick={handleSaveTiendaCuentas}
                          >
                            Guardar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Vista de selección de tienda */}
                        <p className="text-sm mb-4" style={{ color: colors.outline }}>
                          Selecciona una tienda para configurar sus cuentas por defecto
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          {availableTiendas.map((tienda: any) => {
                            const hasConfig = tiendaCuentasConfig[tienda.id_tienda];
                            const hasCuentas = Object.keys(hasConfig || {}).some(tipo => (hasConfig[tipo] || []).length > 0);
                            const isSelected = hasConfig && hasCuentas;

                            return (
                              <button
                                key={tienda.id_tienda}
                                onClick={() => {
                                  setSelectedTienda(tienda);
                                  setTiendaCuentasSelection(tiendaCuentasConfig[tienda.id_tienda] || {});
                                  setShowTiendaSelection(false);
                                }}
                                className="p-4 rounded-lg flex items-center justify-between transition-colors hover:opacity-80"
                                style={{
                                  backgroundColor: isSelected ? colors.primary : colors.background,
                                  borderColor: isSelected ? colors.primary : colors.outlineVariant,
                                  borderWidth: '1px'
                                }}
                              >
                                <span className="font-medium" style={{ color: isSelected ? '#fff' : colors.onSurface }}>
                                  {tienda.nombre}
                                </span>
                                {isSelected && <span>✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Cuenta Selector Modal */}
              {showCuentaSelector && (
                <div 
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  onClick={() => setShowCuentaSelector(false)}
                >
                  <div 
                    className="rounded-2xl p-6 max-w-md w-full shadow-lg max-h-[90vh] overflow-y-auto"
                    style={{ backgroundColor: colors.surface }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 
                        className="text-lg font-bold"
                        style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                      >
                        Seleccionar Cuenta
                      </h3>
                      <button
                        className="p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.background, color: colors.onSurface }}
                        onClick={() => setShowCuentaSelector(false)}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <p className="text-sm mb-4" style={{ color: colors.outline }}>
                      Selecciona una cuenta de tipo: {selectorTipoCuenta.replace('_', ' ').toUpperCase()}
                    </p>

                    <div className="space-y-2">
                      {(() => {
                        // Mapeo de tipos internos a tipos del backend
                        const tipoMapping: { [key: string]: string } = {
                          'efectivo_cup': 'Efectivo CUP',
                          'efectivo_usd': 'Efectivo USD',
                          'transferencia_cup': 'Transferencia CUP',
                          'transferencia_usd': 'Transferencia USD',
                        };
                        
                        const tipoBuscado = tipoMapping[selectorTipoCuenta];
                        const filteredCuentas = availableCuentas.filter((cuenta: any) => cuenta.tipo_cuenta === tipoBuscado);
                        
                        console.log('Selector tipo cuenta:', selectorTipoCuenta);
                        console.log('Tipo buscado:', tipoBuscado);
                        console.log('Available cuentas:', availableCuentas);
                        console.log('Filtered cuentas:', filteredCuentas);
                        
                        return filteredCuentas.map((cuenta: any) => (
                          <button
                            key={cuenta.id_cuenta}
                            onClick={() => handleSelectCuenta(cuenta)}
                            className="w-full p-3 rounded-lg flex items-center justify-between transition-colors hover:opacity-80"
                            style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                          >
                            <span className="font-medium" style={{ color: colors.onSurface }}>
                              {cuenta.nombre}
                            </span>
                            {cuenta.num_cuenta && (
                              <span className="text-sm" style={{ color: colors.outline }}>
                                {cuenta.num_cuenta}
                              </span>
                            )}
                          </button>
                        ));
                      })()}
                    </div>

                    {(() => {
                        // Mapeo de tipos internos a tipos del backend
                        const tipoMapping: { [key: string]: string } = {
                          'efectivo_cup': 'Efectivo CUP',
                          'efectivo_usd': 'Efectivo USD',
                          'transferencia_cup': 'Transferencia CUP',
                          'transferencia_usd': 'Transferencia USD',
                        };
                        
                        const tipoBuscado = tipoMapping[selectorTipoCuenta];
                        const filteredCuentas = availableCuentas.filter((cuenta: any) => cuenta.tipo_cuenta === tipoBuscado);
                        
                        return filteredCuentas.length === 0 && (
                          <p className="text-center py-4" style={{ color: colors.outline }}>
                            No hay cuentas disponibles de este tipo
                          </p>
                        );
                      })()}
                  </div>
                </div>
              )}

              {/* Comprobante Config Modal */}
              {showComprobanteConfigModal && (
                <div 
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  onClick={() => setShowComprobanteConfigModal(false)}
                >
                  <div 
                    className="rounded-2xl p-6 max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto"
                    style={{ backgroundColor: colors.surface }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 
                        className="text-lg font-bold"
                        style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                      >
                        Configuración de Comprobante
                      </h3>
                      <button
                        className="p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ backgroundColor: colors.background, color: colors.onSurface }}
                        onClick={() => setShowComprobanteConfigModal(false)}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm mb-2" style={{ color: colors.outline }}>Nombre del Negocio</label>
                        <input
                          type="text"
                          className="w-full px-4 py-2 rounded-lg"
                          style={{ backgroundColor: colors.background, color: colors.onSurface, border: `1px solid ${colors.outlineVariant}` }}
                          value={comprobanteConfig.nombreNegocio}
                          onChange={(e) => setComprobanteConfig(prev => ({ ...prev, nombreNegocio: e.target.value }))}
                          placeholder="Ej: Mi Tienda"
                        />
                      </div>

                      <div>
                        <label className="block text-sm mb-2" style={{ color: colors.outline }}>Logo (opcional)</label>
                        <input
                          type="file"
                          accept="image/*"
                          className="w-full px-4 py-2 rounded-lg"
                          style={{ backgroundColor: colors.background, color: colors.onSurface, border: `1px solid ${colors.outlineVariant}` }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setComprobanteConfig(prev => ({ ...prev, logo: reader.result as string }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>

                      <div className="mt-6">
                        <h4 className="text-sm font-semibold mb-3" style={{ color: colors.onSurface }}>Previsualización</h4>
                        <div 
                          className="rounded-lg p-4 border-2"
                          style={{ backgroundColor: '#fff', borderColor: '#000' }}
                        >
                          {comprobanteConfig.logo && (
                            <div className="flex justify-center mb-3">
                              <img 
                                src={comprobanteConfig.logo} 
                                alt="Logo" 
                                className="w-24 h-24 object-contain"
                                style={{ filter: 'grayscale(100%)' }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          <div className="text-center mb-2" style={{ color: '#000', fontWeight: 'bold', fontSize: '16px' }}>
                            {comprobanteConfig.nombreNegocio || 'Nombre del Negocio'}
                          </div>
                          <div className="text-center mb-1" style={{ color: '#000', fontSize: '12px' }}>
                            DEPENDIENTE: {user?.nombre_natural || 'Juan Pérez'}
                          </div>
                          <div className="text-center mb-3" style={{ color: '#000', fontSize: '12px' }}>
                            {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          
                          <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: '#000' }}>
                            <span>Servicio/Producto</span>
                            <span>Cant</span>
                            <span>Total</span>
                          </div>
                          <div className="border-b border-black mb-1"></div>
                          <div className="flex justify-between text-xs mb-1" style={{ color: '#000' }}>
                            <span>Producto 1</span>
                            <span>1</span>
                            <span>${formatCurrency(10)}</span>
                          </div>
                          <div className="flex justify-between text-xs mb-1" style={{ color: '#000' }}>
                            <span>Producto 2</span>
                            <span>2</span>
                            <span>${formatCurrency(30)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: '#000' }}>
                            <span>TOTAL</span>
                            <span></span>
                            <span>${formatCurrency(40)}</span>
                          </div>
                          <div className="border-b border-black mb-2"></div>
                          <div className="text-center" style={{ color: '#000', fontSize: '12px' }}>
                            ¡Gracias por su compra!
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 mt-6">
                      <button
                        className="flex-1 rounded-lg px-4 py-2 transition-colors hover:opacity-90"
                        style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}`, color: colors.onSurface }}
                        onClick={() => setShowComprobanteConfigModal(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        className="flex-1 rounded-lg px-4 py-2 transition-colors hover:opacity-90"
                        style={{ backgroundColor: colors.primary, color: '#fff' }}
                        onClick={handleSaveComprobanteConfig}
                      >
                        Guardar
                      </button>
                    </div>
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

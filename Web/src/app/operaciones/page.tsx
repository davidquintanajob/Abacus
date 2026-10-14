'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { useNavigationLoading } from '../../context/NavigationLoadingContext';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { getOperaciones, deleteOperacion, createOperacion } from '../../services/operacionService';
import { getCuentas } from '../../services/cuentaService';
import { getTiendas } from '../../services/tiendaService';
import { getUsuarios } from '../../services/usuarioService';
import { configService } from '../../services/configService';
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Store,
  Globe,
  X,
  ArrowRightLeft,
  Wallet
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

export default function OperacionesPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user, operacionAccessLevels, operacionManagePermissions } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog, hideConfirmDialog } = useConfirmDialog();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const [isLoading, setIsLoading] = useState(true);
  const [operaciones, setOperaciones] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [userTiendaReady, setUserTiendaReady] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isInitializedRef = useRef(false);

  // Get current date in YYYY-MM-DD format for default filters
  const getLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const formattedDate = getLocalDate();

  const [filters, setFilters] = useState({ 
    id_cuenta: null,
    id_usuario: null,
    nombre_cuenta: '', 
    nombre_usuario: '', 
    id_tienda: '',
    tipo_operacion: '',
    fecha_desde: formattedDate, 
    fecha_hasta: formattedDate, 
    cantidad_min: '', 
    cantidad_max: '' 
  });

  const filtersRef = useRef(filters);
  const userTiendaRef = useRef(user?.id_tienda);
  const hasUserInteractedWithTiendaFilter = useRef(false);

  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    userTiendaRef.current = user?.id_tienda;
  }, [user?.id_tienda]);

  const [cuentas, setCuentas] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentaSearchText, setCuentaSearchText] = useState('');
  const [isLoadingCuentas, setIsLoadingCuentas] = useState(false);
  const [hasLoadedAllCuentas, setHasLoadedAllCuentas] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [hasLoadedAllUsers, setHasLoadedAllUsers] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [hasLoadedAllTiendas, setHasLoadedAllTiendas] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('CUP');
  const [selectedAccountType, setSelectedAccountType] = useState('Efectivo');

  // Transfer modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [allCuentas, setAllCuentas] = useState<any[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showCuentaOrigenDropdown, setShowCuentaOrigenDropdown] = useState(false);
  const [showCuentaDestinoDropdown, setShowCuentaDestinoDropdown] = useState(false);
  const [cuentaOrigenSearchText, setCuentaOrigenSearchText] = useState('');
  const [cuentaDestinoSearchText, setCuentaDestinoSearchText] = useState('');
  const [transferFormData, setTransferFormData] = useState({
    cuentaOrigen: null as any,
    cuentaDestino: null as any,
    cantidad: '',
    motivo: ''
  });
  const [config, setConfig] = useState<any>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  const canViewAllOperaciones = 
    isAdmin ||
    (userRole === 'dependiente' && operacionAccessLevels?.dependiente === 'all_stores') ||
    (userRole === 'almacenero' && operacionAccessLevels?.almacenero === 'all_stores') ||
    (userRole === 'económico' && operacionAccessLevels?.economico === 'all_stores');

  const canManageOperaciones = 
    isAdmin ||
    (userRole === 'dependiente' && operacionManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && operacionManagePermissions?.almacenero) ||
    (userRole === 'económico' && operacionManagePermissions?.economico);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (user?.id_tienda) {
      const userTienda = {
        id_tienda: user.id_tienda,
        nombre: user.tienda?.nombre || `Tienda ${user.id_tienda}`
      };
      setTiendas([userTienda]);
      if (!hasUserInteractedWithTiendaFilter.current) {
        setFilters(prev => ({ ...prev, id_tienda: user.id_tienda.toString() }));
        setTiendaSearchText(user.tienda?.nombre || `Tienda ${user.id_tienda}`);
      }
      setUserTiendaReady(true);
      setIsInitialized(true);
    }
  }, [user?.id_tienda]);

  useEffect(() => {
    if (isInitialized && !hasDoneInitialFetch.current && !user?.id_tienda) {
      fetchOperaciones();
      hasDoneInitialFetch.current = true;
    }
  }, [isInitialized]);

  useEffect(() => {
    if (userTiendaReady && !hasDoneInitialFetch.current) {
      fetchOperaciones();
      hasDoneInitialFetch.current = true;
    }
  }, [userTiendaReady]);

  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchOperaciones();
    }
  }, [pagination.currentPage]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await configService.getConfig();
        setConfig(data);
        if (data.cupToUsdRate) {
          setExchangeRate(data.cupToUsdRate);
        }
      } catch (err) {
        console.error('Error fetching config:', err);
      }
    };
    fetchConfig();
  }, []);

  const fetchAllCuentas = async () => {
    try {
      setIsLoadingCuentas(true);
      const data = await getCuentas({}, 1, 1000);
      setCuentas(data.data || []);
      setHasLoadedAllCuentas(true);
    } catch (err) {
      setCuentas([]);
    } finally {
      setIsLoadingCuentas(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const data = await getUsuarios({ activo: true }, 1, 1000);
      setUsers(data.data || []);
      setHasLoadedAllUsers(true);
    } catch (err) {
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchAllTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      const canViewAll = canViewAllOperaciones;
      const data = await getTiendas({}, 1, 1000);
      const allTiendas = data.data || [];
      
      if (user?.id_tienda && canViewAll) {
        setTiendas(allTiendas);
      } else if (!canViewAll) {
        const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
        setTiendas(userTienda ? [userTienda] : []);
      } else {
        setTiendas(allTiendas);
      }
      setHasLoadedAllTiendas(true);
    } catch (err) {
      setTiendas([]);
    } finally {
      setIsLoadingTiendas(false);
    }
  };

  const adjustFiltersForCubaTimezone = (filters: any) => {
    const adjustedFilters = { ...filters };

    if (adjustedFilters.fecha_desde) {
      const [year, month, day] = adjustedFilters.fecha_desde.split('-').map(Number);
      const cubaMidnightUTC = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
      adjustedFilters.fecha_desde = cubaMidnightUTC.toISOString();
    }

    if (adjustedFilters.fecha_hasta) {
      const [year, month, day] = adjustedFilters.fecha_hasta.split('-').map(Number);
      const cubaEndOfDayUTC = new Date(Date.UTC(year, month - 1, day, 3, 59, 59));
      adjustedFilters.fecha_hasta = cubaEndOfDayUTC.toISOString();
    }

    return adjustedFilters;
  };

  const fetchOperaciones = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      const filtersToUse = overrideFilters || filters;
      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;

      const apiFilters = { ...filtersToUse };
      const adjustedFilters = adjustFiltersForCubaTimezone(apiFilters);

      const data = await getOperaciones(adjustedFilters, fetchPage, fetchLimit);
      setOperaciones(data.data || []);
      setPagination(data.pagination || pagination);
      setSummary(data.summary || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchOperaciones();
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      id_cuenta: null,
      id_usuario: null,
      nombre_cuenta: '', 
      nombre_usuario: '', 
      id_tienda: '',
      tipo_operacion: '',
      fecha_desde: formattedDate, 
      fecha_hasta: formattedDate, 
      cantidad_min: '', 
      cantidad_max: '' 
    };
    
    hasUserInteractedWithTiendaFilter.current = true;
    setFilters(clearedFilters);
    setCuentaSearchText('');
    setUserSearchText('');
    setTiendaSearchText('');
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchOperaciones(clearedFilters);
  };

  const handleDelete = (operacion: any) => {
    showConfirmDialog({
      title: 'Eliminar Operación',
      message: '¿Estás seguro de que quieres eliminar esta operación?',
      onConfirm: async () => {
        try {
          await deleteOperacion(operacion.id_operacion);
          showToast({ type: 'success', message: 'Operación eliminada correctamente' });
          fetchOperaciones();
          hideConfirmDialog();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message || 'Error al eliminar operación' });
        }
      }
    });
  };

  const handleOperacionPress = (operacion: any) => {
    const openMode = canManageOperaciones ? 'edit' : 'view';
    router.push(`/operaciones/form/${operacion.id_operacion}?mode=${openMode}`);
  };

  const handleTransfer = async () => {
    try {
      const response = await getCuentas({}, 1, 1000);
      setAllCuentas(response.data || []);
      setShowTransferModal(true);
    } catch (err: any) {
      showToast({ type: 'error', message: 'Error al cargar las cuentas' });
    }
  };

  const calculateExpectedFund = (cuenta: any, isOrigen: boolean, cantidad: string) => {
    if (!cuenta || !cantidad) return null;
    const currentFund = parseFloat(cuenta.fondo || 0);
    const amount = parseFloat(cantidad) || 0;
    if (isOrigen) {
      return currentFund - amount;
    } else {
      return currentFund + amount;
    }
  };

  const handleTransferSubmit = async () => {
    if (!transferFormData.cuentaOrigen) {
      showToast({ type: 'warning', message: 'Debe seleccionar una cuenta origen' });
      return;
    }
    if (!transferFormData.cuentaDestino) {
      showToast({ type: 'warning', message: 'Debe seleccionar una cuenta destino' });
      return;
    }
    if (!transferFormData.cantidad || parseFloat(transferFormData.cantidad) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor a 0' });
      return;
    }
    if (transferFormData.cuentaOrigen.id_cuenta === transferFormData.cuentaDestino.id_cuenta) {
      showToast({ type: 'warning', message: 'La cuenta origen y destino deben ser diferentes' });
      return;
    }

    try {
      setIsTransferring(true);

      const cantidad = parseFloat(transferFormData.cantidad);
      const cambio = exchangeRate || 1;

      const cuentaOrigenTipo = transferFormData.cuentaOrigen.tipo_cuenta;
      const cuentaDestinoTipo = transferFormData.cuentaDestino.tipo_cuenta;

      const isOrigenCUP = cuentaOrigenTipo.includes('CUP');
      const isDestinoCUP = cuentaDestinoTipo.includes('CUP');
      const isOrigenUSD = cuentaOrigenTipo.includes('USD');
      const isDestinoUSD = cuentaDestinoTipo.includes('USD');

      let cantidadOrigen = cantidad;
      let cantidadDestino = cantidad;

      if (isOrigenCUP && isDestinoUSD) {
        cantidadDestino = cantidad / cambio;
      } else if (isOrigenUSD && isDestinoCUP) {
        cantidadDestino = cantidad * cambio;
      }

      const operacionRetiro: any = {
        id_cuenta: transferFormData.cuentaOrigen.id_cuenta,
        id_usuario: user?.id_usuario,
        cantidad_operacion: cantidadOrigen,
        tipo_operacion: 'Retiro',
        fecha_hora: new Date().toISOString(),
        motivo: `Transferencia a ${transferFormData.cuentaDestino.nombre}. ${transferFormData.motivo}`,
        cambio_moneda: cambio
      };

      const operacionIngreso: any = {
        id_cuenta: transferFormData.cuentaDestino.id_cuenta,
        id_usuario: user?.id_usuario,
        cantidad_operacion: cantidadDestino,
        tipo_operacion: 'Ingreso',
        fecha_hora: new Date().toISOString(),
        motivo: `Transferencia de ${transferFormData.cuentaOrigen.nombre}. ${transferFormData.motivo}`,
        cambio_moneda: cambio
      };

      await createOperacion(operacionRetiro);
      await createOperacion(operacionIngreso);

      showToast({ type: 'success', message: 'Transferencia realizada correctamente' });
      setShowTransferModal(false);
      setTransferFormData({
        cuentaOrigen: null,
        cuentaDestino: null,
        cantidad: '',
        motivo: ''
      });
      setCuentaOrigenSearchText('');
      setCuentaDestinoSearchText('');
      fetchOperaciones();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message || 'Error al realizar la transferencia' });
    } finally {
      setIsTransferring(false);
    }
  };

  const handleAdd = () => {
    router.push('/operaciones/form?mode=add');
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const filteredCuentas = cuentas.filter(cuenta =>
    cuenta.nombre.toLowerCase().includes(cuentaSearchText.toLowerCase())
  );

  const filteredUsers = users.filter(userItem =>
    userItem.nombre_natural?.toLowerCase().includes(userSearchText.toLowerCase())
  );

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre?.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const tiposOperacion = ['Ingreso', 'Retiro', 'Ingreso por Venta', 'Operaciones Manuales'];

  const getOperacionTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'Ingreso':
        return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', label: 'Ingreso' };
      case 'Retiro':
        return { color: '#F44336', bgColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#FFEBEE', borderColor: '#F44336', label: 'Retiro' };
      case 'Ingreso por Venta':
        return { color: '#2196F3', bgColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', borderColor: '#2196F3', label: 'Venta' };
      default:
        return { color: '#757575', bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : '#F5F5F5', borderColor: '#757575', label: tipo };
    }
  };

  const formatNumberWithSpaces = (num: number) => {
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getSummaryValues = () => {
    if (!summary) return { ingresos: 0, retiros: 0, ingresosVenta: 0 };
    
    const currency = selectedCurrency;
    
    if (!filters.id_cuenta) {
      const ingresosEfectivo = summary[`totalIngresoEfectivo${currency}`] || 0;
      const ingresosTransferencia = summary[`totalIngresoTransferencia${currency}`] || 0;
      const retirosEfectivo = summary[`totalRetiroEfectivo${currency}`] || 0;
      const retirosTransferencia = summary[`totalRetiroTransferencia${currency}`] || 0;
      const ingresosVentaEfectivo = summary[`totalIngresoVentaEfectivo${currency}`] || 0;
      const ingresosVentaTransferencia = summary[`totalIngresoVentaTransferencia${currency}`] || 0;
      
      return {
        ingresos: ingresosEfectivo + ingresosTransferencia,
        retiros: retirosEfectivo + retirosTransferencia,
        ingresosVenta: ingresosVentaEfectivo + ingresosVentaTransferencia
      };
    }
    
    const accountType = selectedAccountType;
    const keyPrefix = `totalIngreso${accountType}${currency}`;
    const retiroKey = `totalRetiro${accountType}${currency}`;
    const ventaKey = `totalIngresoVenta${accountType}${currency}`;
    
    return {
      ingresos: summary[keyPrefix] || 0,
      retiros: summary[retiroKey] || 0,
      ingresosVenta: summary[ventaKey] || 0
    };
  };

  const summaryValues = getSummaryValues();

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
          onMenuPress={handleMenuPress}
          onThemePress={toggleTheme}
          onNotificationsPress={() => {}}
          onProfilePress={() => {}}
          showViewToggle={true}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="Operaciones"
          viewMode={viewMode}
          onViewModeToggle={toggleViewMode}
        />

        <div style={{ 
          marginTop: '80px',
          marginRight: 'auto',
          marginBottom: '0',
          marginLeft: 'auto',
          paddingTop: isMobile ? '20px' : isTablet ? '32px' : '20px',
          paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
          paddingBottom: '120px',
          paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
          maxWidth: isDesktop ? '1400px' : '100%',
        }}>
          {/* Desktop Layout */}
          {isDesktop ? (
            <>
              {/* Page Title - Top Left */}
              <div className="mb-4">
                <h1 
                  className="text-2xl font-bold"
                  style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                >
                  Gestión de Operaciones
                </h1>
              </div>

              {/* Filter Section - Horizontal */}
              <div 
                className="rounded-2xl p-4 mb-4 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex items-center gap-3 flex-wrap">

                  {/* Cuenta */}
                  <div className="flex-1 min-w-[200px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Cuenta
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant 
                        }}
                        placeholder="Buscar cuenta..."
                        value={filters.nombre_cuenta}
                        onChange={(e) => {
                          setFilters({ ...filters, nombre_cuenta: e.target.value });
                          setCuentaSearchText(e.target.value);
                        }}
                        onFocus={() => {
                          if (!hasLoadedAllCuentas) fetchAllCuentas();
                          setShowCuentaDropdown(true);
                        }}
                      />
                      {filters.nombre_cuenta && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => {
                            setFilters({ ...filters, nombre_cuenta: '', id_cuenta: null });
                            setCuentaSearchText('');
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
                              className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                              style={{ borderColor: colors.outlineVariant }}
                              onClick={() => {
                                setFilters({ ...filters, nombre_cuenta: cuenta.nombre, id_cuenta: cuenta.id_cuenta });
                                setShowCuentaDropdown(false);
                                setCuentaSearchText('');
                              }}
                            >
                              {cuenta.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tienda */}
                  <div className="flex-1 min-w-[200px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Tienda
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant 
                        }}
                        placeholder="Buscar tienda..."
                        value={tiendaSearchText}
                        onChange={(e) => {
                          setTiendaSearchText(e.target.value);
                        }}
                        onFocus={() => {
                          if (!hasLoadedAllTiendas) fetchAllTiendas();
                          setShowTiendaDropdown(true);
                        }}
                      />
                      {tiendaSearchText && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => {
                            setTiendaSearchText('');
                            setFilters({ ...filters, id_tienda: '' });
                            hasUserInteractedWithTiendaFilter.current = true;
                          }}
                        >
                          <X size={18} style={{ color: colors.outline }} />
                        </button>
                      )}
                      {showTiendaDropdown && filteredTiendas.length > 0 && (
                        <div 
                          className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                          style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                        >
                          {filteredTiendas.map((tienda) => (
                            <div
                              key={tienda.id_tienda}
                              className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                              style={{ borderColor: colors.outlineVariant }}
                              onClick={() => {
                                setFilters({ ...filters, id_tienda: tienda.id_tienda.toString() });
                                setTiendaSearchText(tienda.nombre);
                                setShowTiendaDropdown(false);
                                hasUserInteractedWithTiendaFilter.current = true;
                              }}
                            >
                              {tienda.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Usuario */}
                  <div className="flex-1 min-w-[200px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Usuario
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant 
                        }}
                        placeholder="Buscar usuario..."
                        value={filters.nombre_usuario}
                        onChange={(e) => {
                          setFilters({ ...filters, nombre_usuario: e.target.value });
                          setUserSearchText(e.target.value);
                        }}
                        onFocus={() => {
                          if (!hasLoadedAllUsers) fetchAllUsers();
                          setShowUserDropdown(true);
                        }}
                      />
                      {filters.nombre_usuario && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => {
                            setFilters({ ...filters, nombre_usuario: '', id_usuario: null });
                            setUserSearchText('');
                          }}
                        >
                          <X size={18} style={{ color: colors.outline }} />
                        </button>
                      )}
                      {showUserDropdown && filteredUsers.length > 0 && (
                        <div 
                          className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                          style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                        >
                          {filteredUsers.map((userItem) => (
                            <div
                              key={userItem.id_usuario}
                              className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                              style={{ borderColor: colors.outlineVariant }}
                              onClick={() => {
                                setFilters({ ...filters, nombre_usuario: userItem.nombre_natural, id_usuario: userItem.id_usuario });
                                setShowUserDropdown(false);
                                setUserSearchText('');
                              }}
                            >
                              {userItem.nombre_natural}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tipo de Operación */}
                  <div className="flex-1 min-w-[200px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Tipo de Operación
                    </label>
                    <select
                      className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant 
                      }}
                      value={filters.tipo_operacion}
                      onChange={(e) => setFilters({ ...filters, tipo_operacion: e.target.value })}
                    >
                      <option value="">Todos</option>
                      {tiposOperacion.map((tipo) => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                  </div>

                  {/* Cantidad Mínima */}
                  <div className="flex-1 min-w-[150px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Cantidad Mín
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant 
                      }}
                      placeholder="0"
                      value={filters.cantidad_min}
                      onChange={(e) => setFilters({ ...filters, cantidad_min: e.target.value })}
                    />
                  </div>

                  {/* Cantidad Máxima */}
                  <div className="flex-1 min-w-[150px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Cantidad Máx
                    </label>
                    <input
                      type="number"
                      className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant 
                      }}
                      placeholder="Sin límite"
                      value={filters.cantidad_max}
                      onChange={(e) => setFilters({ ...filters, cantidad_max: e.target.value })}
                    />
                  </div>

                  {/* Fecha Desde */}
                  <div className="min-w-[140px]">
                    <label
                      className="block text-sm font-medium mb-2 whitespace-nowrap"
                      style={{ color: colors.outline }}
                    >
                      Fecha Desde
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif',
                        colorScheme: isDarkMode ? 'dark' : 'light'
                      }}
                      value={filters.fecha_desde}
                      onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
                    />
                  </div>

                  {/* Fecha Hasta */}
                  <div className="min-w-[140px]">
                    <label
                      className="block text-sm font-medium mb-2 whitespace-nowrap"
                      style={{ color: colors.outline }}
                    >
                      Fecha Hasta
                    </label>
                    <input
                      type="date"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: colors.background,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif',
                        colorScheme: isDarkMode ? 'dark' : 'light'
                      }}
                      value={filters.fecha_hasta}
                      onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons - Outside filter card */}
              <div className="flex gap-3 mb-4">
                <button
                  className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                  style={{ 
                    backgroundColor: colors.surface, 
                    borderColor: colors.outlineVariant,
                    color: colors.onSurface
                  }}
                  onClick={handleClearFilters}
                >
                  <RefreshCw size={16} />
                  <span>Limpiar</span>
                </button>
                <button
                  className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleSearch}
                >
                  <Search size={16} />
                  <span>Buscar</span>
                </button>
                <button
                  className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={() => router.push('/cuentas')}
                >
                  <Wallet size={16} />
                  <span>Gestionar Cuentas</span>
                </button>
                {canManageOperaciones && (
                  <button
                    className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleAdd}
                  >
                    <Plus size={16} />
                    <span>Agregar Operación</span>
                  </button>
                )}
                {isAdmin && (
                  <button
                    className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', color: isDarkMode ? colors.primary : '#1976D2' }}
                    onClick={handleTransfer}
                  >
                    <ArrowRightLeft size={16} />
                    <span>Transferir</span>
                  </button>
                )}
              </div>

              {/* Summary Card */}
              {summary && (
                <div 
                  className="rounded-2xl p-4 mb-4 shadow-lg"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h2 
                      className="text-lg font-bold"
                      style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                    >
                      Resumen de Operaciones
                    </h2>
                    <div 
                      className="flex rounded-lg overflow-hidden"
                      style={{ backgroundColor: colors.background }}
                    >
                      <button
                        className={`px-4 py-2 transition-colors ${selectedCurrency === 'CUP' ? 'text-white' : ''}`}
                        style={{ backgroundColor: selectedCurrency === 'CUP' ? colors.primary : 'transparent', color: selectedCurrency === 'CUP' ? '#fff' : colors.outline }}
                        onClick={() => setSelectedCurrency('CUP')}
                      >
                        CUP
                      </button>
                      <button
                        className={`px-4 py-2 transition-colors ${selectedCurrency === 'USD' ? 'text-white' : ''}`}
                        style={{ backgroundColor: selectedCurrency === 'USD' ? colors.primary : 'transparent', color: selectedCurrency === 'USD' ? '#fff' : colors.outline }}
                        onClick={() => setSelectedCurrency('USD')}
                      >
                        USD
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div 
                      className="rounded-xl p-4"
                      style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.1)' : '#E8F5E9', borderColor: '#4CAF50', borderWidth: '1px' }}
                    >
                      <p className="text-sm mb-1" style={{ color: colors.outline }}>Ingresos Manuales</p>
                      <p className="text-xl font-bold" style={{ color: '#4CAF50' }}>
                        {formatNumberWithSpaces(summaryValues.ingresos)}
                      </p>
                    </div>
                    <div 
                      className="rounded-xl p-4"
                      style={{ backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.1)' : '#FFEBEE', borderColor: '#F44336', borderWidth: '1px' }}
                    >
                      <p className="text-sm mb-1" style={{ color: colors.outline }}>Retiros Manuales</p>
                      <p className="text-xl font-bold" style={{ color: '#F44336' }}>
                        {formatNumberWithSpaces(summaryValues.retiros)}
                      </p>
                    </div>
                    <div 
                      className="rounded-xl p-4"
                      style={{ backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.1)' : '#E3F2FD', borderColor: '#2196F3', borderWidth: '1px' }}
                    >
                      <p className="text-sm mb-1" style={{ color: colors.outline }}>Ingresos por Venta</p>
                      <p className="text-xl font-bold" style={{ color: '#2196F3' }}>
                        {formatNumberWithSpaces(summaryValues.ingresosVenta)}
                      </p>
                    </div>
                    <div 
                      className="rounded-xl p-4"
                      style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary, borderWidth: '1px' }}
                    >
                      <p className="text-sm mb-1" style={{ color: colors.outline }}>Cantidad en Negocio</p>
                      <p className="text-xl font-bold" style={{ color: colors.primary }}>
                        {formatNumberWithSpaces(summaryValues.ingresos + summaryValues.ingresosVenta - summaryValues.retiros)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Mobile/Tablet Layout */}
              <h1 
                className="text-2xl md:text-3xl font-bold mb-6 text-center"
                style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
              >
                Gestión de Operaciones
              </h1>

              {/* Filter Section */}
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Filtros
                  </h2>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors hover:opacity-80"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary 
                    }}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    {showAdvancedFilters ? <ChevronUp size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} /> : <ChevronDown size={18} style={{ color: isDarkMode ? colors.primary : '#1976D2' }} />}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* Cuenta */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Cuenta
                    </label>
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
                        value={filters.nombre_cuenta}
                        onChange={(e) => {
                          setFilters({ ...filters, nombre_cuenta: e.target.value });
                          setCuentaSearchText(e.target.value);
                        }}
                        onFocus={() => {
                          if (!hasLoadedAllCuentas) fetchAllCuentas();
                          setShowCuentaDropdown(true);
                        }}
                      />
                      {filters.nombre_cuenta && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => {
                            setFilters({ ...filters, nombre_cuenta: '', id_cuenta: null });
                            setCuentaSearchText('');
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
                              className="px-4 py-3 cursor-pointer hover:opacity-80"
                              style={{ color: isDarkMode ? colors.onSurface : '#000' }}
                              onClick={() => {
                                setFilters({ ...filters, nombre_cuenta: cuenta.nombre, id_cuenta: cuenta.id_cuenta });
                                setShowCuentaDropdown(false);
                                setCuentaSearchText('');
                              }}
                            >
                              {cuenta.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tienda */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                      Tienda
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: colors.background,
                          color: colors.onSurface,
                          borderColor: colors.outlineVariant
                        }}
                        placeholder="Buscar tienda..."
                        value={tiendaSearchText}
                        onChange={(e) => {
                          setTiendaSearchText(e.target.value);
                        }}
                        onFocus={() => {
                          if (!hasLoadedAllTiendas) fetchAllTiendas();
                          setShowTiendaDropdown(true);
                        }}
                      />
                      {tiendaSearchText && (
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => {
                            setTiendaSearchText('');
                            setFilters({ ...filters, id_tienda: '' });
                            hasUserInteractedWithTiendaFilter.current = true;
                          }}
                        >
                          <X size={18} style={{ color: colors.outline }} />
                        </button>
                      )}
                      {showTiendaDropdown && filteredTiendas.length > 0 && (
                        <div
                          className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                          style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                        >
                          {filteredTiendas.map((tienda) => (
                            <div
                              key={tienda.id_tienda}
                              className="px-4 py-3 cursor-pointer hover:opacity-80"
                              style={{ color: isDarkMode ? colors.onSurface : '#000' }}
                              onClick={() => {
                                setFilters({ ...filters, id_tienda: tienda.id_tienda.toString() });
                                setTiendaSearchText(tienda.nombre);
                                setShowTiendaDropdown(false);
                                hasUserInteractedWithTiendaFilter.current = true;
                              }}
                            >
                              {tienda.nombre}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {showAdvancedFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Usuario */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                        Usuario
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.onSurface,
                            borderColor: colors.outlineVariant
                          }}
                          placeholder="Buscar usuario..."
                          value={filters.nombre_usuario}
                          onChange={(e) => {
                            setFilters({ ...filters, nombre_usuario: e.target.value });
                            setUserSearchText(e.target.value);
                          }}
                          onFocus={() => {
                            if (!hasLoadedAllUsers) fetchAllUsers();
                            setShowUserDropdown(true);
                          }}
                        />
                        {filters.nombre_usuario && (
                          <button
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                            onClick={() => {
                              setFilters({ ...filters, nombre_usuario: '', id_usuario: null });
                              setUserSearchText('');
                            }}
                          >
                            <X size={18} style={{ color: colors.outline }} />
                          </button>
                        )}
                        {showUserDropdown && filteredUsers.length > 0 && (
                          <div
                            className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                            style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                          >
                            {filteredUsers.map((userItem) => (
                              <div
                                key={userItem.id_usuario}
                                className="px-4 py-3 cursor-pointer hover:opacity-80"
                                style={{ color: isDarkMode ? colors.onSurface : '#000' }}
                                onClick={() => {
                                  setFilters({ ...filters, nombre_usuario: userItem.nombre_natural, id_usuario: userItem.id_usuario });
                                  setShowUserDropdown(false);
                                  setUserSearchText('');
                                }}
                              >
                                {userItem.nombre_natural}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tipo de Operación */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                        Tipo de Operación
                      </label>
                      <select
                        className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: colors.background,
                          color: colors.onSurface,
                          borderColor: colors.outlineVariant
                        }}
                        value={filters.tipo_operacion}
                        onChange={(e) => setFilters({ ...filters, tipo_operacion: e.target.value })}
                      >
                        <option value="">Todos</option>
                        {tiposOperacion.map((tipo) => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Cantidad Mínima
                        </label>
                        <input
                          type="number"
                          className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.onSurface,
                            borderColor: colors.outlineVariant
                          }}
                          placeholder="0"
                          value={filters.cantidad_min}
                          onChange={(e) => setFilters({ ...filters, cantidad_min: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Cantidad Máxima
                        </label>
                        <input
                          type="number"
                          className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.onSurface,
                            borderColor: colors.outlineVariant
                          }}
                          placeholder="Sin límite"
                          value={filters.cantidad_max}
                          onChange={(e) => setFilters({ ...filters, cantidad_max: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Fecha Desde
                        </label>
                        <input
                          type="date"
                          className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.onSurface,
                            borderColor: colors.outlineVariant
                          }}
                          value={filters.fecha_desde}
                          onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Fecha Hasta
                        </label>
                        <input
                          type="date"
                          className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                          style={{
                            backgroundColor: colors.background,
                            color: colors.onSurface,
                            borderColor: colors.outlineVariant
                          }}
                          value={filters.fecha_hasta}
                          onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    className="rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px', color: colors.onSurface }}
                    onClick={handleClearFilters}
                  >
                    <X size={18} />
                    <span>Limpiar</span>
                  </button>
                  <button
                    className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSearch}
                  >
                    <Search size={18} />
                    <span>Buscar</span>
                  </button>
                </div>
              </div>

            {/* Summary Card - Mobile/Tablet */}
            {summary && (
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 
                    className="text-lg font-bold"
                    style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                  >
                    Resumen de Operaciones
                  </h2>
                  <div 
                    className="flex rounded-lg overflow-hidden"
                    style={{ backgroundColor: colors.background }}
                  >
                    <button
                      className={`px-4 py-2 transition-colors ${selectedCurrency === 'CUP' ? 'text-white' : ''}`}
                      style={{ backgroundColor: selectedCurrency === 'CUP' ? colors.primary : 'transparent', color: selectedCurrency === 'CUP' ? '#fff' : colors.outline }}
                      onClick={() => setSelectedCurrency('CUP')}
                    >
                      CUP
                    </button>
                    <button
                      className={`px-4 py-2 transition-colors ${selectedCurrency === 'USD' ? 'text-white' : ''}`}
                      style={{ backgroundColor: selectedCurrency === 'USD' ? colors.primary : 'transparent', color: selectedCurrency === 'USD' ? '#fff' : colors.outline }}
                      onClick={() => setSelectedCurrency('USD')}
                    >
                      USD
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'auto' }}>
                  <div
                    className="rounded-xl p-4 flex-shrink-0"
                    style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.1)' : '#E8F5E9', borderColor: '#4CAF50', borderWidth: '1px', minWidth: '160px' }}
                  >
                    <p className="text-sm mb-1" style={{ color: colors.outline }}>Ingresos Manuales</p>
                    <p className="text-xl font-bold" style={{ color: '#4CAF50' }}>
                      {formatNumberWithSpaces(summaryValues.ingresos)}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-4 flex-shrink-0"
                    style={{ backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.1)' : '#FFEBEE', borderColor: '#F44336', borderWidth: '1px', minWidth: '160px' }}
                  >
                    <p className="text-sm mb-1" style={{ color: colors.outline }}>Retiros Manuales</p>
                    <p className="text-xl font-bold" style={{ color: '#F44336' }}>
                      {formatNumberWithSpaces(summaryValues.retiros)}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-4 flex-shrink-0"
                    style={{ backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.1)' : '#E3F2FD', borderColor: '#2196F3', borderWidth: '1px', minWidth: '160px' }}
                  >
                    <p className="text-sm mb-1" style={{ color: colors.outline }}>Ingresos por Venta</p>
                    <p className="text-xl font-bold" style={{ color: '#2196F3' }}>
                      {formatNumberWithSpaces(summaryValues.ingresosVenta)}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-4 flex-shrink-0"
                    style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary, borderWidth: '1px', minWidth: '160px' }}
                  >
                    <p className="text-sm mb-1" style={{ color: colors.outline }}>Cantidad en Negocio</p>
                    <p className="text-xl font-bold" style={{ color: colors.primary }}>
                      {formatNumberWithSpaces(summaryValues.ingresos + summaryValues.ingresosVenta - summaryValues.retiros)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons - Mobile/Tablet */}
            <div className="flex gap-3 mb-6">
              <button
                className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={() => router.push('/cuentas')}
              >
                <Wallet size={18} />
                <span>Gestionar Cuentas</span>
              </button>
              {canManageOperaciones && (
                <button
                  className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={handleAdd}
                >
                  <Plus size={18} />
                  <span>Agregar Operación</span>
                </button>
              )}
            </div>
            {isAdmin && (
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90 mb-6"
                style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', color: isDarkMode ? colors.primary : '#1976D2' }}
                onClick={() => {}}
              >
                <ArrowRightLeft size={18} />
                <span>Transferir</span>
              </button>
            )}
            </>
          )}

          {/* Operations List - Common for both layouts */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-t-4 rounded-full animate-spin mb-4" style={{ borderRightColor: colors.primary, borderBottomColor: colors.primary, borderLeftColor: colors.primary, borderTopColor: 'transparent' }} />
              <p style={{ color: colors.outline }}>Cargando operaciones...</p>
            </div>
          ) : error ? (
            <div 
              className="rounded-2xl p-6 text-center"
              style={{ backgroundColor: colors.surface }}
            >
              <AlertCircle size={48} style={{ color: colors.error, margin: '0 auto 1rem' }} />
              <p style={{ color: colors.error }}>{error}</p>
            </div>
          ) : (
            <>
              {viewMode === 'card' ? (
                <div className="grid grid-cols-1 gap-4">
                  {operaciones.map((operacion) => {
                    const typeColor = getOperacionTypeColor(operacion.tipo_operacion);
                    const formattedDate = new Date(operacion.fecha_hora).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    return (
                      <div
                        key={operacion.id_operacion}
                        className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] mb-3"
                        style={{ backgroundColor: colors.surface }}
                        onClick={() => handleOperacionPress(operacion)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-1">
                              <h3 
                                className="font-semibold text-base truncate mr-2"
                                style={{ 
                                  color: colors.onSurface,
                                  fontFamily: 'Hanken Grotesk, sans-serif'
                                }}
                              >
                                {operacion.cuenta?.nombre || 'N/A'}
                              </h3>
                              <div 
                                className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                                style={{ 
                                  backgroundColor: typeColor.bgColor,
                                  color: typeColor.color,
                                  fontFamily: 'Inter, sans-serif'
                                }}
                              >
                                {typeColor.label}
                              </div>
                            </div>
                            <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                              Usuario: {operacion.usuario?.nombre_natural || 'N/A'}
                            </p>
                            <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                              Fecha: {formattedDate}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-semibold" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                                Cantidad: {formatNumberWithSpaces(operacion.cantidad_operacion)}
                              </span>
                            </div>
                            <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                              Motivo: {operacion.motivo || '-'}
                            </p>
                          </div>
                          {canManageOperaciones && (
                            <div className="flex gap-2 ml-3">
                              <button
                                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOperacionPress(operacion);
                                }}
                              >
                                <Edit size={22} style={{ color: colors.primary }} />
                              </button>
                              <button
                                className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(operacion);
                                }}
                              >
                                <Trash2 size={22} style={{ color: colors.error }} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl shadow-lg">
                  <table className="w-full" style={{ backgroundColor: colors.surface }}>
                    <thead>
                      <tr style={{ backgroundColor: colors.primary }}>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '180px' }}>Fecha</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Tipo</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '200px' }}>Cuenta</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '180px' }}>Usuario</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-white" style={{ width: '120px' }}>Cantidad</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '200px' }}>Motivo</th>
                        {canManageOperaciones && (
                          <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Acciones</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {operaciones.map((operacion, index) => {
                        const typeColor = getOperacionTypeColor(operacion.tipo_operacion);
                        const formattedDate = new Date(operacion.fecha_hora).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        return (
                          <tr
                            key={operacion.id_operacion}
                            className="cursor-pointer hover:bg-black/5 transition-colors"
                            style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }}
                            onClick={() => handleOperacionPress(operacion)}
                          >
                            <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                              {formattedDate}
                            </td>
                            <td className="px-4 py-3">
                              <span 
                                className="px-3 py-1 rounded-full text-xs font-medium"
                                style={{ 
                                  backgroundColor: typeColor.bgColor, 
                                  color: typeColor.color,
                                  border: `1px solid ${typeColor.borderColor}`
                                }}
                              >
                                {typeColor.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                              {operacion.cuenta?.nombre || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                              {operacion.usuario?.nombre_natural || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium" style={{ color: typeColor.color }}>
                              {formatNumberWithSpaces(operacion.cantidad_operacion)}
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                              {operacion.motivo || '-'}
                            </td>
                            {canManageOperaciones && (
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOperacionPress(operacion);
                                    }}
                                  >
                                    <Edit size={16} style={{ color: colors.primary }} />
                                  </button>
                                  <button
                                    className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(operacion);
                                    }}
                                  >
                                    <Trash2 size={16} style={{ color: colors.error }} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="rounded-2xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden"
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: colors.outlineVariant }}>
              <h2 className="text-xl font-bold" style={{ color: colors.onSurface }}>
                Transferir entre Cuentas
              </h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                style={{ backgroundColor: colors.background }}
              >
                <X size={20} style={{ color: colors.onSurface }} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
              {/* Cuenta Origen */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cuenta Origen *
                </label>
                <div className="relative">
                  <button
                    className="w-full rounded-lg px-4 py-3 border flex items-center justify-between text-left"
                    style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant }}
                    onClick={() => setShowCuentaOrigenDropdown(!showCuentaOrigenDropdown)}
                  >
                    <span style={{ color: cuentaOrigenSearchText ? colors.onSurface : colors.outline }}>
                      {cuentaOrigenSearchText || 'Seleccionar cuenta origen'}
                    </span>
                    <ChevronDown size={20} style={{ color: colors.outline }} />
                  </button>

                  {showCuentaOrigenDropdown && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                    >
                      {allCuentas
                        .filter(cuenta => cuenta.id_cuenta !== transferFormData.cuentaDestino?.id_cuenta)
                        .map((cuenta) => (
                          <div
                            key={cuenta.id_cuenta}
                            className="px-4 py-3 cursor-pointer hover:opacity-80 border-b"
                            style={{ borderColor: colors.outlineVariant }}
                            onClick={() => {
                              setTransferFormData(prev => ({ ...prev, cuentaOrigen: cuenta }));
                              setCuentaOrigenSearchText(cuenta.nombre);
                              setShowCuentaOrigenDropdown(false);
                            }}
                          >
                            <div className="font-medium" style={{ color: colors.onSurface }}>
                              {cuenta.nombre}
                            </div>
                            <div className="text-sm" style={{ color: colors.outline }}>
                              {cuenta.tipo_cuenta} • Fondo: {formatNumberWithSpaces(cuenta.fondo)}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {transferFormData.cuentaOrigen && !showCuentaOrigenDropdown && (
                    <div className="mt-2 text-sm">
                      <div className="flex justify-between">
                        <span style={{ color: colors.outline }}>Fondo actual:</span>
                        <span className="font-medium" style={{ color: colors.primary }}>
                          {formatNumberWithSpaces(transferFormData.cuentaOrigen.fondo)}
                        </span>
                      </div>
                      {transferFormData.cantidad && (
                        <div className="flex justify-between mt-1">
                          <span style={{ color: colors.outline }}>Después de transferir:</span>
                          <span className="font-medium" style={{ color: colors.primary }}>
                            {calculateExpectedFund(transferFormData.cuentaOrigen, true, transferFormData.cantidad)?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cuenta Destino */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cuenta Destino *
                </label>
                <div className="relative">
                  <button
                    className="w-full rounded-lg px-4 py-3 border flex items-center justify-between text-left"
                    style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant }}
                    onClick={() => setShowCuentaDestinoDropdown(!showCuentaDestinoDropdown)}
                  >
                    <span style={{ color: cuentaDestinoSearchText ? colors.onSurface : colors.outline }}>
                      {cuentaDestinoSearchText || 'Seleccionar cuenta destino'}
                    </span>
                    <ChevronDown size={20} style={{ color: colors.outline }} />
                  </button>

                  {showCuentaDestinoDropdown && (
                    <div
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, borderWidth: '1px' }}
                    >
                      {allCuentas
                        .filter(cuenta => {
                          // Filter out the origin account
                          if (cuenta.id_cuenta === transferFormData.cuentaOrigen?.id_cuenta) return false;

                          // Filter by currency type if origin account is selected
                          if (transferFormData.cuentaOrigen) {
                            const isOrigenCUP = transferFormData.cuentaOrigen.tipo_cuenta.includes('CUP');
                            const isOrigenUSD = transferFormData.cuentaOrigen.tipo_cuenta.includes('USD');
                            const isDestinoCUP = cuenta.tipo_cuenta.includes('CUP');
                            const isDestinoUSD = cuenta.tipo_cuenta.includes('USD');

                            if (isOrigenCUP && !isDestinoCUP) return false;
                            if (isOrigenUSD && !isDestinoUSD) return false;
                          }

                          return true;
                        })
                        .map((cuenta) => (
                          <div
                            key={cuenta.id_cuenta}
                            className="px-4 py-3 cursor-pointer hover:opacity-80 border-b"
                            style={{ borderColor: colors.outlineVariant }}
                            onClick={() => {
                              setTransferFormData(prev => ({ ...prev, cuentaDestino: cuenta }));
                              setCuentaDestinoSearchText(cuenta.nombre);
                              setShowCuentaDestinoDropdown(false);
                            }}
                          >
                            <div className="font-medium" style={{ color: colors.onSurface }}>
                              {cuenta.nombre}
                            </div>
                            <div className="text-sm" style={{ color: colors.outline }}>
                              {cuenta.tipo_cuenta} • Fondo: {formatNumberWithSpaces(cuenta.fondo)}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {transferFormData.cuentaDestino && !showCuentaDestinoDropdown && (
                    <div className="mt-2 text-sm">
                      <div className="flex justify-between">
                        <span style={{ color: colors.outline }}>Fondo actual:</span>
                        <span className="font-medium" style={{ color: colors.primary }}>
                          {formatNumberWithSpaces(transferFormData.cuentaDestino.fondo)}
                        </span>
                      </div>
                      {transferFormData.cantidad && (
                        <div className="flex justify-between mt-1">
                          <span style={{ color: colors.outline }}>Después de recibir:</span>
                          <span className="font-medium" style={{ color: colors.primary }}>
                            {calculateExpectedFund(transferFormData.cuentaDestino, false, transferFormData.cantidad)?.toFixed(2) || '0.00'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Cantidad */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Cantidad *
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }}
                  placeholder="Ingrese la cantidad"
                  value={transferFormData.cantidad}
                  onChange={(e) => setTransferFormData(prev => ({ ...prev, cantidad: e.target.value }))}
                />
              </div>

              {/* Motivo */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Motivo
                </label>
                <textarea
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 resize-none"
                  style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant, minHeight: '80px' }}
                  placeholder="Ingrese el motivo (opcional)"
                  value={transferFormData.motivo}
                  onChange={(e) => setTransferFormData(prev => ({ ...prev, motivo: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t" style={{ borderColor: colors.outlineVariant }}>
              <button
                className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleTransferSubmit}
                disabled={isTransferring}
              >
                {isTransferring ? (
                  <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                ) : (
                  <span>Realizar Transferencia</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

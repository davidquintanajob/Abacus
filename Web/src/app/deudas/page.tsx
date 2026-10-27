'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { useNavigationLoading } from '../../context/NavigationLoadingContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Header } from '../../components/layout/Header';
import { SidebarNavigation } from '../../components/layout/SidebarNavigation';
import { Toast } from '../../components/common/Toast';
import { getDeudas, saldarDeuda, deleteDeuda } from '../../services/deudaService';
import { getCuentas } from '../../services/cuentaService';
import { Search, ChevronLeft, ChevronRight, Trash2, AlertCircle, Grid, List, RefreshCw, X, ChevronDown, ChevronUp, Plus, DollarSign, Calendar, Clock, Phone, File } from 'lucide-react';

const DeudasPage = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, deudaAccessLevels, deudaManagePermissions } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog, hideConfirmDialog } = useConfirmDialog();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const [isInitialized, setIsInitialized] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isInitializedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [deudas, setDeudas] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  // Estado para colapsables de deudas
  const [expandedDeudas, setExpandedDeudas] = useState<Record<string, boolean>>({});

  // Estado para modal de agregar pago
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedDeuda, setSelectedDeuda] = useState<any>(null);
  const [showFormaPagoDropdown, setShowFormaPagoDropdown] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [isLoadingPagoModal, setIsLoadingPagoModal] = useState(false);
  const [loadingDeudaId, setLoadingDeudaId] = useState<number | null>(null);
  const formasPago = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];
  const [pagoFormData, setPagoFormData] = useState({
    cantidad_pagada: '',
    forma_pago: '',
    id_cuenta_operacion: '',
    nota: '',
  });

  // Filtros
  const [filters, setFilters] = useState({
    nombre_cliente: '',
    telefono_cliente: '',
    fecha_desde: '',
    fecha_hasta: '',
    monto_cup_min: '',
    monto_cup_max: '',
    monto_usd_min: '',
    monto_usd_max: '',
    tiene_deuda: '',
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  const canViewDeudas = 
    isAdmin ||
    (userRole === 'dependiente' && deudaAccessLevels?.dependiente === 'ambos') ||
    (userRole === 'almacenero' && deudaAccessLevels?.almacenero === 'ambos') ||
    (userRole === 'económico' && deudaAccessLevels?.economico === 'ambos');

  const canManageDeudas = isAdmin || deudaManagePermissions;

  const toggleDeudaExpand = (deudaId: string) => {
    setExpandedDeudas(prev => ({
      ...prev,
      [deudaId]: !prev[deudaId]
    }));
  };

  const handleAddPago = async (deuda: any) => {
    setSelectedDeuda(deuda);
    setLoadingDeudaId(deuda.id_deuda);
    setIsLoadingPagoModal(true);
    
    // Cargar cuentas disponibles
    try {
      const cuentasData = await getCuentas({}, 1, 1000);
      setCuentas(cuentasData.data || []);
    } catch (error) {
      console.error('Error al cargar cuentas:', error);
      setCuentas([]);
    }

    setPagoFormData({
      cantidad_pagada: '',
      forma_pago: '',
      id_cuenta_operacion: '',
      nota: '',
    });
    setLoadingDeudaId(null);
    setIsLoadingPagoModal(false);
    setShowPagoModal(true);
  };

  const handleSavePago = async () => {
    if (!pagoFormData.cantidad_pagada || pagoFormData.cantidad_pagada.trim() === '') {
      showToast({ type: 'warning', message: 'La cantidad es obligatoria' });
      return;
    }
    if (isNaN(parseFloat(pagoFormData.cantidad_pagada)) || parseFloat(pagoFormData.cantidad_pagada) <= 0) {
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
      const pago = {
        cantidad_pagada: parseFloat(pagoFormData.cantidad_pagada),
        forma_pago: pagoFormData.forma_pago,
        id_cuenta_operacion: parseInt(pagoFormData.id_cuenta_operacion),
        fecha_hora: new Date().toISOString(),
        nota: pagoFormData.nota || null
      };

      await saldarDeuda(selectedDeuda?.id_deuda, [pago]);
      showToast({ type: 'success', message: 'Pago registrado correctamente' });
      setShowPagoModal(false);
      fetchDeudas();
    } catch (err: any) {
      showToast({ type: 'error', message: err.message });
    }
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

  const handleDelete = (deuda: any) => {
    showConfirmDialog({
      title: 'Eliminar Deuda',
      message: `¿Estás seguro de que deseas eliminar la deuda de ${deuda.cliente?.nombre || 'este cliente'}?`,
      onConfirm: async () => {
        try {
          await deleteDeuda(deuda.id_deuda);
          showToast({ type: 'success', message: 'Deuda eliminada correctamente' });
          fetchDeudas();
        } catch (err: any) {
          showToast({ type: 'error', message: err.message });
        }
      }
    });
  };

  const fetchDeudas = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      const filtersToUse = overrideFilters || filters;
      const apiFilters: any = { ...filtersToUse };

      // Remove empty filters to avoid API errors
      if (!apiFilters.nombre_cliente) delete apiFilters.nombre_cliente;
      if (!apiFilters.telefono_cliente) delete apiFilters.telefono_cliente;
      if (!apiFilters.fecha_desde) delete apiFilters.fecha_desde;
      if (!apiFilters.fecha_hasta) delete apiFilters.fecha_hasta;
      if (apiFilters.monto_cup_min === '' || apiFilters.monto_cup_min === undefined) delete apiFilters.monto_cup_min;
      else apiFilters.monto_cup_min = parseFloat(apiFilters.monto_cup_min);
      if (apiFilters.monto_cup_max === '' || apiFilters.monto_cup_max === undefined) delete apiFilters.monto_cup_max;
      else apiFilters.monto_cup_max = parseFloat(apiFilters.monto_cup_max);
      if (apiFilters.monto_usd_min === '' || apiFilters.monto_usd_min === undefined) delete apiFilters.monto_usd_min;
      else apiFilters.monto_usd_min = parseFloat(apiFilters.monto_usd_min);
      if (apiFilters.monto_usd_max === '' || apiFilters.monto_usd_max === undefined) delete apiFilters.monto_usd_max;
      else apiFilters.monto_usd_max = parseFloat(apiFilters.monto_usd_max);
      if (apiFilters.tiene_deuda === '' || apiFilters.tiene_deuda === undefined) delete apiFilters.tiene_deuda;
      else apiFilters.tiene_deuda = apiFilters.tiene_deuda === 'true';

      const data = await getDeudas(apiFilters, pagination.currentPage, pagination.limit);
      let deudasList = data.data || [];

      // Calcular saldada
      deudasList = deudasList.map((deuda: any) => {
        const saldada = deuda.monto_restante_cup === 0 && deuda.monto_restante_usd === 0;
        return { ...deuda, saldada };
      });

      setDeudas(deudasList);
      setPagination(data.pagination || pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      setIsInitialized(true);
      fetchDeudas();
    }
  }, []);

  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  useEffect(() => {
    if (isInitialized && pagination.currentPage > 1) {
      fetchDeudas();
    }
  }, [pagination.currentPage]);

  useEffect(() => {
    if (isInitialized) {
      setPagination(prev => ({ ...prev, currentPage: 1 }));
      setIsSearching(true);
      fetchDeudas();
    }
  }, [filters.tiene_deuda]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchDeudas();
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      nombre_cliente: '',
      telefono_cliente: '',
      fecha_desde: '',
      fecha_hasta: '',
      monto_cup_min: '',
      monto_cup_max: '',
      monto_usd_min: '',
      monto_usd_max: '',
      tiene_deuda: ''
    };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
    }
  };

  if (!canViewDeudas) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background }}>
        <div className="text-center">
          <AlertCircle size={60} style={{ color: colors.outline, marginBottom: 16 }} />
          <p style={{ color: colors.onSurface }}>No tienes permisos para ver deudas</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header
        onMenuPress={handleMenuPress}
        onThemePress={toggleTheme}
        onNotificationsPress={() => {}}
        onProfilePress={() => router.push('/profile')}
        onViewModeToggle={toggleViewMode}
        showViewToggle={false}
        viewMode={viewMode}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
        currentRoute="deudas"
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
            maxWidth: isDesktop ? '1400px' : '100%',
          }}
        >
          <h1 style={{ fontSize: isMobile ? '24px' : isTablet ? '28px' : '32px', fontWeight: 'bold', color: colors.onSurface, marginBottom: isMobile ? '16px' : '24px' }}>
            Deudas
          </h1>

        {/* Search and Filters */}
        <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: colors.surface }}>
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={20} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: colors.outline }} />
              <input
                type="text"
                className="w-full rounded-lg pl-12 pr-4 py-3 border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.background,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                }}
                placeholder="Buscar por nombre del cliente..."
                value={filters.nombre_cliente}
                onChange={(e) => setFilters(prev => ({ ...prev, nombre_cliente: e.target.value }))}
              />
            </div>
            <button
              className="px-4 py-3 rounded-lg flex items-center gap-2"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleSearch}
            >
              <Search size={20} />
              {!isMobile && <span>Buscar</span>}
            </button>
            <button
              className="px-4 py-3 rounded-lg flex items-center gap-2"
              style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant, border: '1px solid' }}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              {showAdvancedFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              {!isMobile && <span>Filtros</span>}
            </button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Teléfono</label>
                <input
                  type="text"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  placeholder="Teléfono"
                  value={filters.telefono_cliente}
                  onChange={(e) => setFilters(prev => ({ ...prev, telefono_cliente: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Fecha desde</label>
                <input
                  type="date"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  value={filters.fecha_desde}
                  onChange={(e) => setFilters(prev => ({ ...prev, fecha_desde: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Fecha hasta</label>
                <input
                  type="date"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  value={filters.fecha_hasta}
                  onChange={(e) => setFilters(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Monto CUP Mín</label>
                <input
                  type="number"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  placeholder="Mínimo..."
                  value={filters.monto_cup_min}
                  onChange={(e) => setFilters(prev => ({ ...prev, monto_cup_min: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Monto CUP Máx</label>
                <input
                  type="number"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  placeholder="Máximo..."
                  value={filters.monto_cup_max}
                  onChange={(e) => setFilters(prev => ({ ...prev, monto_cup_max: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Monto USD Mín</label>
                <input
                  type="number"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  placeholder="Mínimo..."
                  value={filters.monto_usd_min}
                  onChange={(e) => setFilters(prev => ({ ...prev, monto_usd_min: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Monto USD Máx</label>
                <input
                  type="number"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  placeholder="Máximo..."
                  value={filters.monto_usd_max}
                  onChange={(e) => setFilters(prev => ({ ...prev, monto_usd_max: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Estado de Deuda</label>
                <select
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant,
                  }}
                  value={filters.tiene_deuda}
                  onChange={(e) => setFilters(prev => ({ ...prev, tiene_deuda: e.target.value }))}
                >
                  <option value="">Todos</option>
                  <option value="true">Con Deuda</option>
                  <option value="false">Saldadas</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              className="px-4 py-2 rounded-lg flex items-center gap-2"
              style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant, border: '1px solid' }}
              onClick={handleClearFilters}
            >
              <X size={18} />
              <span>Limpiar</span>
            </button>
            <button
              className="px-4 py-2 rounded-lg flex items-center gap-2"
              style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant, border: '1px solid' }}
              onClick={() => fetchDeudas()}
            >
              <RefreshCw size={18} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Leyenda de colores */}
        <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant, border: '1px solid' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.onSurface, marginBottom: '12px' }}>Leyenda de colores:</h3>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: isDarkMode ? 'rgba(156, 39, 176, 0.3)' : '#F3E5F5' }}></div>
              <span style={{ fontSize: '14px', color: colors.onSurface }}>Deuda con venta asociada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.3)' : '#E8F5E9' }}></div>
              <span style={{ fontSize: '14px', color: colors.onSurface }}>Deuda saldada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.3)' : '#F0F4FF' }}></div>
              <span style={{ fontSize: '14px', color: colors.onSurface }}>Deuda pendiente</span>
            </div>
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.onSurface, marginBottom: '12px', marginTop: '12px' }}>Alertas:</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: colors.error }}>
                <AlertCircle size={12} color="#fff" />
              </div>
              <span style={{ fontSize: '14px', color: colors.onSurface }}>Deuda pendiente de pago</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: '#2196F3' }}>
                <File size={12} color="#fff" />
              </div>
              <span style={{ fontSize: '14px', color: colors.onSurface }}>Deuda con nota</span>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="rounded-2xl p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.surface }}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 mb-4" style={{ borderColor: colors.primary }}></div>
            <p style={{ color: colors.outline }}>Cargando deudas...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.surface }}>
            <AlertCircle size={60} style={{ color: colors.error, marginBottom: 16 }} />
            <p style={{ color: colors.error }}>{error}</p>
            <button
              className="mt-4 px-6 py-2 rounded-lg"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={() => fetchDeudas()}
            >
              Reintentar
            </button>
          </div>
        ) : deudas.length === 0 ? (
          <div className="rounded-2xl p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.surface }}>
            <AlertCircle size={60} style={{ color: colors.outline, marginBottom: 16 }} />
            <p style={{ color: colors.outline }}>No se encontraron deudas</p>
          </div>
        ) : (
          <>
            {/* Cards View */}
            <div className="space-y-3">
              {deudas.map((deuda) => {
                const saldada = deuda.monto_restante_cup === 0 && deuda.monto_restante_usd === 0;
                const tieneVentaAsociada = deuda.venta_id !== undefined && deuda.venta_id !== null;

                // Determinar color de fondo según estado
                let cardBgColor = colors.surface;
                if (tieneVentaAsociada) {
                  cardBgColor = isDarkMode ? 'rgba(156, 39, 176, 0.3)' : '#F3E5F5';
                } else if (saldada) {
                  cardBgColor = isDarkMode ? 'rgba(76, 175, 80, 0.3)' : '#E8F5E9';
                } else {
                  cardBgColor = isDarkMode ? 'rgba(33, 150, 243, 0.3)' : '#F0F4FF';
                }

                return (
                  <div
                    key={deuda.id_deuda}
                    className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] relative"
                    style={{ backgroundColor: cardBgColor }}
                  >
                    {/* Alerta de deuda pendiente */}
                    {!saldada && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: colors.error }}>
                        <AlertCircle size={14} color="#fff" />
                      </div>
                    )}

                    {/* Alerta de nota */}
                    {deuda.nota && (
                      <div className="absolute top-2 right-10 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#2196F3' }}>
                        <File size={14} color="#fff" />
                      </div>
                    )}

                    <div className="flex justify-between items-start pr-16">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: colors.onSurface }}>
                            {deuda.cliente?.nombre || 'Sin cliente'}
                          </h3>
                          {saldada && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: '#E8F5E9', color: '#2E7D32' }}>
                              Saldada
                            </span>
                          )}
                          {tieneVentaAsociada && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: isDarkMode ? 'rgba(156, 39, 176, 0.5)' : '#E1BEE7', color: isDarkMode ? '#E1BEE7' : '#7B1FA2' }}>
                              Con venta
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Phone size={16} style={{ color: colors.outline }} />
                          <span style={{ fontSize: '14px', color: colors.onSurface }}>
                            {deuda.cliente?.telefono || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar size={16} style={{ color: colors.outline }} />
                          <span style={{ fontSize: '14px', color: colors.onSurface }}>
                            {new Date(deuda.fecha_hora).toLocaleDateString()}
                          </span>
                        </div>
                        {!saldada && (
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: '14px', color: colors.outline }}>Restante:</span>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: colors.error }}>
                              ${parseFloat(deuda.monto_restante_cup || 0).toFixed(2)} CUP
                            </span>
                            {deuda.monto_restante_usd > 0 && (
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: colors.error }}>
                                + ${parseFloat(deuda.monto_restante_usd).toFixed(2)} USD
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {!saldada && canManageDeudas && (
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddPago(deuda);
                            }}
                            disabled={loadingDeudaId === deuda.id_deuda}
                          >
                            <DollarSign size={22} style={{ color: '#4CAF50' }} />
                          </button>
                        )}
                        {canManageDeudas && (
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#FFEBEE' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(deuda);
                            }}
                          >
                            <Trash2 size={22} style={{ color: '#F44336' }} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button onClick={handlePrevPage} disabled={pagination.currentPage === 1} style={{ color: colors.onSurface }}>
                <ChevronLeft size={20} />
              </button>
              <span style={{ color: colors.onSurface }}>Página {pagination.currentPage} de {pagination.totalPages}</span>
              <button onClick={handleNextPage} disabled={pagination.currentPage === pagination.totalPages} style={{ color: colors.onSurface }}>
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="text-center mt-4">
              <span style={{ color: colors.outline }}>Total: {pagination.totalItems} deudas</span>
            </div>
          </>
        )}

        {/* Pago Modal */}
        {showPagoModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl" style={{ backgroundColor: colors.surface }}>
              <div className="flex justify-between items-center mb-4">
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.onSurface }}>Agregar Pago</h2>
                <button onClick={handleClosePagoModal} style={{ color: colors.onSurface }}>
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Cantidad a pagar</label>
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
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Forma de pago</label>
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
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Cuenta de Operación</label>
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
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>Nota</label>
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

                <div className="flex gap-3 mt-4">
                  <button
                    className="flex-1 px-4 py-3 rounded-lg"
                    style={{ backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant, border: '1px solid' }}
                    onClick={handleClosePagoModal}
                  >
                    Cancelar
                  </button>
                  <button
                    className="flex-1 px-4 py-3 rounded-lg"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleSavePago}
                  >
                    Guardar Pago
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
      </div>
    </div>
    </>
  );
};

export default DeudasPage;

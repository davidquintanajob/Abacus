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
import { getEntradas, deleteEntrada } from '../../services/entradaService';
import { getTiendas } from '../../services/tiendaService';
import { getUsuarios } from '../../services/usuarioService';
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
  AlertCircle,
  Download,
  X,
  Box,
  FileText,
  File
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function EntradasPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog } = useConfirmDialog();
  const { setLoading: setNavigating } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  // Reset navigation loading state when page loads
  useEffect(() => {
    setNavigating(false);
  }, [setNavigating]);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const [isLoading, setIsLoading] = useState(true);
  const [entradas, setEntradas] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [userTiendaReady, setUserTiendaReady] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isFirstFocus = useRef(true);
  const isInitializedRef = useRef(false);

  // Filter states
  const [filters, setFilters] = useState({ 
    nombre_servicio: '', 
    codigo_lote: '', 
    fecha_desde: '', 
    fecha_hasta: '', 
    id_tienda: '', 
    id_usuario: '', 
    cantidad_restante_min: '0.01', 
    cantidad_restante_max: '' 
  });

  const filtersRef = useRef(filters);
  const userTiendaRef = useRef(user?.id_tienda);

  // Keep refs in sync with state
  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    userTiendaRef.current = user?.id_tienda;
  }, [user?.id_tienda]);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [hasLoadedAllTiendas, setHasLoadedAllTiendas] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [hasLoadedAllUsers, setHasLoadedAllUsers] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'excel' | 'pdf' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFieldSelectionModal, setShowFieldSelectionModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState({
    producto: true,
    costo_cup: true,
    costo_usd: true,
    cantidad: true,
    tienda: true,
    fecha: false,
    codigo_lote: false,
    fecha_vencimiento: false,
    proveedor: false,
    usuario: false
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const permissions = user?.permissions || {};

  const canViewAllEntradas = 
    isAdmin ||
    (user?.rol?.toLowerCase() === 'dependiente' && permissions?.dependiente) ||
    (user?.rol?.toLowerCase() === 'almacenero' && permissions?.almacenero) ||
    (user?.rol?.toLowerCase() === 'económico' && permissions?.economico);

  const canManageEntradas = 
    isAdmin ||
    (user?.rol?.toLowerCase() === 'dependiente' && permissions?.dependiente) ||
    (user?.rol?.toLowerCase() === 'almacenero' && permissions?.almacenero) ||
    (user?.rol?.toLowerCase() === 'económico' && permissions?.economico);

  // Initialize user's store from session data immediately
  useEffect(() => {
    if (user?.id_tienda) {
      const userTienda = {
        id_tienda: user.id_tienda,
        nombre: user.tienda?.nombre || `Tienda ${user.id_tienda}`
      };
      setTiendas([userTienda]);
      setFilters(prev => ({ ...prev, id_tienda: user.id_tienda.toString() }));
      setUserTiendaReady(true);
      setIsInitialized(true);
    }
  }, [user?.id_tienda]);

  // Initialize current user from session data immediately
  useEffect(() => {
    if (user?.id_usuario) {
      const currentUser = {
        id_usuario: user.id_usuario,
        nombre_natural: user.nombre_natural || `Usuario ${user.id_usuario}`
      };
      setUsers([currentUser]);
    }
  }, [user?.id_usuario]);

  // Single API call when all data is ready
  useEffect(() => {
    if (userTiendaReady && !hasDoneInitialFetch.current) {
      fetchEntradas();
      hasDoneInitialFetch.current = true;
    }
  }, [userTiendaReady]);

  // Fetch on pagination changes after initial load
  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchEntradas();
    }
  }, [pagination.currentPage]);

  const fetchAllTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      const userRole = user?.rol?.toLowerCase();
      const canViewAll = canViewAllEntradas;

      let allTiendas = [];
      const data = await getTiendas({}, 1, 1000);
      allTiendas = data.data || [];
      
      if (user?.id_tienda && canViewAll) {
        setTiendas(allTiendas);
      } else if (!canViewAll) {
        setTiendas([]);
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

  const fetchEntradas = async (overrideIdTienda = null, overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      const filtersToUse = overrideFilters || filters;
      
      const hasActiveFilters = Object.entries(filtersToUse).some(([key, value]) => {
        if (key === 'id_tienda' && value === user?.id_tienda?.toString()) {
          return false;
        }
        return value !== '' && value !== null && value !== undefined;
      });
      
      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;
      
      const apiFilters = { ...filtersToUse };
      
      if (overrideIdTienda !== null) {
        apiFilters.id_tienda = overrideIdTienda;
      }
      
      const data = await getEntradas(apiFilters, fetchPage, fetchLimit);
      let entradas = data.data || [];

      setEntradas(entradas);
      setPagination(data.pagination || pagination);
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
    fetchEntradas();
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      nombre_servicio: '', 
      codigo_lote: '', 
      fecha_desde: '', 
      fecha_hasta: '', 
      id_tienda: (!canViewAllEntradas && user?.id_tienda) ? user.id_tienda.toString() : '',
      id_usuario: '',
      cantidad_restante_min: '0.01',
      cantidad_restante_max: ''
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchEntradas(null, clearedFilters);
  };

  const handleDelete = (entrada: any) => {
    showConfirmDialog({
      title: 'Eliminar Entrada',
      message: `¿Estás seguro de que quieres eliminar la entrada "${entrada.codigo_lote}"?`,
      onConfirm: () => {
        deleteEntrada(entrada.id_entrada)
          .then(() => {
            showToast({ type: 'success', message: 'Entrada eliminada correctamente' });
            fetchEntradas();
          })
          .catch((err: any) => {
            showToast({ type: 'error', message: err.message, code: err.code });
          });
      },
      type: 'danger'
    });
  };

  const handleEntradaPress = (entrada: any) => {
    // Save current filters before navigating
    localStorage.setItem('entradas_filters', JSON.stringify(filters));
    
    // Open in edit mode if user has permissions, otherwise open in view mode
    const openMode = canManageEntradas ? 'edit' : 'view';
    router.push(`/entradas/form/${entrada.id_entrada}?mode=${openMode}`);
  };

  const handleEdit = (entrada: any, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('entradas_filters', JSON.stringify(filters));
    router.push(`/entradas/form/${entrada.id_entrada}?mode=edit`);
  };

  const handleAdd = () => {
    localStorage.setItem('entradas_filters', JSON.stringify(filters));
    router.push(`/entradas/form?mode=add`);
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

  const handleExport = async () => {
    try {
      setShowFieldSelectionModal(false);
      setIsExporting(true);
      
      const apiFilters = { ...filters };
      const data = await getEntradas(apiFilters, 1, 10000);
      let allEntradas = data.data || [];

      if (exportType === 'excel') {
        await exportToExcel(allEntradas);
      } else if (exportType === 'pdf') {
        await exportToPDF(allEntradas);
      }
    } catch (error: any) {
      showToast({ type: 'error', message: 'Error al exportar: ' + error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const sanitizeFileName = (fileName: string) => {
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
  };

  const exportToExcel = async (entradas: any[]) => {
    try {
      const data = entradas.map(entrada => {
        const row: any = {};
        if (selectedFields.producto) row['Nombre'] = entrada.servicioTienda?.servicio?.nombre || 'N/A';
        if (selectedFields.tienda) row['Tienda'] = entrada.servicioTienda?.tienda?.nombre || 'N/A';
        if (selectedFields.cantidad) row['Cantidad'] = entrada.cantidad_entrada;
        if (canManageEntradas && selectedFields.costo_cup) row['Costo CUP'] = entrada.costo_cup;
        if (canManageEntradas && selectedFields.costo_usd) row['Costo USD'] = entrada.costo_usd;
        if (selectedFields.fecha) row['Fecha'] = new Date(entrada.fecha).toLocaleDateString();
        if (selectedFields.codigo_lote) row['Código Lote'] = entrada.codigo_lote;
        if (selectedFields.fecha_vencimiento) row['Fecha Vencimiento'] = entrada.fecha_vencimiento ? new Date(entrada.fecha_vencimiento).toLocaleDateString() : 'N/A';
        if (selectedFields.proveedor) row['Proveedor'] = entrada.nombre_proveedor || 'N/A';
        if (selectedFields.usuario) row['Usuario'] = entrada.usuario?.nombre_natural || 'N/A';
        return row;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Entradas');

      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = sanitizeFileName(`Historial_Entradas_${formattedDate}.xlsx`);
      
      XLSX.writeFile(wb, fileName);
      showToast({ type: 'success', message: 'Archivo Excel descargado correctamente' });
    } catch (error) {
      throw error;
    }
  };

  const exportToPDF = async (entradas: any[]) => {
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.setTextColor(0, 36, 64);
      doc.text('Historial de Entradas', 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setTextColor(11, 28, 48);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });

      // Prepare table headers based on selected fields
      const headers: string[] = [];
      if (selectedFields.producto) headers.push('Nombre');
      if (selectedFields.tienda) headers.push('Tienda');
      if (selectedFields.cantidad) headers.push('Cantidad');
      if (canManageEntradas && selectedFields.costo_cup) headers.push('Costo CUP');
      if (canManageEntradas && selectedFields.costo_usd) headers.push('Costo USD');
      if (selectedFields.fecha) headers.push('Fecha');
      if (selectedFields.codigo_lote) headers.push('Código Lote');
      if (selectedFields.fecha_vencimiento) headers.push('Fecha Vencimiento');
      if (selectedFields.proveedor) headers.push('Proveedor');
      if (selectedFields.usuario) headers.push('Usuario');

      // Prepare table data
      const tableData = entradas.map(entrada => {
        const row: any[] = [];
        if (selectedFields.producto) row.push(entrada.servicioTienda?.servicio?.nombre || 'N/A');
        if (selectedFields.tienda) row.push(entrada.servicioTienda?.tienda?.nombre || 'N/A');
        if (selectedFields.cantidad) row.push(entrada.cantidad_entrada);
        if (canManageEntradas && selectedFields.costo_cup) row.push(entrada.costo_cup);
        if (canManageEntradas && selectedFields.costo_usd) row.push(entrada.costo_usd);
        if (selectedFields.fecha) row.push(new Date(entrada.fecha).toLocaleDateString());
        if (selectedFields.codigo_lote) row.push(entrada.codigo_lote);
        if (selectedFields.fecha_vencimiento) row.push(entrada.fecha_vencimiento ? new Date(entrada.fecha_vencimiento).toLocaleDateString() : 'N/A');
        if (selectedFields.proveedor) row.push(entrada.nombre_proveedor || 'N/A');
        if (selectedFields.usuario) row.push(entrada.usuario?.nombre_natural || 'N/A');
        return row;
      });

      // Generate table
      (doc as any).autoTable({
        head: [headers],
        body: tableData,
        startY: 40,
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [0, 36, 64],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 249, 255],
        },
      });

      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = sanitizeFileName(`Historial_Entradas_${formattedDate}.pdf`);
      
      doc.save(fileName);
      showToast({ type: 'success', message: 'Archivo PDF descargado correctamente' });
    } catch (error) {
      throw error;
    }
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const filteredUsers = users.filter(userItem =>
    userItem.nombre_natural?.toLowerCase().includes(userSearchText.toLowerCase())
  );

  const getCantidadStatus = (entrada: any) => {
    const cantidadTotal = parseFloat(entrada.cantidad_entrada) || 0;
    const cantidadActual = parseFloat(entrada.cantidad_restante) || 0;
    
    if (cantidadActual === cantidadTotal) {
      return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', label: 'Completo' };
    } else if (cantidadActual === 0) {
      return { color: '#F44336', bgColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#FFEBEE', borderColor: '#F44336', label: 'Agotado' };
    } else {
      return { color: '#FF9800', bgColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', borderColor: '#FF9800', label: 'Parcial' };
    }
  };

  // Restore filters on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && isFirstFocus.current) {
      isFirstFocus.current = false;
      const savedFilters = localStorage.getItem('entradas_filters');
      if (savedFilters) {
        try {
          const parsedFilters = JSON.parse(savedFilters);
          setFilters(parsedFilters);
          fetchEntradas(null, parsedFilters);
        } catch (error) {
          console.error('Error restoring filters:', error);
        }
      }
    }
  }, []);

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
      
      {/* ConfirmDialog is now global via GlobalConfirmDialog in layout */}
      <SidebarNavigation 
        ref={sidebarNavRef}
        currentRoute="entradas"
      />

      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          onMenuPress={handleMenuPress}
          onThemePress={toggleTheme}
          onSettingsPress={undefined}
          onNotificationsPress={() => {}}
          onProfilePress={() => router.push('/profile')}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="entradas"
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
                  Gestión de Entradas
                </h1>
              </div>

              {/* Filter Section - Horizontal */}
              <div 
                className="rounded-2xl p-4 mb-4 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Nombre del Producto */}
                  <div className="flex-1 min-w-[200px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Nombre del Producto
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Buscar por nombre..."
                      value={filters.nombre_servicio}
                      onChange={(e) => setFilters(prev => ({ ...prev, nombre_servicio: e.target.value }))}
                    />
                  </div>

                  {/* Tienda */}
                  <div className="flex-1 min-w-[200px] relative">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Tienda
                    </label>
                    <button
                      className="w-full rounded-lg px-3 py-2 border flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: filters.id_tienda ? colors.onSurface : colors.outline,
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      onClick={() => {
                        if (canViewAllEntradas) {
                          setShowTiendaDropdown(!showTiendaDropdown);
                          if (!hasLoadedAllTiendas && !isLoadingTiendas) {
                            fetchAllTiendas();
                          }
                        }
                      }}
                    >
                      <span className="truncate">
                        {tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas'}
                      </span>
                      {showTiendaDropdown ? (
                        <ChevronUp size={16} style={{ color: colors.outline }} />
                      ) : (
                        <ChevronDown size={16} style={{ color: colors.outline }} />
                      )}
                    </button>
                    
                    {showTiendaDropdown && (
                      <div 
                        className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden max-h-60 overflow-y-auto"
                        style={{ 
                          backgroundColor: colors.surface, 
                          borderColor: colors.outlineVariant
                        }}
                      >
                        {isLoadingTiendas ? (
                          <div className="flex items-center justify-center py-4 gap-2">
                            <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                            <span style={{ color: colors.outline, fontSize: '14px' }}>Cargando...</span>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border-b"
                              style={{ 
                                backgroundColor: colors.background, 
                                color: colors.onSurface, 
                                borderColor: colors.outlineVariant,
                                fontFamily: 'Inter, sans-serif'
                              }}
                              placeholder="Buscar tienda..."
                              value={tiendaSearchText}
                              onChange={(e) => setTiendaSearchText(e.target.value)}
                            />
                            {canViewAllEntradas && (
                              <button
                                className="w-full px-3 py-2 text-left border-b hover:bg-black/5 transition-colors"
                                style={{ 
                                  color: colors.onSurface,
                                  borderColor: 'rgba(0,0,0,0.05)',
                                  fontFamily: 'Inter, sans-serif'
                                }}
                                onClick={() => {
                                  setFilters(prev => ({ ...prev, id_tienda: '' }));
                                  setShowTiendaDropdown(false);
                                  setTiendaSearchText('');
                                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                                  fetchEntradas('');
                                }}
                              >
                                Todas
                              </button>
                            )}
                            {filteredTiendas.map((tienda) => (
                              <button
                                key={tienda.id_tienda}
                                className="w-full px-3 py-2 text-left hover:bg-black/5 transition-colors"
                                style={{ 
                                  color: colors.onSurface,
                                  fontFamily: 'Inter, sans-serif'
                                }}
                                onClick={() => {
                                  const newIdTienda = tienda.id_tienda.toString();
                                  setFilters(prev => ({ ...prev, id_tienda: newIdTienda }));
                                  setShowTiendaDropdown(false);
                                  setTiendaSearchText('');
                                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                                  fetchEntradas(newIdTienda);
                                }}
                              >
                                {tienda.nombre}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Usuario */}
                  <div className="flex-1 min-w-[200px] relative">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Usuario
                    </label>
                    <button
                      className="w-full rounded-lg px-3 py-2 border flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: filters.id_usuario ? colors.onSurface : colors.outline,
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      onClick={() => {
                        if (canViewAllEntradas) {
                          setShowUserDropdown(!showUserDropdown);
                          if (!hasLoadedAllUsers && !isLoadingUsers) {
                            fetchAllUsers();
                          }
                        }
                      }}
                    >
                      <span className="truncate">
                        {users.find(u => u.id_usuario === parseInt(filters.id_usuario))?.nombre_natural || 'Todos'}
                      </span>
                      {showUserDropdown ? (
                        <ChevronUp size={16} style={{ color: colors.outline }} />
                      ) : (
                        <ChevronDown size={16} style={{ color: colors.outline }} />
                      )}
                    </button>
                    
                    {showUserDropdown && (
                      <div 
                        className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden max-h-60 overflow-y-auto"
                        style={{ 
                          backgroundColor: colors.surface, 
                          borderColor: colors.outlineVariant
                        }}
                      >
                        {isLoadingUsers ? (
                          <div className="flex items-center justify-center py-4 gap-2">
                            <div className="w-5 h-5 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                            <span style={{ color: colors.outline, fontSize: '14px' }}>Cargando...</span>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              className="w-full px-3 py-2 border-b"
                              style={{ 
                                backgroundColor: colors.background, 
                                color: colors.onSurface, 
                                borderColor: colors.outlineVariant,
                                fontFamily: 'Inter, sans-serif'
                              }}
                              placeholder="Buscar usuario..."
                              value={userSearchText}
                              onChange={(e) => setUserSearchText(e.target.value)}
                            />
                            <button
                              className="w-full px-3 py-2 text-left border-b hover:bg-black/5 transition-colors"
                              style={{ 
                                color: colors.onSurface,
                                borderColor: 'rgba(0,0,0,0.05)',
                                fontFamily: 'Inter, sans-serif'
                              }}
                              onClick={() => {
                                setFilters(prev => ({ ...prev, id_usuario: '' }));
                                setShowUserDropdown(false);
                                setUserSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchEntradas();
                              }}
                            >
                              Todos
                            </button>
                            {filteredUsers.map((userItem) => (
                              <button
                                key={userItem.id_usuario}
                                className="w-full px-3 py-2 text-left hover:bg-black/5 transition-colors"
                                style={{ 
                                  color: colors.onSurface,
                                  fontFamily: 'Inter, sans-serif'
                                }}
                                onClick={() => {
                                  setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
                                  setShowUserDropdown(false);
                                  setUserSearchText('');
                                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                                  fetchEntradas();
                                }}
                              >
                                {userItem.nombre_natural}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Código de Lote */}
                  <div className="flex-1 min-w-[150px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Código de Lote
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-3 py-2 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant,
                        fontFamily: 'Inter, sans-serif'
                      }}
                      placeholder="Código..."
                      value={filters.codigo_lote}
                      onChange={(e) => setFilters(prev => ({ ...prev, codigo_lote: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons - Outside filter card, smaller, side by side */}
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
                  disabled={isSearching}
                >
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                  ) : (
                    <>
                      <Search size={16} />
                      <span>Buscar</span>
                    </>
                  )}
                </button>
                {canManageEntradas && (
                  <button
                    className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleAdd}
                  >
                    <Plus size={16} />
                    <span>Agregar Entrada</span>
                  </button>
                )}
                <button
                  className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  onClick={() => setShowExportModal(true)}
                >
                  <Download size={16} />
                  <span>Exportar Datos</span>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Mobile/Tablet Layout - Original */}
              {/* Page Title */}
              <div className="text-center mb-6 mt-4">
                <h1 
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                >
                  Gestión de Entradas
                </h1>
              </div>

              {/* Filter Section - Wrapped to maintain compact width */}
              <div style={{ maxWidth: '56rem', margin: '0 auto' }}>
              <div 
                className="rounded-2xl p-5 mb-6 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold" style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}>
                    Filtros
                  </h2>
                  <button
                    className="w-10 h-10 rounded-lg flex items-center justify-center border-2"
                    style={{ 
                      backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                      borderColor: colors.primary
                    }}
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  >
                    {showAdvancedFilters ? (
                      <ChevronUp size={24} color={isDarkMode ? colors.primary : '#1976D2'} />
                    ) : (
                      <ChevronDown size={24} color={isDarkMode ? colors.primary : '#1976D2'} />
                    )}
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Nombre del Producto
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-3 text-sm"
                    style={{ 
                      backgroundColor: colors.background, 
                      color: colors.onSurface, 
                      borderColor: colors.outlineVariant 
                    }}
                    placeholder="Buscar por nombre..."
                    value={filters.nombre_servicio}
                    onChange={(e) => setFilters(prev => ({ ...prev, nombre_servicio: e.target.value }))}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                    Tienda
                  </label>
                  <div className="relative">
                    <button
                      className="w-full border rounded-lg p-3 flex justify-between items-center"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant 
                      }}
                      onClick={() => {
                        if (canViewAllEntradas) {
                          setShowTiendaDropdown(!showTiendaDropdown);
                          if (!hasLoadedAllTiendas && !isLoadingTiendas) {
                            fetchAllTiendas();
                          }
                        }
                      }}
                    >
                      <span className="text-sm" style={{ color: filters.id_tienda ? colors.onSurface : colors.outline }}>
                        {tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}
                      </span>
                      {showTiendaDropdown ? (
                        <ChevronUp size={20} color={colors.outline} />
                      ) : (
                        <ChevronDown size={20} color={colors.outline} />
                      )}
                    </button>
                    
                    {showTiendaDropdown && (
                      <div 
                        className="absolute z-10 w-full border rounded-lg mt-1 max-h-48 overflow-auto"
                        style={{ 
                          backgroundColor: colors.surface, 
                          borderColor: colors.outlineVariant 
                        }}
                      >
                        {isLoadingTiendas ? (
                          <div className="flex items-center justify-center py-4 gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: colors.primary }}></div>
                            <span className="text-sm" style={{ color: colors.outline }}>Cargando tiendas...</span>
                          </div>
                        ) : (
                          <>
                            <div 
                              className="flex items-center border rounded-lg px-3 py-2 mb-1"
                              style={{ 
                                backgroundColor: colors.background, 
                                borderColor: colors.outlineVariant 
                              }}
                            >
                              <Search size={18} color={colors.outline} className="mr-2" />
                              <input
                                type="text"
                                className="flex-1 text-sm bg-transparent outline-none"
                                style={{ color: colors.onSurface }}
                                placeholder="Buscar tienda..."
                                value={tiendaSearchText}
                                onChange={(e) => setTiendaSearchText(e.target.value)}
                              />
                            </div>
                            {canViewAllEntradas && (
                              <button
                                className="w-full text-left px-3 py-3 border-b"
                                style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}
                                onClick={() => {
                                  setFilters(prev => ({ ...prev, id_tienda: '' }));
                                  setShowTiendaDropdown(false);
                                  setTiendaSearchText('');
                                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                                  fetchEntradas('');
                                }}
                              >
                                <span className="text-sm" style={{ color: colors.onSurface }}>Todas las tiendas</span>
                              </button>
                            )}
                            {filteredTiendas.length > 0 ? (
                              filteredTiendas.map((tienda, index) => (
                                <button
                                  key={tienda.id_tienda}
                                  className="w-full text-left px-3 py-3 border-b last:border-b-0"
                                  style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}
                                  onClick={() => {
                                    const newIdTienda = tienda.id_tienda.toString();
                                    setFilters(prev => ({ ...prev, id_tienda: newIdTienda }));
                                    setShowTiendaDropdown(false);
                                    setTiendaSearchText('');
                                    setPagination(prev => ({ ...prev, currentPage: 1 }));
                                    fetchEntradas(newIdTienda);
                                  }}
                                >
                                  <span className="text-sm" style={{ color: colors.onSurface }}>{tienda.nombre}</span>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-3">
                                <span className="text-sm" style={{ color: colors.outline }}>No se encontraron tiendas</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {showAdvancedFilters && (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                        Usuario
                      </label>
                      <div className="relative">
                        <button
                          className="w-full border rounded-lg p-3 flex justify-between items-center"
                          style={{ 
                            backgroundColor: colors.background, 
                            borderColor: colors.outlineVariant 
                          }}
                          onClick={() => {
                            if (canViewAllEntradas) {
                              setShowUserDropdown(!showUserDropdown);
                              if (!hasLoadedAllUsers && !isLoadingUsers) {
                                fetchAllUsers();
                              }
                            }
                          }}
                        >
                          <span className="text-sm" style={{ color: filters.id_usuario ? colors.onSurface : colors.outline }}>
                            {users.find(u => u.id_usuario === parseInt(filters.id_usuario))?.nombre_natural || 'Todos los usuarios'}
                          </span>
                          {showUserDropdown ? (
                            <ChevronUp size={20} color={colors.outline} />
                          ) : (
                            <ChevronDown size={20} color={colors.outline} />
                          )}
                        </button>
                        
                        {showUserDropdown && (
                          <div 
                            className="absolute z-10 w-full border rounded-lg mt-1 max-h-48 overflow-auto"
                            style={{ 
                              backgroundColor: colors.surface, 
                              borderColor: colors.outlineVariant 
                            }}
                          >
                            {isLoadingUsers ? (
                              <div className="flex items-center justify-center py-4 gap-2">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: colors.primary }}></div>
                                <span className="text-sm" style={{ color: colors.outline }}>Cargando usuarios...</span>
                              </div>
                            ) : (
                              <>
                                <div 
                                  className="flex items-center border rounded-lg px-3 py-2 mb-1"
                                  style={{ 
                                    backgroundColor: colors.background, 
                                    borderColor: colors.outlineVariant 
                                  }}
                                >
                                  <Search size={18} color={colors.outline} className="mr-2" />
                                  <input
                                    type="text"
                                    className="flex-1 text-sm bg-transparent outline-none"
                                    style={{ color: colors.onSurface }}
                                    placeholder="Buscar usuario..."
                                    value={userSearchText}
                                    onChange={(e) => setUserSearchText(e.target.value)}
                                  />
                                </div>
                                <button
                                  className="w-full text-left px-3 py-3 border-b"
                                  style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}
                                  onClick={() => {
                                    setFilters(prev => ({ ...prev, id_usuario: '' }));
                                    setShowUserDropdown(false);
                                    setUserSearchText('');
                                    setPagination(prev => ({ ...prev, currentPage: 1 }));
                                    fetchEntradas();
                                  }}
                                >
                                  <span className="text-sm" style={{ color: colors.onSurface }}>Todos los usuarios</span>
                                </button>
                                {filteredUsers.length > 0 ? (
                                  filteredUsers.map((userItem, index) => (
                                    <button
                                      key={userItem.id_usuario}
                                      className="w-full text-left px-3 py-3 border-b last:border-b-0"
                                      style={{ borderColor: 'rgba(0, 0, 0, 0.05)' }}
                                      onClick={() => {
                                        setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
                                        setShowUserDropdown(false);
                                        setUserSearchText('');
                                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                                        fetchEntradas();
                                      }}
                                    >
                                      <span className="text-sm" style={{ color: colors.onSurface }}>{userItem.nombre_natural}</span>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-3">
                                    <span className="text-sm" style={{ color: colors.outline }}>No se encontraron usuarios</span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                        Código de Lote
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg p-3 text-sm"
                        style={{ 
                          backgroundColor: colors.background, 
                          color: colors.onSurface, 
                          borderColor: colors.outlineVariant 
                        }}
                        placeholder="Buscar por código de lote..."
                        value={filters.codigo_lote}
                        onChange={(e) => setFilters(prev => ({ ...prev, codigo_lote: e.target.value }))}
                      />
                    </div>

                    <div className="flex gap-2 mb-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Cant.Restante Mínima
                        </label>
                        <input
                          type="number"
                          className="w-full border rounded-lg p-3 text-sm"
                          style={{ 
                            backgroundColor: colors.background, 
                            color: colors.onSurface, 
                            borderColor: colors.outlineVariant 
                          }}
                          placeholder="Cantidad mínima..."
                          value={filters.cantidad_restante_min}
                          onChange={(e) => setFilters(prev => ({ ...prev, cantidad_restante_min: e.target.value }))}
                        />
                      </div>

                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Cant.Restante Máxima
                        </label>
                        <input
                          type="number"
                          className="w-full border rounded-lg p-3 text-sm"
                          style={{ 
                            backgroundColor: colors.background, 
                            color: colors.onSurface, 
                            borderColor: colors.outlineVariant 
                          }}
                          placeholder="Cantidad máxima..."
                          value={filters.cantidad_restante_max}
                          onChange={(e) => setFilters(prev => ({ ...prev, cantidad_restante_max: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Fecha Desde
                        </label>
                        <input
                          type="date"
                          className="w-full border rounded-lg p-3 text-sm"
                          style={{ 
                            backgroundColor: colors.background, 
                            color: colors.onSurface, 
                            borderColor: colors.outlineVariant 
                          }}
                          value={filters.fecha_desde}
                          onChange={(e) => setFilters(prev => ({ ...prev, fecha_desde: e.target.value }))}
                        />
                      </div>

                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Fecha Hasta
                        </label>
                        <input
                          type="date"
                          className="w-full border rounded-lg p-3 text-sm"
                          style={{ 
                            backgroundColor: colors.background, 
                            color: colors.onSurface, 
                            borderColor: colors.outlineVariant 
                          }}
                          value={filters.fecha_hasta}
                          onChange={(e) => setFilters(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border"
                    style={{ 
                      backgroundColor: colors.surface, 
                      borderColor: colors.outlineVariant 
                    }}
                    onClick={handleClearFilters}
                  >
                    <RefreshCw size={18} color={colors.onSurface} />
                    <span className="text-sm font-medium" style={{ color: colors.onSurface }}>Limpiar</span>
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg"
                    style={{ 
                      backgroundColor: colors.primary,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onClick={handleSearch}
                    disabled={isSearching}
                  >
                    {isSearching ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Search size={18} color="#fff" />
                        <span className="text-sm font-medium" style={{ color: '#fff' }}>Buscar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mb-6">
                {canManageEntradas && (
                  <button
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl"
                    style={{ 
                      backgroundColor: colors.primary,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    onClick={handleAdd}
                  >
                    <Plus size={20} color="#fff" />
                    <span className="text-sm font-medium" style={{ color: '#fff' }}>Agregar Entrada</span>
                  </button>
                )}
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl"
                  style={{ 
                    backgroundColor: colors.primary,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onClick={() => setShowExportModal(true)}
                >
                  <Download size={20} color="#fff" />
                  <span className="text-sm font-medium" style={{ color: '#fff' }}>Exportar Datos</span>
                </button>
              </div>
              </div>
            </>
          )}

        {/* Entradas List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.primary }}></div>
            <span className="mt-4 text-base" style={{ color: colors.outline }}>
              Cargando entradas...
            </span>
          </div>
        ) : error ? (
          <div 
            className="rounded-2xl p-6 flex flex-col items-center"
            style={{ backgroundColor: colors.surface }}
          >
            <AlertCircle size={40} color={colors.error} />
            <span className="mt-4 mb-4 text-base text-center" style={{ color: colors.onSurface }}>
              {error}
            </span>
            <button
              className="px-6 py-3 rounded-lg"
              style={{ backgroundColor: colors.primary }}
              onClick={() => fetchEntradas()}
            >
              <span className="text-base font-medium" style={{ color: '#fff' }}>Reintentar</span>
            </button>
          </div>
        ) : entradas.length === 0 ? (
          <div 
            className="rounded-2xl p-10 flex flex-col items-center"
            style={{ backgroundColor: colors.surface }}
          >
            <Box size={60} color={colors.outline} />
            <span className="mt-4 text-base" style={{ color: colors.outline }}>
              No se encontraron entradas
            </span>
          </div>
        ) : (
          <>
            {viewMode === 'card' ? (
              entradas.map((entrada) => {
                return (
                  <div
                    key={entrada.id_entrada}
                    className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] mb-3"
                    style={{ backgroundColor: colors.surface }}
                    onClick={() => handleEntradaPress(entrada)}
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
                            {entrada.servicioTienda?.servicio?.nombre || 'N/A'}
                          </h3>
                          <div 
                            className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                            style={{ 
                              backgroundColor: getCantidadStatus(entrada).bgColor,
                              color: getCantidadStatus(entrada).color,
                              fontFamily: 'Inter, sans-serif'
                            }}
                          >
                            {getCantidadStatus(entrada).label}
                          </div>
                        </div>
                        <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                          Código Lote: {entrada.codigo_lote}
                        </p>
                        <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                          Tienda: {entrada.servicioTienda?.tienda?.nombre || 'N/A'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-semibold" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                            Inicial: {entrada.cantidad_entrada}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                            | Actual: {entrada.cantidad_restante || 0}
                          </span>
                        </div>
                        {canManageEntradas && (
                          <p className="text-sm font-semibold" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                            Total CUP: ${(parseFloat(entrada.costo_cup) * parseFloat(entrada.cantidad_entrada)).toFixed(2)} | Total USD: ${(parseFloat(entrada.costo_usd) * parseFloat(entrada.cantidad_entrada)).toFixed(2)}
                          </p>
                        )}
                        <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                          Fecha: {new Date(entrada.fecha).toLocaleDateString()}
                        </p>
                      </div>
                      {canManageEntradas && (
                        <div className="flex gap-2 ml-3">
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                            onClick={(e) => handleEdit(entrada, e)}
                          >
                            <Edit size={22} style={{ color: colors.primary }} />
                          </button>
                          <button
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(entrada);
                            }}
                          >
                            <Trash2 size={22} style={{ color: colors.error }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="overflow-x-auto rounded-2xl shadow-lg">
                <table className="w-full" style={{ backgroundColor: colors.surface }}>
                  <thead>
                    <tr style={{ backgroundColor: colors.primary }}>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '200px' }}>Producto</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Código Lote</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Tienda</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Proveedor</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '80px' }}>Inicial</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '80px' }}>Actual</th>
                      {canManageEntradas && (
                        <>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Total CUP</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Total USD</th>
                        </>
                      )}
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Fecha</th>
                      {canManageEntradas && (
                        <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {entradas.map((entrada, index) => {
                      const cantidadActual = entrada.cantidad_restante || 0;
                      const cantidadInicial = entrada.cantidad_entrada;
                      let actualColor = colors.onSurface;
                      if (cantidadActual === 0) {
                        actualColor = '#F44336';
                      } else if (cantidadActual === cantidadInicial) {
                        actualColor = '#4CAF50';
                      } else {
                        actualColor = '#FF9800';
                      }
                      return (
                        <tr
                          key={entrada.id_entrada}
                          className="cursor-pointer hover:bg-black/5 transition-colors"
                          style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }}
                          onClick={() => handleEntradaPress(entrada)}
                        >
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {entrada.servicioTienda?.servicio?.nombre || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {entrada.codigo_lote}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {entrada.servicioTienda?.tienda?.nombre || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {entrada.nombre_proveedor || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {entrada.cantidad_entrada}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium" style={{ color: actualColor }}>
                            {cantidadActual}
                          </td>
                          {canManageEntradas && (
                            <>
                              <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                ${(parseFloat(entrada.costo_cup) * parseFloat(entrada.cantidad_entrada)).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                ${(parseFloat(entrada.costo_usd) * parseFloat(entrada.cantidad_entrada)).toFixed(2)}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                            {new Date(entrada.fecha).toLocaleDateString()}
                          </td>
                          {canManageEntradas && (
                            <td className="px-4 py-3 text-sm">
                              <div className="flex gap-2">
                                <button
                                  className="w-8 h-8 rounded flex items-center justify-center transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={(e) => handleEdit(entrada, e)}
                                >
                                  <Edit size={16} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="w-8 h-8 rounded flex items-center justify-center transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(entrada);
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

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6 mb-6">
                <button
                  className="w-10 h-10 rounded-lg flex items-center justify-center border"
                  style={{ 
                    backgroundColor: colors.surface,
                    opacity: pagination.currentPage === 1 ? 0.5 : 1
                  }}
                  onClick={handlePrevPage}
                  disabled={pagination.currentPage === 1}
                >
                  <ChevronLeft size={20} color={colors.onSurface} />
                </button>
                <div className="text-center">
                  <span className="text-base" style={{ color: colors.onSurface }}>
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </span>
                  <br />
                  <span className="text-xs" style={{ color: colors.outline }}>
                    Total de entradas: {pagination.totalItems}
                  </span>
                </div>
                <button
                  className="w-10 h-10 rounded-lg flex items-center justify-center border"
                  style={{ 
                    backgroundColor: colors.surface,
                    opacity: pagination.currentPage === pagination.totalPages ? 0.5 : 1
                  }}
                  onClick={handleNextPage}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <ChevronRight size={20} color={colors.onSurface} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowExportModal(false)}
        >
          <div 
            className="rounded-2xl p-6 w-4/5 max-w-md shadow-lg"
            style={{ 
              backgroundColor: colors.surface,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 
              className="text-xl font-bold mb-5 text-center"
              style={{ 
                color: colors.onSurface,
                fontFamily: 'Hanken Grotesk, sans-serif'
              }}
            >
              Exportar Datos
            </h2>
            <button
              className="flex items-center gap-3 p-4 rounded-xl mb-3 w-full"
              style={{ backgroundColor: colors.surfaceVariant }}
              onClick={() => {
                setShowExportModal(false);
                setExportType('excel');
                setShowFieldSelectionModal(true);
              }}
              disabled={isExporting}
            >
              <File size={24} color={colors.primary} />
              <span className="text-base font-medium" style={{ color: colors.onSurface }}>Entradas en Excel</span>
            </button>
            <button
              className="flex items-center gap-3 p-4 rounded-xl mb-3 w-full"
              style={{ backgroundColor: colors.surfaceVariant }}
              onClick={() => {
                setShowExportModal(false);
                setExportType('pdf');
                setShowFieldSelectionModal(true);
              }}
              disabled={isExporting}
            >
              <FileText size={24} color={colors.primary} />
              <span className="text-base font-medium" style={{ color: colors.onSurface }}>Entradas en PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Field Selection Modal */}
      {showFieldSelectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] overflow-y-auto relative"
            style={{ backgroundColor: colors.surface }}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowFieldSelectionModal(false)}
            >
              <X size={24} style={{ color: colors.outline }} />
            </button>
            <h2 
              className="text-xl font-bold mb-4"
              style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
            >
              Seleccionar Campos
            </h2>
            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.producto}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, producto: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Nombre</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.tienda}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, tienda: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Tienda</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.cantidad}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, cantidad: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Cantidad</span>
              </label>
              {canManageEntradas && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFields.costo_cup}
                      onChange={(e) => setSelectedFields(prev => ({ ...prev, costo_cup: e.target.checked }))}
                      className="w-5 h-5"
                    />
                    <span style={{ color: colors.onSurface }}>Costo CUP</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFields.costo_usd}
                      onChange={(e) => setSelectedFields(prev => ({ ...prev, costo_usd: e.target.checked }))}
                      className="w-5 h-5"
                    />
                    <span style={{ color: colors.onSurface }}>Costo USD</span>
                  </label>
                </>
              )}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.fecha}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, fecha: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Fecha</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.codigo_lote}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, codigo_lote: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Código Lote</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.fecha_vencimiento}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, fecha_vencimiento: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Fecha Vencimiento</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.proveedor}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, proveedor: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Proveedor</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedFields.usuario}
                  onChange={(e) => setSelectedFields(prev => ({ ...prev, usuario: e.target.checked }))}
                  className="w-5 h-5"
                />
                <span style={{ color: colors.onSurface }}>Usuario</span>
              </label>
            </div>
            <button
              className="w-full rounded-lg px-4 py-3 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleExport}
            >
              Generar Exportación
            </button>
          </div>
        </div>
      )}

      {/* Export Loading Modal */}
      {isExporting && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div 
            className="rounded-2xl p-8 w-5/6 max-w-sm flex flex-col items-center shadow-lg"
            style={{ 
              backgroundColor: colors.surface,
              boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
            }}
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.primary }}></div>
            <span 
              className="text-lg font-semibold mt-4 text-center"
              style={{ 
                color: colors.onSurface,
                fontFamily: 'Hanken Grotesk, sans-serif'
              }}
            >
              Generando documento...
            </span>
            <span className="text-base mt-2 text-center" style={{ color: colors.onSurfaceVariant }}>
              Por favor espere, esto puede tomar unos segundos
            </span>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

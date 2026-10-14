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
import { getSalidas, deleteSalida } from '../../services/salidaService';
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
  File as FileIcon,
  FileText
} from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import * as XLSX from 'xlsx';

export default function SalidasPage() {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { showConfirmDialog, hideConfirmDialog } = useConfirmDialog();
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
  const [salidas, setSalidas] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [userTiendaReady, setUserTiendaReady] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isFirstFocus = useRef(true);
  const isInitializedRef = useRef(false);

  // Filter states
  const [filters, setFilters] = useState({ 
    tipo_salida: '', 
    descripcion: '', 
    fecha_desde: '', 
    fecha_hasta: '', 
    id_tienda: '', 
    id_usuario: '' 
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
    tipo_salida: false,
    descripcion: false,
    usuario: false
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const permissions = user?.permissions || {};

  const canViewAllSalidas = 
    isAdmin ||
    (user?.rol?.toLowerCase() === 'dependiente' && permissions?.dependiente) ||
    (user?.rol?.toLowerCase() === 'almacenero' && permissions?.almacenero) ||
    (user?.rol?.toLowerCase() === 'económico' && permissions?.economico);

  const canManageSalidas = 
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
      fetchSalidas();
      hasDoneInitialFetch.current = true;
    }
  }, [userTiendaReady]);

  // Fetch on pagination changes after initial load
  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchSalidas();
    }
  }, [pagination.currentPage]);

  const fetchAllTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      const userRole = user?.rol?.toLowerCase();
      const canViewAll = canViewAllSalidas;

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

  const fetchSalidas = async (overrideIdTienda = null, overrideFilters = null) => {
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
      
      const data = await getSalidas(apiFilters, fetchPage, fetchLimit);
      let salidas = data.data || [];

      setSalidas(salidas);
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
    fetchSalidas();
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      tipo_salida: '', 
      descripcion: '', 
      fecha_desde: '', 
      fecha_hasta: '', 
      id_tienda: (!canViewAllSalidas && user?.id_tienda) ? user.id_tienda.toString() : '',
      id_usuario: ''
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchSalidas(null, clearedFilters);
  };

  const handleDelete = (salida: any) => {
    showConfirmDialog({
      title: 'Eliminar Salida',
      message: `¿Estás seguro de que quieres eliminar esta salida?`,
      onConfirm: () => {
        hideConfirmDialog();
        deleteSalida(salida.id_salida)
          .then(() => {
            showToast({ type: 'success', message: 'Salida eliminada correctamente' });
            fetchSalidas();
          })
          .catch((err: any) => {
            showToast({ type: 'error', message: err.message, code: err.code });
          });
      },
      type: 'danger'
    });
  };

  const handleSalidaPress = (salida: any) => {
    // Save current filters before navigating
    localStorage.setItem('salidas_filters', JSON.stringify(filters));
    
    // Open in edit mode if user has permissions, otherwise open in view mode
    const openMode = canManageSalidas ? 'edit' : 'view';
    router.push(`/salidas/form/${salida.id_salida}?mode=${openMode}`);
  };

  const handleEdit = (salida: any, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('salidas_filters', JSON.stringify(filters));
    router.push(`/salidas/form/${salida.id_salida}?mode=edit`);
  };

  const handleAdd = () => {
    localStorage.setItem('salidas_filters', JSON.stringify(filters));
    router.push('/salidas/form/add?mode=add');
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
      const data = await getSalidas(apiFilters, 1, 10000);
      let allSalidas = data.data || [];

      if (exportType === 'excel') {
        await exportToExcel(allSalidas);
      } else if (exportType === 'pdf') {
        await exportToPDF(allSalidas);
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

  const exportToExcel = async (salidas: any[]) => {
    try {
      const data = salidas.map(salida => {
        const row: any = {};
        if (selectedFields.producto) row['Nombre'] = salida.servicioTienda?.servicio?.nombre || 'N/A';
        if (selectedFields.tienda) row['Tienda'] = salida.servicioTienda?.tienda?.nombre || 'N/A';
        if (selectedFields.cantidad) row['Cantidad'] = salida.cantidad_total;
        if (canManageSalidas && selectedFields.costo_cup) row['Costo CUP'] = salida.costo_cup;
        if (canManageSalidas && selectedFields.costo_usd) row['Costo USD'] = salida.costo_usd;
        if (selectedFields.fecha) row['Fecha'] = new Date(salida.fecha).toLocaleDateString();
        if (selectedFields.tipo_salida) row['Tipo Salida'] = salida.tipo_salida;
        if (selectedFields.descripcion) row['Descripción'] = salida.descripcion;
        if (selectedFields.usuario) row['Usuario'] = salida.usuario?.nombre_natural || 'N/A';
        return row;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Salidas');

      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = sanitizeFileName(`Historial_Salidas_${formattedDate}.xlsx`);
      
      XLSX.writeFile(wb, fileName);
      showToast({ type: 'success', message: 'Archivo Excel descargado correctamente' });
    } catch (error) {
      throw error;
    }
  };

  const exportToPDF = async (salidas: any[]) => {
    try {
      let tableRows = '';
      
      // Table header based on selected fields (matching APK style)
      let tableHeader = '<tr style="background-color: #f0f0f0;">';
      if (selectedFields.producto) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Nombre</th>';
      if (selectedFields.tienda) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Tienda</th>';
      if (selectedFields.cantidad) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Cantidad</th>';
      if (canManageSalidas && selectedFields.costo_cup) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo CUP</th>';
      if (canManageSalidas && selectedFields.costo_usd) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo USD</th>';
      if (selectedFields.fecha) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Fecha</th>';
      if (selectedFields.tipo_salida) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Tipo Salida</th>';
      if (selectedFields.descripcion) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Descripción</th>';
      if (selectedFields.usuario) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Usuario</th>';
      tableHeader += '</tr>';

      // Table rows based on selected fields
      salidas.forEach(salida => {
        tableRows += '<tr>';
        if (selectedFields.producto) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${salida.servicioTienda?.servicio?.nombre || 'N/A'}</td>`;
        if (selectedFields.tienda) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${salida.servicioTienda?.tienda?.nombre || 'N/A'}</td>`;
        if (selectedFields.cantidad) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${salida.cantidad_total}</td>`;
        if (canManageSalidas && selectedFields.costo_cup) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${salida.costo_cup}</td>`;
        if (canManageSalidas && selectedFields.costo_usd) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${salida.costo_usd}</td>`;
        if (selectedFields.fecha) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${new Date(salida.fecha).toLocaleDateString()}</td>`;
        if (selectedFields.tipo_salida) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${salida.tipo_salida}</td>`;
        if (selectedFields.descripcion) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${salida.descripcion}</td>`;
        if (selectedFields.usuario) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${salida.usuario?.nombre_natural || 'N/A'}</td>`;
        tableRows += '</tr>';
      });

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { text-align: center; color: #002440; margin-bottom: 10px; }
              p { text-align: center; color: #0b1c30; margin-bottom: 20px; }
              table { border-collapse: collapse; width: 100%; margin-top: 20px; }
              th { 
                background-color: #002440; 
                color: #ffffff; 
                border: 1px solid #002440; 
                padding: 12px 8px; 
                text-align: left; 
                font-weight: bold;
              }
              td { 
                border: 1px solid #d3e4fe; 
                padding: 8px; 
                text-align: left; 
                color: #0b1c30;
              }
              tr:nth-child(even) { background-color: #f8f9ff; }
              tr:nth-child(odd) { background-color: #ffffff; }
            </style>
          </head>
          <body>
            <h1>Historial de Salidas</h1>
            <p>Fecha: ${new Date().toLocaleDateString()}</p>
            <table>
              ${tableHeader}
              ${tableRows}
            </table>
          </body>
        </html>
      `;

      // Use html2pdf.js to generate PDF
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.createElement('div');
      element.innerHTML = htmlContent;
      document.body.appendChild(element);
      
      const opt = {
        margin: 10,
        filename: `Historial_Salidas_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);

      showToast({ type: 'success', message: 'PDF exportado correctamente' });
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

  // Restore filters on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && isFirstFocus.current) {
      isFirstFocus.current = false;
      const savedFilters = localStorage.getItem('salidas_filters');
      if (savedFilters) {
        try {
          const parsedFilters = JSON.parse(savedFilters);
          setFilters(parsedFilters);
          fetchSalidas(null, parsedFilters);
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

      <SidebarNavigation
        ref={sidebarNavRef}
        currentRoute="Salidas"
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
          currentRoute="salidas"
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
                  Gestión de Salidas
                </h1>
              </div>

              {/* Filter Section - Horizontal */}
              <div 
                className="rounded-2xl p-4 mb-4 shadow-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Tipo de Salida */}
                  <div className="flex-1 min-w-[200px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Tipo de Salida
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
                      placeholder="Tipo de salida..."
                      value={filters.tipo_salida}
                      onChange={(e) => setFilters(prev => ({ ...prev, tipo_salida: e.target.value }))}
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
                        if (canViewAllSalidas) {
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
                            {canViewAllSalidas && (
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
                                  fetchSalidas('');
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
                                  fetchSalidas(newIdTienda);
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

                  {/* Descripción */}
                  <div className="flex-1 min-w-[200px]">
                    <label 
                      className="block text-sm font-medium mb-2"
                      style={{ color: colors.outline }}
                    >
                      Descripción
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
                      placeholder="Descripción..."
                      value={filters.descripcion}
                      onChange={(e) => setFilters(prev => ({ ...prev, descripcion: e.target.value }))}
                    />
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
                        if (canViewAllSalidas) {
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
                                fetchSalidas();
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
                                  fetchSalidas();
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
                      onChange={(e) => setFilters(prev => ({ ...prev, fecha_desde: e.target.value }))}
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
                      onChange={(e) => setFilters(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
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
                {canManageSalidas && (
                  <button
                    className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleAdd}
                  >
                    <Plus size={16} />
                    <span>Agregar Salida</span>
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

              {/* Salidas List - Desktop */}
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.primary }}></div>
                  <span className="mt-4 text-base" style={{ color: colors.outline }}>
                    Cargando salidas...
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
                    onClick={() => fetchSalidas()}
                  >
                    <span className="text-base font-medium" style={{ color: '#fff' }}>Reintentar</span>
                  </button>
                </div>
              ) : salidas.length === 0 ? (
                <div 
                  className="rounded-2xl p-10 flex flex-col items-center"
                  style={{ backgroundColor: colors.surface }}
                >
                  <Box size={60} color={colors.outline} />
                  <span className="mt-4 text-base" style={{ color: colors.outline }}>
                    No se encontraron salidas
                  </span>
                </div>
              ) : (
                <>
                  {viewMode === 'card' ? (
                    salidas.map((salida) => {
                      return (
                        <div
                          key={salida.id_salida}
                          className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02] mb-3"
                          style={{ backgroundColor: colors.surface }}
                          onClick={() => handleSalidaPress(salida)}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1 min-w-0">
                              <h3 
                                className="font-semibold text-base truncate mb-1"
                                style={{ 
                                  color: colors.onSurface,
                                  fontFamily: 'Hanken Grotesk, sans-serif'
                                }}
                              >
                                {salida.servicioTienda?.servicio?.nombre || 'N/A'}
                              </h3>
                              <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                                Tipo: {salida.tipo_salida || 'N/A'}
                              </p>
                              <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                                Descripción: {salida.descripcion || '-'}
                              </p>
                              <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                                Tienda: {salida.servicioTienda?.tienda?.nombre || 'N/A'}
                              </p>
                              <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                                Usuario: {salida.usuario?.nombre_natural || 'N/A'}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-semibold" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                                  Cantidad: {salida.cantidad_total}
                                </span>
                              </div>
                              {canManageSalidas && (
                                <p className="text-sm font-semibold" style={{ color: colors.primary, fontFamily: 'Inter, sans-serif' }}>
                                  Total CUP: ${(parseFloat(salida.costo_cup || '0') * parseFloat(salida.cantidad_total || '0')).toFixed(2)} | Total USD: ${(parseFloat(salida.costo_usd || '0') * parseFloat(salida.cantidad_total || '0')).toFixed(2)}
                                </p>
                              )}
                              <p className="text-sm" style={{ color: colors.outline, fontFamily: 'Inter, sans-serif' }}>
                                Fecha: {new Date(salida.fecha).toLocaleDateString()}
                              </p>
                            </div>
                            {canManageSalidas && (
                              <div className="flex gap-2 ml-3">
                                <button
                                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                  onClick={(e) => handleEdit(salida, e)}
                                >
                                  <Edit size={22} style={{ color: colors.primary }} />
                                </button>
                                <button
                                  className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                  style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(salida);
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
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Tipo Salida</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Tienda</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '80px' }}>Cantidad</th>
                            {canManageSalidas && (
                              <>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Total CUP</th>
                                <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Total USD</th>
                              </>
                            )}
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Fecha</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '200px' }}>Descripción</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Usuario</th>
                            {canManageSalidas && (
                              <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Acciones</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {salidas.map((salida, index) => {
                            return (
                              <tr
                                key={salida.id_salida}
                                className="cursor-pointer hover:bg-black/5 transition-colors"
                                style={{ backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }}
                                onClick={() => handleSalidaPress(salida)}
                              >
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  {salida.servicioTienda?.servicio?.nombre || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  {salida.tipo_salida || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  {salida.servicioTienda?.tienda?.nombre || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  {salida.cantidad_total}
                                </td>
                                {canManageSalidas && (
                                  <>
                                    <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                      ${(parseFloat(salida.costo_cup || '0') * parseFloat(salida.cantidad_total || '0')).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                      ${(parseFloat(salida.costo_usd || '0') * parseFloat(salida.cantidad_total || '0')).toFixed(2)}
                                    </td>
                                  </>
                                )}
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  {new Date(salida.fecha).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  {salida.descripcion || '-'}
                                </td>
                                <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                                  {salida.usuario?.nombre_natural || 'N/A'}
                                </td>
                                {canManageSalidas && (
                                  <td className="px-4 py-3 text-sm">
                                    <div className="flex gap-2">
                                      <button
                                        className="w-8 h-8 rounded flex items-center justify-center transition-colors hover:opacity-80"
                                        style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                                        onClick={(e) => handleEdit(salida, e)}
                                      >
                                        <Edit size={16} style={{ color: colors.primary }} />
                                      </button>
                                      <button
                                        className="w-8 h-8 rounded flex items-center justify-center transition-colors hover:opacity-80"
                                        style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(salida);
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
                      Total de salidas: {pagination.totalItems}
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
          ) : (
            <>
              {/* Mobile/Tablet Layout */}
              <div className="text-center mb-6 mt-4">
                <h1 
                  className="text-2xl md:text-3xl font-bold"
                  style={{ color: colors.onSurface, fontFamily: 'Hanken Grotesk, sans-serif' }}
                >
                  Gestión de Salidas
                </h1>
              </div>

              {/* Filter Section */}
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
                      Tipo de Salida
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface, 
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Tipo de salida..."
                      value={filters.tipo_salida}
                      onChange={(e) => setFilters(prev => ({ ...prev, tipo_salida: e.target.value }))}
                    />
                  </div>

                  {showAdvancedFilters && (
                    <>
                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Tienda
                        </label>
                        <div className="relative">
                          <button
                            className="w-full rounded-lg px-4 py-3 border flex justify-between items-center"
                            style={{ 
                              backgroundColor: colors.background, 
                              color: filters.id_tienda ? colors.onSurface : colors.outline,
                              borderColor: colors.outlineVariant
                            }}
                            onClick={() => {
                              if (canViewAllSalidas) {
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
                              <ChevronUp size={20} style={{ color: colors.outline }} />
                            ) : (
                              <ChevronDown size={20} style={{ color: colors.outline }} />
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
                                      borderColor: colors.outlineVariant
                                    }}
                                    placeholder="Buscar tienda..."
                                    value={tiendaSearchText}
                                    onChange={(e) => setTiendaSearchText(e.target.value)}
                                  />
                                  {canViewAllSalidas && (
                                    <button
                                      className="w-full px-3 py-2 text-left border-b hover:bg-black/5 transition-colors"
                                      style={{ 
                                        color: colors.onSurface,
                                        borderColor: 'rgba(0,0,0,0.05)'
                                      }}
                                      onClick={() => {
                                        setFilters(prev => ({ ...prev, id_tienda: '' }));
                                        setShowTiendaDropdown(false);
                                        setTiendaSearchText('');
                                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                                        fetchSalidas('');
                                      }}
                                    >
                                      Todas
                                    </button>
                                  )}
                                  {filteredTiendas.map((tienda) => (
                                    <button
                                      key={tienda.id_tienda}
                                      className="w-full px-3 py-2 text-left hover:bg-black/5 transition-colors"
                                      style={{ color: colors.onSurface }}
                                      onClick={() => {
                                        const newIdTienda = tienda.id_tienda.toString();
                                        setFilters(prev => ({ ...prev, id_tienda: newIdTienda }));
                                        setShowTiendaDropdown(false);
                                        setTiendaSearchText('');
                                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                                        fetchSalidas(newIdTienda);
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
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Usuario
                        </label>
                        <div className="relative">
                          <button
                            className="w-full rounded-lg px-4 py-3 border flex justify-between items-center"
                            style={{ 
                              backgroundColor: colors.background, 
                              color: filters.id_usuario ? colors.onSurface : colors.outline,
                              borderColor: colors.outlineVariant
                            }}
                            onClick={() => {
                              if (canViewAllSalidas) {
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
                              <ChevronUp size={20} style={{ color: colors.outline }} />
                            ) : (
                              <ChevronDown size={20} style={{ color: colors.outline }} />
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
                                      borderColor: colors.outlineVariant
                                    }}
                                    placeholder="Buscar usuario..."
                                    value={userSearchText}
                                    onChange={(e) => setUserSearchText(e.target.value)}
                                  />
                                  <button
                                    className="w-full px-3 py-2 text-left border-b hover:bg-black/5 transition-colors"
                                    style={{ 
                                      color: colors.onSurface,
                                      borderColor: 'rgba(0,0,0,0.05)'
                                    }}
                                    onClick={() => {
                                      setFilters(prev => ({ ...prev, id_usuario: '' }));
                                      setShowUserDropdown(false);
                                      setUserSearchText('');
                                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                                      fetchSalidas();
                                    }}
                                  >
                                    Todos
                                  </button>
                                  {filteredUsers.map((userItem) => (
                                    <button
                                      key={userItem.id_usuario}
                                      className="w-full px-3 py-2 text-left hover:bg-black/5 transition-colors"
                                      style={{ color: colors.onSurface }}
                                      onClick={() => {
                                        setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
                                        setShowUserDropdown(false);
                                        setUserSearchText('');
                                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                                        fetchSalidas();
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
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                          Descripción
                        </label>
                        <input
                          type="text"
                          className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2"
                          style={{ 
                            backgroundColor: colors.background, 
                            color: colors.onSurface, 
                            borderColor: colors.outlineVariant
                          }}
                          placeholder="Descripción..."
                          value={filters.descripcion}
                          onChange={(e) => setFilters(prev => ({ ...prev, descripcion: e.target.value }))}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
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
                              borderColor: colors.outlineVariant,
                              colorScheme: isDarkMode ? 'dark' : 'light'
                            }}
                            value={filters.fecha_desde}
                            onChange={(e) => setFilters(prev => ({ ...prev, fecha_desde: e.target.value }))}
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
                              borderColor: colors.outlineVariant,
                              colorScheme: isDarkMode ? 'dark' : 'light'
                            }}
                            value={filters.fecha_hasta}
                            onChange={(e) => setFilters(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 border-2 transition-colors hover:opacity-80"
                      style={{ 
                        backgroundColor: colors.background, 
                        borderColor: colors.outlineVariant,
                        color: colors.onSurface
                      }}
                      onClick={handleClearFilters}
                    >
                      <RefreshCw size={16} />
                      <span>Limpiar</span>
                    </button>
                    <button
                      className="flex-1 rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-80 disabled:opacity-50"
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
                  </div>
                </div>

                {/* Add Button */}
                {canManageSalidas && (
                  <button
                    className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 transition-colors hover:opacity-90 mb-6"
                    style={{ backgroundColor: colors.primary, color: '#fff' }}
                    onClick={handleAdd}
                  >
                    <Plus size={20} />
                    <span>Agregar Salida</span>
                  </button>
                )}

                {/* Salidas List - Mobile/Tablet */}
                <div className="space-y-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="w-8 h-8 border-2 border-t-2 rounded-full animate-spin" style={{ borderColor: colors.primary, borderTopColor: 'transparent' }} />
                    </div>
                  ) : salidas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <X size={48} style={{ color: colors.outline }} />
                      <p className="mt-4" style={{ color: colors.outline }}>No hay salidas registradas</p>
                    </div>
                  ) : (
                    salidas.map((salida) => (
                      <div
                        key={salida.id_salida}
                        className="rounded-2xl p-4 shadow-lg cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: colors.surface }}
                        onClick={() => handleSalidaPress(salida)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold mb-1" style={{ color: colors.onSurface }}>
                              {salida.servicioTienda?.servicio?.nombre || 'N/A'}
                            </h3>
                            <p className="text-sm" style={{ color: colors.outline }}>
                              Tipo: {salida.tipo_salida || 'N/A'}
                            </p>
                            <p className="text-sm" style={{ color: colors.outline }}>
                              Descripción: {salida.descripcion || '-'}
                            </p>
                            <p className="text-sm" style={{ color: colors.outline }}>
                              Tienda: {salida.servicioTienda?.tienda?.nombre || 'N/A'}
                            </p>
                            <p className="text-sm" style={{ color: colors.outline }}>
                              Usuario: {salida.usuario?.nombre_natural || 'N/A'}
                            </p>
                          </div>
                          {canManageSalidas && (
                            <div className="flex gap-2">
                              <button
                                className="p-2 hover:bg-black/10 rounded transition-colors"
                                onClick={(e) => handleEdit(salida, e)}
                              >
                                <Edit size={16} style={{ color: colors.primary }} />
                              </button>
                              <button
                                className="p-2 hover:bg-black/10 rounded transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(salida);
                                }}
                              >
                                <Trash2 size={16} style={{ color: '#F44336' }} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span style={{ color: colors.outline }}>Cantidad:</span>
                            <span className="ml-2" style={{ color: colors.onSurface }}>{salida.cantidad_total}</span>
                          </div>
                          {canManageSalidas && (
                            <div>
                              <span style={{ color: colors.outline }}>Total CUP:</span>
                              <span className="ml-2" style={{ color: colors.onSurface }}>${(parseFloat(salida.costo_cup || '0') * parseFloat(salida.cantidad_total || '0')).toFixed(2) || '0.00'}</span>
                            </div>
                          )}
                          <div>
                            <span style={{ color: colors.outline }}>Fecha:</span>
                            <span className="ml-2" style={{ color: colors.onSurface }}>{new Date(salida.fecha).toLocaleDateString()}</span>
                          </div>
                          {canManageSalidas && (
                            <div>
                              <span style={{ color: colors.outline }}>Total USD:</span>
                              <span className="ml-2" style={{ color: colors.onSurface }}>${(parseFloat(salida.costo_usd || '0') * parseFloat(salida.cantidad_total || '0')).toFixed(2) || '0.00'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination - Mobile/Tablet */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <span style={{ color: colors.outline }}>
                      Página {pagination.currentPage} de {pagination.totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50"
                        style={{ 
                          backgroundColor: colors.surface, 
                          borderColor: colors.outlineVariant,
                          color: colors.onSurface
                        }}
                        onClick={handlePrevPage}
                        disabled={pagination.currentPage === 1}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg border transition-colors hover:opacity-80 disabled:opacity-50"
                        style={{ 
                          backgroundColor: colors.surface, 
                          borderColor: colors.outlineVariant,
                          color: colors.onSurface
                        }}
                        onClick={handleNextPage}
                        disabled={pagination.currentPage === pagination.totalPages}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
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
              <FileIcon size={24} color={colors.primary} />
              <span className="text-base font-medium" style={{ color: colors.onSurface }}>Salidas en Excel</span>
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
              <span className="text-base font-medium" style={{ color: colors.onSurface }}>Salidas en PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Field Selection Modal */}
      {showFieldSelectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div 
            className="rounded-2xl p-6 max-w-md w-full mx-4"
            style={{ backgroundColor: colors.surface }}
          >
            <h2 className="text-xl font-bold mb-4" style={{ color: colors.onSurface }}>
              Seleccionar Campos
            </h2>
            <div className="space-y-3 mb-4">
              {Object.entries(selectedFields).map(([field, checked]) => (
                <label key={field} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setSelectedFields(prev => ({ ...prev, [field]: e.target.checked }))}
                    className="w-5 h-5 rounded"
                  />
                  <span style={{ color: colors.onSurface }}>
                    {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? 'Exportando...' : 'Exportar'}
              </button>
              <button
                className="flex-1 rounded-lg px-4 py-3 transition-colors hover:opacity-80"
                style={{ 
                  backgroundColor: colors.background, 
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant
                }}
                onClick={() => {
                  setShowFieldSelectionModal(false);
                  setShowExportModal(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

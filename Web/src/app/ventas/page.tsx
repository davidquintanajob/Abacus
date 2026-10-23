'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { getClienteById } from '../../services/clienteService';
import { getVentas, deleteVenta, getVentaById } from '../../services/ventaService';
import { getCuentas } from '../../services/cuentaService';
import { getTiendas } from '../../services/tiendaService';
import { getUsuarios } from '../../services/usuarioService';
import { getServicios } from '../../services/servicioService';
import { configService } from '../../services/configService';
import { Search, ChevronLeft, ChevronRight, FileText, Printer, Trash2, Edit, Download, AlertCircle, Grid, List, RefreshCw, X, ChevronDown, ChevronUp, Plus } from 'lucide-react';

const VentasPage = () => {
  const router = useRouter();
  const { colors, isDark, toggleTheme } = useTheme();
  const { token, user, ventaAccessLevels, ventaManagePermissions } = useAuth();
  const { viewMode, toggleViewMode } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const { confirm } = useConfirmDialog();
  const { setLoading } = useNavigationLoading();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const sidebarNavRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Carousel refs and state
  const summaryScrollRef = useRef<HTMLDivElement>(null);
  const cuentasScrollRef = useRef<HTMLDivElement>(null);
  const summaryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cuentasIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = useState(false);
  const [isCuentasAutoScrollPaused, setIsCuentasAutoScrollPaused] = useState(false);

  const formasCobro = ['Efectivo CUP', 'Efectivo USD', 'Transferencia CUP', 'Transferencia USD'];
  const tiposCuenta = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

  // Get current date in YYYY-MM-DD format for default filters (local timezone)
  const getLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const formattedDate = getLocalDate();

  // Filter states
  const [filters, setFilters] = useState({
    nota: '',
    is_nota: null,
    fecha_desde: formattedDate,
    fecha_hasta: formattedDate,
    id_tienda: '',
    id_usuario: '',
    cantidad_min: '',
    cantidad_max: '',
    forma_cobro: '',
    tipo_cuenta: '',
    id_servicio: '',
    nombre_servicio: ''
  });

  // Dropdown states
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [servicios, setServicios] = useState<any[]>([]);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showServicioDropdown, setShowServicioDropdown] = useState(false);
  const [showFormaCobroDropdown, setShowFormaCobroDropdown] = useState(false);
  const [showTipoCuentaDropdown, setShowTipoCuentaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [userSearchText, setUserSearchText] = useState('');
  const [servicioSearchText, setServicioSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingServicios, setIsLoadingServicios] = useState(false);
  const [hasLoadedAllTiendas, setHasLoadedAllTiendas] = useState(false);
  const [hasLoadedAllUsers, setHasLoadedAllUsers] = useState(false);
  const [hasLoadedAllServicios, setHasLoadedAllServicios] = useState(false);

  // Modals
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);
  const [comprobanteSaleItems, setComprobanteSaleItems] = useState([]);
  const [comprobanteConfig, setComprobanteConfig] = useState({
    logo: null,
    nombreNegocio: '',
  });
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrderField, setSelectedOrderField] = useState('fecha_hora');
  const [tiendaCuentasConfig, setTiendaCuentasConfig] = useState({});

  const canViewAllVentas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && ventaAccessLevels?.dependiente === 'all_stores') ||
    (userRole === 'almacenero' && ventaAccessLevels?.almacenero === 'all_stores') ||
    (userRole === 'económico' && ventaAccessLevels?.economico === 'all_stores');

  const canManageVentas = 
    isAdmin ||
    (userRole === 'dependiente' && ventaManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && ventaManagePermissions?.almacenero) ||
    (userRole === 'económico' && ventaManagePermissions?.economico);

  // Auto-scroll functions for Summary carousel
  const startSummaryAutoScroll = useCallback(() => {
    if (!summaryScrollRef.current || isAutoScrollPaused) return;
    
    // Limpiar intervalo existente
    if (summaryIntervalRef.current) {
      clearInterval(summaryIntervalRef.current);
    }
    
    const scroll = () => {
      if (!summaryScrollRef.current || isAutoScrollPaused) return;
      const element = summaryScrollRef.current;
      if (element.scrollLeft >= element.scrollWidth - element.clientWidth) {
        element.scrollLeft = 0;
      } else {
        element.scrollLeft += 1;
      }
    };
    
    summaryIntervalRef.current = setInterval(scroll, 30);
  }, [isAutoScrollPaused]);

  // Auto-scroll functions for Cuentas carousel
  const startCuentasAutoScroll = useCallback(() => {
    if (!cuentasScrollRef.current || isCuentasAutoScrollPaused) return;
    
    // Limpiar intervalo existente
    if (cuentasIntervalRef.current) {
      clearInterval(cuentasIntervalRef.current);
    }
    
    const scroll = () => {
      if (!cuentasScrollRef.current || isCuentasAutoScrollPaused) return;
      const element = cuentasScrollRef.current;
      if (element.scrollLeft >= element.scrollWidth - element.clientWidth) {
        element.scrollLeft = 0;
      } else {
        element.scrollLeft += 1;
      }
    };
    
    cuentasIntervalRef.current = setInterval(scroll, 30);
  }, [isCuentasAutoScrollPaused]);

  // Initialize user's store from session data
  useEffect(() => {
    if (user?.id_tienda) {
      const userTienda = {
        id_tienda: user.id_tienda,
        nombre: user.tienda?.nombre || `Tienda ${user.id_tienda}`
      };
      setTiendas([userTienda]);
      setFilters(prev => ({ ...prev, id_tienda: user.id_tienda.toString() }));
    }
  }, [user?.id_tienda]);

  // Initialize current user from session data
  useEffect(() => {
    if (user?.id_usuario) {
      const currentUser = {
        id_usuario: user.id_usuario,
        nombre_natural: user.nombre_natural || `Usuario ${user.id_usuario}`
      };
      setUsers([currentUser]);
    }
  }, [user?.id_usuario]);

  // Fetch initial data
  useEffect(() => {
    fetchVentas();
    fetchCuentas();
    fetchComprobanteConfig();
    fetchTiendaCuentasConfig();
  }, []);

  const fetchComprobanteConfig = async () => {
    try {
      const config = await configService.getConfig();
      if (config.comprobanteConfig) {
        setComprobanteConfig({
          logo: config.comprobanteConfig.logo ?? null,
          nombreNegocio: config.comprobanteConfig.nombreNegocio ?? '',
        });
      }
    } catch (error) {
      console.error('Error loading comprobante config:', error);
    }
  };

  const fetchTiendaCuentasConfig = async () => {
    try {
      console.log('Fetching tienda cuentas config...');
      const config = await configService.getConfig();
      console.log('Full config:', config);
      if (config && config.tiendaCuentasConfig) {
        console.log('Tienda cuentas config:', config.tiendaCuentasConfig);
        setTiendaCuentasConfig(config.tiendaCuentasConfig);
      } else {
        console.log('No tienda cuentas config found');
      }
    } catch (error) {
      console.error('Error loading tienda cuentas config:', error);
    }
  };

  // Reload cuentas when tienda filter or tiendaCuentasConfig changes
  useEffect(() => {
    fetchCuentas();
  }, [filters.id_tienda, tiendaCuentasConfig]);

  // Start carousels when data is available
  useEffect(() => {
    if (summary) {
      setIsAutoScrollPaused(false);
      startSummaryAutoScroll();
    }
  }, [summary]);

  useEffect(() => {
    if (cuentas && cuentas.length > 0) {
      setIsCuentasAutoScrollPaused(false);
      startCuentasAutoScroll();
    }
  }, [cuentas, startCuentasAutoScroll]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (summaryIntervalRef.current) {
        clearInterval(summaryIntervalRef.current);
      }
      if (cuentasIntervalRef.current) {
        clearInterval(cuentasIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setLoading(false);
  }, [setLoading]);

  const handleMenuPress = () => {
    if (sidebarNavRef.current) {
      sidebarNavRef.current.openSidebar();
    }
  };

  const formatNumberWithSpaces = (num) => {
    const parts = parseFloat(num).toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${integerPart}.${parts[1]}`;
  };

  const getPaymentTypes = (venta) => {
    const paymentTypes = [];
    
    const hasEfectivoCUP = parseFloat(venta.cantidad_cobrada_efectivo_cup || 0) > 0;
    const hasTransferenciaCUP = parseFloat(venta.cantidad_cobrada_transferencia_cup || 0) > 0;
    const hasEfectivoUSD = parseFloat(venta.cantidad_cobrada_efectivo_usd || 0) > 0;
    const hasTransferenciaUSD = parseFloat(venta.cantidad_cobrada_transferencia_usd || 0) > 0;
    
    if (hasEfectivoCUP) {
      paymentTypes.push({ label: 'Efectivo CUP', color: '#4CAF50' });
    }
    if (hasTransferenciaCUP) {
      paymentTypes.push({ label: 'Transferencia CUP', color: '#FF9800' });
    }
    if (hasEfectivoUSD) {
      paymentTypes.push({ label: 'Efectivo USD', color: '#2196F3' });
    }
    if (hasTransferenciaUSD) {
      paymentTypes.push({ label: 'Transferencia USD', color: '#9C27B0' });
    }
    
    return paymentTypes;
  };

  const getCuentaTypeColor = (tipoCuenta) => {
    const tipoLower = tipoCuenta?.toLowerCase() || '';
    
    if (tipoLower.includes('efectivo') && tipoLower.includes('cup')) {
      return '#4CAF50';
    }
    if (tipoLower.includes('efectivo') && tipoLower.includes('usd')) {
      return '#2196F3';
    }
    if (tipoLower.includes('transferencia') && tipoLower.includes('cup')) {
      return '#FF9800';
    }
    if (tipoLower.includes('transferencia') && tipoLower.includes('usd')) {
      return '#9C27B0';
    }
    
    return '#757575';
  };

  // Get Transfermovil QR content
  const getTransfermovilQRContent = (cuenta: any) => {
    const telefono = user?.telefono || '';
    return `TRANSFERMOVIL_ETECSA, TRANSFERENCIA,${cuenta.num_cuenta},${telefono},`;
  };

  const handleCuentaPress = (cuenta: any) => {
    if (cuenta.num_cuenta) {
      setSelectedCuenta(cuenta);
      setShowQRModal(true);
    }
  };

  const formatCubaDate = (isoDateStr) => {
    const date = new Date(isoDateStr);
    const cubaOffset = -4;
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
    const cubaTime = new Date(utcTime + (cubaOffset * 3600000));
    return cubaTime.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const fetchAllTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      const data = await getTiendas({}, 1, 1000);
      const allTiendas = data.data || [];
      
      if (canViewAllVentas) {
        setTiendas(allTiendas);
      } else if (user?.id_tienda) {
        const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
        if (userTienda) {
          setTiendas([userTienda]);
        }
      }
      setHasLoadedAllTiendas(true);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar tiendas' });
    } finally {
      setIsLoadingTiendas(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const data = await getUsuarios({ activo: true }, 1, 1000);
      const allUsers = data.data || [];
      setUsers(allUsers);
      setHasLoadedAllUsers(true);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar usuarios' });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchAllServicios = async (nombreFilter = '') => {
    try {
      setIsLoadingServicios(true);
      const filters = nombreFilter ? { nombre: nombreFilter } : {};
      const data = await getServicios({ ...filters, fetchProducto: true }, 1, 10);
      const allServicios = data.data || [];
      setServicios(allServicios);
      setHasLoadedAllServicios(true);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar servicios' });
    } finally {
      setIsLoadingServicios(false);
    }
  };

  const fetchCuentas = async () => {
    try {
      console.log('Fetching cuentas...');
      const data = await getCuentas({}, 1, 10000);
      let allCuentas = data.data || [];
      console.log('All cuentas from backend:', allCuentas);
      console.log('All cuentas length:', allCuentas.length);
      
      // Filter by tiendaCuentasConfig if tienda is selected and config exists
      if (filters.id_tienda && filters.id_tienda !== '' && filters.id_tienda !== 'all') {
        const tiendaConfig = tiendaCuentasConfig[filters.id_tienda];
        console.log('Tienda config:', tiendaConfig);
        console.log('Tienda config keys:', Object.keys(tiendaConfig || {}));

        if (tiendaConfig) {
          // Get all configured account IDs for this tienda
          const configuredCuentaIds = new Set();
          // Only use valid keys: efectivo_cup, efectivo_usd, transferencia_cup, transferencia_usd
          const validKeys = ['efectivo_cup', 'efectivo_usd', 'transferencia_cup', 'transferencia_usd'];
          validKeys.forEach(key => {
            const cuentasArray = tiendaConfig[key];
            if (cuentasArray && Array.isArray(cuentasArray)) {
              cuentasArray.forEach((cuenta: any) => {
                if (cuenta && cuenta.id_cuenta) {
                  configuredCuentaIds.add(cuenta.id_cuenta);
                }
              });
            }
          });
          console.log('Configured cuenta IDs:', configuredCuentaIds);

          // Filter accounts to only show configured ones
          allCuentas = allCuentas.filter(cuenta => configuredCuentaIds.has(cuenta.id_cuenta));
          console.log('Cuentas after filter:', allCuentas);
        } else {
          // No config found for this tienda, hide carousel
          console.log('No config found for tienda, hiding carousel');
          allCuentas = [];
        }
      }

      setCuentas(allCuentas);
    } catch (error) {
      console.error('Error fetching cuentas', error);
    }
  };

  const fetchVentas = async () => {
    try {
      setIsSearching(true);
      setError(null);

      const effectiveFilters = { ...filters };

      if (!canViewAllVentas && user?.id_tienda) {
        effectiveFilters.id_tienda = user.id_tienda.toString();
      }

      const data = await getVentas(effectiveFilters, pagination.currentPage, pagination.limit);

      // Load deuda info for ventas that are debts
      const ventasWithDeudaInfo = await Promise.all(
        (data.data || []).map(async (venta) => {
          if (venta.is_deuda) {
            try {
              const ventaCompleta = await getVentaById(venta.id_lista_venta);
              
              if (ventaCompleta.deuda) {
                const deudaData = ventaCompleta.deuda;
                
                if (deudaData.id_cliente && (!deudaData.cliente || !deudaData.cliente.nombre)) {
                  try {
                    const clienteData = await getClienteById(deudaData.id_cliente);
                    deudaData.cliente = clienteData;
                  } catch (error) {
                    console.error('Error loading cliente for deuda');
                  }
                }
                
                return { ...venta, deuda: deudaData };
              } else {
                return venta;
              }
            } catch (error) {
              return venta;
            }
          }
          return venta;
        })
      );

      setVentas(ventasWithDeudaInfo);
      console.log('Data from backend:', data);
      console.log('Total items:', data.total, data.pagination?.total);
      setPagination(prev => ({
        ...prev,
        totalPages: data.pagination?.totalPages || 1,
        totalItems: data.total || data.pagination?.total || (data.data?.length || 0)
      }));
      setSummary(data.summary || null);
    } catch (error) {
      setError(error.message);
      showToast({ type: 'error', message: 'Error al cargar ventas' });
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    fetchVentas();
  };

  const handleClearFilters = () => {
    const defaultFilters = {
      nota: '',
      is_nota: null,
      fecha_desde: '',
      fecha_hasta: '',
      id_tienda: user?.id_tienda ? user.id_tienda.toString() : '',
      id_usuario: '',
      cantidad_min: '',
      cantidad_max: '',
      forma_cobro: '',
      tipo_cuenta: '',
      id_servicio: '',
      nombre_servicio: ''
    };
    setFilters(defaultFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    fetchVentas();
  };

  const handleExportExcel = async () => {
    setShowOrderModal(true);
  };

  const handleExportExcelWithOrder = async () => {
    try {
      setIsExporting(true);
      setShowOrderModal(false);
      showToast({ type: 'info', message: 'Exportando ventas a Excel...' });
      
      // Fetch all ventas with current filters (no pagination)
      const effectiveFilters = { ...filters };
      if (!canViewAllVentas && user?.id_tienda) {
        effectiveFilters.id_tienda = user.id_tienda.toString();
      }
      
      const data = await getVentas(effectiveFilters, 1, 10000);
      const allVentas = data.data || [];
      
      // Fetch complete venta data for each venta
      const ventasWithFullData = await Promise.all(
        allVentas.map(async (venta: any) => {
          try {
            const ventaCompleta = await getVentaById(venta.id_lista_venta);
            
            // Load cliente information separately if not included
            if (ventaCompleta.deuda && ventaCompleta.deuda.id_cliente && (!ventaCompleta.deuda.cliente || !ventaCompleta.deuda.cliente.nombre)) {
              try {
                const clienteData = await getClienteById(ventaCompleta.deuda.id_cliente);
                ventaCompleta.deuda.cliente = clienteData;
              } catch (error) {
                console.error('Error loading cliente for deuda');
              }
            }
            
            return ventaCompleta;
          } catch (error) {
            return venta;
          }
        })
      );
      
      // Prepare data for Excel - show individual sales instead of lista_venta
      const excelData: any[] = [];
      ventasWithFullData.forEach((venta: any) => {
        // Tienda from ventas array
        const tienda = venta.ventas?.[0]?.servicioTienda?.tienda;
        const tiendaNombre = tienda?.nombre || '-';
        
        // Usuario from operations or from venta.id_usuario
        const usuario = venta.operaciones?.[0]?.usuario || venta.usuario;
        const usuarioNombre = usuario?.nombre_natural || '-';
        
        // Cliente from deuda
        const cliente = venta.deuda?.cliente?.nombre || '-';
        
        // Debt status
        const tieneDeuda = venta.is_deuda ? 'Sí' : 'No';
        
        // Split fecha and hora
        const fechaHora = venta.fecha_hora || '-';
        let fecha = '-';
        let hora = '-';
        if (fechaHora !== '-') {
          const dateObj = new Date(fechaHora);
          fecha = dateObj.toLocaleDateString('es-ES');
          hora = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        }
        
        // Determine if sale is only in CUP or only in USD
        const hasCUP = (venta.cantidad_cobrada_efectivo_cup > 0 || venta.cantidad_cobrada_transferencia_cup > 0);
        const hasUSD = (venta.cantidad_cobrada_efectivo_usd > 0 || venta.cantidad_cobrada_transferencia_usd > 0);
        
        // Get individual ventas (products sold)
        const ventasIndividuales = venta.ventas || [];
        ventasIndividuales.forEach((v: any) => {
          const row: { [key: string]: any } = {};
          row['Fecha'] = fecha;
          row['Hora'] = hora;
          row['Tienda'] = tiendaNombre;
          row['Usuario'] = usuarioNombre;
          row['Cliente'] = cliente;
          row['Tiene Deuda'] = tieneDeuda;
          
          // Producto
          const producto = v.servicioTienda?.servicio?.nombre || '-';
          row['Producto'] = producto;
          row['Cantidad'] = v.cantidad || 0;
          
          // Forma de cobro - derive from which cantidad is > 0
          let formaCobro = '-';
          if (venta.cantidad_cobrada_efectivo_cup > 0) formaCobro = 'Efectivo CUP';
          else if (venta.cantidad_cobrada_efectivo_usd > 0) formaCobro = 'Efectivo USD';
          else if (venta.cantidad_cobrada_transferencia_cup > 0) formaCobro = 'Transferencia CUP';
          else if (venta.cantidad_cobrada_transferencia_usd > 0) formaCobro = 'Transferencia USD';
          row['Forma de Cobro'] = formaCobro;
          
          // Cuenta from operations
          const cuenta = venta.operaciones?.[0]?.cuenta;
          row['Cuenta'] = cuenta?.nombre || '-';
          
          // Precios - remove .00 decimals for whole numbers
          const formatNumber = (num: any) => {
            if (num === null || num === undefined || num === 0) return 0;
            const formatted = parseFloat(num).toFixed(2);
            return formatted.endsWith('.00') ? parseFloat(formatted).toString() : formatted;
          };
          
          // If sale is only in CUP, show 0 for USD fields
          // If sale is only in USD, show 0 for CUP fields
          // If sale has both, show actual values
          const precioCUP = hasCUP ? (v.precio_cobrado_cup || 0) : 0;
          const precioUSD = hasUSD ? (v.precio_cobrado_usd || 0) : 0;
          const totalCUP = hasCUP ? (precioCUP * v.cantidad) : 0;
          const totalUSD = hasUSD ? (precioUSD * v.cantidad) : 0;
          
          row['Precio CUP'] = formatNumber(precioCUP);
          row['Precio USD'] = formatNumber(precioUSD);
          row['Total CUP'] = formatNumber(totalCUP);
          row['Total USD'] = formatNumber(totalUSD);
          
          row['Nota'] = venta.nota || '-';
          
          excelData.push(row);
        });
      });
      
      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
      
      // Generate file
      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = `Ventas_${formattedDate}.xlsx`;
      
      // Download file
      XLSX.writeFile(wb, fileName);
      
      showToast({ type: 'success', message: 'Excel generado exitosamente' });
    } catch (error: any) {
      showToast({ type: 'error', message: 'Error al exportar: ' + error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const canEditDeleteVenta = (venta: any) => {
    if (!canManageVentas) return false;
    if (isAdmin) return true;
    
    // Check if venta belongs to user's store
    const ventaTiendaId = venta.ventas?.[0]?.servicioTienda?.id_tienda;
    if (ventaTiendaId && ventaTiendaId !== user?.id_tienda) {
      return false;
    }
    
    return true;
  };

  const handleEdit = (venta: any) => {
    if (!canEditDeleteVenta(venta)) {
      showToast({ type: 'error', message: 'No tienes permiso para editar esta venta' });
      return;
    }
    router.push(`/ventas/${venta.id_lista_venta}/edit`);
  };

  const handleDelete = (venta: any) => {
    if (!canEditDeleteVenta(venta)) {
      showToast({ type: 'error', message: 'No tienes permiso para eliminar esta venta' });
      return;
    }

    confirm({
      title: 'Eliminar Venta',
      message: '¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        try {
          await deleteVenta(venta.id_lista_venta);
          showToast({ type: 'success', message: 'Venta eliminada correctamente' });
          fetchVentas();
          fetchCuentas();
        } catch (error) {
          showToast({ type: 'error', message: 'Error al eliminar venta' });
        }
      }
    });
  };

  const handleVentaPress = (venta) => {
    const mode = canEditDeleteVenta(venta) ? 'edit' : 'view';
    router.push(`/ventas/${venta.id_lista_venta}/edit?mode=${mode}`);
  };

  const handleGeneratePDF = () => {
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let y = 20;

      // Add logo if available
      if (comprobanteConfig.logo) {
        const imgWidth = 40;
        const imgHeight = 40;
        const x = (pageWidth - imgWidth) / 2;
        // Convert image to grayscale by adding it with grayscale filter
        const img = new Image();
        img.src = comprobanteConfig.logo;
        const canvas = document.createElement('canvas');
        canvas.width = imgWidth * 3; // Higher resolution for better quality
        canvas.height = imgHeight * 3;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.filter = 'grayscale(100%)';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const grayscaleDataUrl = canvas.toDataURL('image/png');
          pdf.addImage(grayscaleDataUrl, 'PNG', x, y, imgWidth, imgHeight);
        }
        y += imgHeight + 10;
      }

      // Add business name
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(comprobanteConfig.nombreNegocio || 'Nombre del Negocio', pageWidth / 2, y, { align: 'center' });
      y += 10;

      // Add dependiente
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`DEPENDIENTE: ${user?.nombre_natural || 'N/A'}`, pageWidth / 2, y, { align: 'center' });
      y += 7;

      // Add date and time
      const now = new Date();
      pdf.text(`${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`, pageWidth / 2, y, { align: 'center' });
      y += 15;

      // Add table header
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Servicio/Producto', 20, y);
      pdf.text('Cant', pageWidth / 2, y, { align: 'center' });
      pdf.text('Total', pageWidth - 20, y, { align: 'right' });
      y += 5;
      pdf.line(20, y, pageWidth - 20, y);
      y += 10;

      // Add sale items
      pdf.setFont('helvetica', 'normal');
      comprobanteSaleItems.forEach((item) => {
        pdf.text(item.nombre, 20, y);
        pdf.text(item.cantidad.toString(), pageWidth / 2, y, { align: 'center' });
        pdf.text(`$${formatNumberWithSpaces(item.cantidad * item.precio_cup)}`, pageWidth - 20, y, { align: 'right' });
        y += 7;
      });

      // Add total
      y += 5;
      pdf.line(20, y, pageWidth - 20, y);
      y += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.text('TOTAL', 20, y);
      const total = comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_cup), 0);
      pdf.text(`$${formatNumberWithSpaces(total)}`, pageWidth - 20, y, { align: 'right' });
      y += 10;
      pdf.line(20, y, pageWidth - 20, y);
      y += 15;

      // Add thank you message
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text('¡Gracias por su compra!', pageWidth / 2, y, { align: 'center' });

      // Save PDF
      pdf.save('comprobante.pdf');
      setShowComprobanteModal(false);
      showToast({ type: 'success', message: 'PDF generado exitosamente' });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      showToast({ type: 'error', message: 'Error al generar PDF: ' + error.message });
    }
  };

  const handleShowComprobante = (venta) => {
    const saleItems = venta.ventas?.map((v: any) => ({
      nombre: v.servicioTienda?.servicio?.nombre || 'N/A',
      cantidad: v.cantidad || 0,
      precio_cup: v.precio_cobrado_cup || 0,
      precio_usd: v.precio_cobrado_usd || 0,
    })) || [];

    setComprobanteSaleItems(saleItems);
    setShowComprobanteModal(true);
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const filteredUsers = users.filter(userItem =>
    userItem.nombre_natural.toLowerCase().includes(userSearchText.toLowerCase())
  );

  const filteredServicios = servicios.filter(servicio =>
    servicio.nombre.toLowerCase().includes(servicioSearchText.toLowerCase())
  );

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: colors.primary }}></div>
        <p style={{ color: colors.outline }}>Cargando ventas...</p>
      </div>
    );
  }

  return (
    <>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        duration={toast.duration}
        onHide={hideToast}
      />

      <SidebarNavigation 
        ref={sidebarNavRef}
        currentRoute="ventas"
      />

      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          onMenuPress={handleMenuPress}
          onThemePress={toggleTheme}
          onProfilePress={() => router.push('/profile')}
          onNotificationsPress={() => router.push('/notifications')}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode === 'card' ? 'table' : 'grid'}
          isDark={isDarkMode}
          title="Abacus"
          showLogo={true}
          currentRoute="ventas"
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

      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontSize: isMobile ? '24px' : isTablet ? '28px' : '32px',
          fontWeight: 'bold',
          color: colors.onSurface,
          fontFamily: 'Hanken Grotesk, sans-serif'
        }}>
          Gestión de Ventas
        </h1>
      </div>

      {/* Desktop Layout */}
      {isDesktop ? (
        <>
          {/* Filter Section - Horizontal */}
          <div 
            className="rounded-2xl p-4 mb-4 shadow-lg"
            style={{ backgroundColor: colors.surface }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              {/* Nota Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Nota
                </label>
                <input
                  type="text"
                  placeholder="Buscar por nota..."
                  value={filters.nota}
                  onChange={(e) => setFilters(prev => ({ ...prev, nota: e.target.value }))}
                  className="w-full rounded-lg px-4 py-2 border focus:outline-none focus:ring-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface, 
                    borderColor: colors.outlineVariant 
                  }}
                />
              </div>

              {/* Tienda Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
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
                    value={filters.id_tienda ? (tiendas as any[]).find((t: any) => t.id_tienda === parseInt(filters.id_tienda))?.nombre || tiendaSearchText : tiendaSearchText}
                    onChange={(e) => {
                      setTiendaSearchText(e.target.value);
                      if (canViewAllVentas && !hasLoadedAllTiendas) fetchAllTiendas();
                    }}
                    onFocus={() => {
                      if (canViewAllVentas && !hasLoadedAllTiendas) fetchAllTiendas();
                      setShowTiendaDropdown(true);
                    }}
                  />
                  {filters.id_tienda && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        setFilters(prev => ({ ...prev, id_tienda: '' }));
                        setTiendaSearchText('');
                      }}
                    >
                      <X size={18} style={{ color: colors.outline }} />
                    </button>
                  )}
                  {showTiendaDropdown && filteredTiendas.length > 0 && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: isDarkMode ? colors.outlineVariant : '#ccc', borderWidth: '1px' }}
                    >
                      {canViewAllVentas && (
                        <div
                          className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                          style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, id_tienda: '' }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
                          }}
                        >
                          Todas las tiendas
                        </div>
                      )}
                      {filteredTiendas.map((tienda) => (
                        <div
                          key={tienda.id_tienda}
                          className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                          style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, id_tienda: tienda.id_tienda.toString() }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
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

            {/* Second row of filters */}
            <div className="flex items-center gap-3 flex-wrap mt-3">
              {/* Solo ventas con nota */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Solo ventas con nota
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const newIsNota = filters.is_nota === true ? null : true;
                      setFilters(prev => ({ ...prev, is_nota: newIsNota }));
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: filters.is_nota === true ? colors.primary : 'transparent',
                      borderColor: colors.outlineVariant,
                      borderWidth: '1px',
                      color: filters.is_nota === true ? '#fff' : colors.outline
                    }}
                  >
                    Sí
                  </button>
                  <button
                    onClick={() => {
                      const newIsNota = filters.is_nota === false ? null : false;
                      setFilters(prev => ({ ...prev, is_nota: newIsNota }));
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: filters.is_nota === false ? colors.primary : 'transparent',
                      borderColor: colors.outlineVariant,
                      borderWidth: '1px',
                      color: filters.is_nota === false ? '#fff' : colors.outline
                    }}
                  >
                    No
                  </button>
                  <button
                    onClick={() => {
                      setFilters(prev => ({ ...prev, is_nota: null }));
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: filters.is_nota === null ? colors.primary : 'transparent',
                      borderColor: colors.outlineVariant,
                      borderWidth: '1px',
                      color: filters.is_nota === null ? '#fff' : colors.outline
                    }}
                  >
                    Todos
                  </button>
                </div>
              </div>

              {/* Usuario */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
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
                    value={userSearchText}
                    onChange={(e) => {
                      setUserSearchText(e.target.value);
                      if (!hasLoadedAllUsers) fetchAllUsers();
                    }}
                    onFocus={() => {
                      if (!hasLoadedAllUsers) fetchAllUsers();
                      setShowUserDropdown(true);
                    }}
                  />
                  {filters.id_usuario && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        setFilters(prev => ({ ...prev, id_usuario: '' }));
                        setUserSearchText('');
                      }}
                    >
                      <X size={18} style={{ color: colors.outline }} />
                    </button>
                  )}
                  {showUserDropdown && filteredUsers.length > 0 && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: isDarkMode ? colors.outlineVariant : '#ccc', borderWidth: '1px' }}
                    >
                      <div
                        className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                        style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, id_usuario: '' }));
                          setShowUserDropdown(false);
                          setUserSearchText('Todos');
                        }}
                      >
                        Todos
                      </div>
                      {filteredUsers.map((userItem: any) => (
                        <div
                          key={userItem.id_usuario}
                          className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                          style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
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

              {/* Nombre de Servicio o Producto */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Servicio/Producto
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
                    placeholder="Buscar servicio..."
                    value={servicioSearchText}
                    onChange={(e) => {
                      setServicioSearchText(e.target.value);
                      if (!hasLoadedAllServicios) fetchAllServicios();
                    }}
                    onFocus={() => {
                      if (!hasLoadedAllServicios) fetchAllServicios();
                      setShowServicioDropdown(true);
                    }}
                  />
                  {filters.nombre_servicio && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        setFilters(prev => ({ ...prev, nombre_servicio: '' }));
                        setServicioSearchText('');
                      }}
                    >
                      <X size={18} style={{ color: colors.outline }} />
                    </button>
                  )}
                  {showServicioDropdown && filteredServicios.length > 0 && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: isDarkMode ? colors.outlineVariant : '#ccc', borderWidth: '1px' }}
                    >
                      <div
                        className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                        style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, nombre_servicio: '' }));
                          setShowServicioDropdown(false);
                          setServicioSearchText('Todos');
                        }}
                      >
                        Todos
                      </div>
                      {filteredServicios.map((servicio: any) => (
                        <div
                          key={servicio.id_servicio}
                          className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                          style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, nombre_servicio: servicio.nombre }));
                            setShowServicioDropdown(false);
                            setServicioSearchText('');
                          }}
                        >
                          {servicio.nombre}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Forma de Cobro */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Forma de Cobro
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
                    placeholder="Seleccionar forma de cobro..."
                    value={filters.forma_cobro || 'Todas las formas'}
                    readOnly
                    onClick={() => setShowFormaCobroDropdown(!showFormaCobroDropdown)}
                  />
                  {showFormaCobroDropdown && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: isDarkMode ? colors.outlineVariant : '#ccc', borderWidth: '1px' }}
                    >
                      <div
                        className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                        style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, forma_cobro: '' }));
                          setShowFormaCobroDropdown(false);
                        }}
                      >
                        Todas las formas
                      </div>
                      {formasCobro.map((forma: string) => (
                        <div
                          key={forma}
                          className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                          style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, forma_cobro: forma }));
                            setShowFormaCobroDropdown(false);
                          }}
                        >
                          {forma}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Third row of filters */}
            <div className="flex items-center gap-3 flex-wrap mt-3">
              {/* Tipo de Cuenta */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
                  Tipo de Cuenta
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
                    placeholder="Seleccionar tipo de cuenta..."
                    value={filters.tipo_cuenta || 'Todos los tipos'}
                    readOnly
                    onClick={() => setShowTipoCuentaDropdown(!showTipoCuentaDropdown)}
                  />
                  {showTipoCuentaDropdown && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: isDarkMode ? colors.outlineVariant : '#ccc', borderWidth: '1px' }}
                    >
                      <div
                        className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                        style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                        onClick={() => {
                          setFilters(prev => ({ ...prev, tipo_cuenta: '' }));
                          setShowTipoCuentaDropdown(false);
                        }}
                      >
                        Todos los tipos
                      </div>
                      {tiposCuenta.map((tipo: string) => (
                        <div
                          key={tipo}
                          className="px-4 py-2 cursor-pointer hover:opacity-80 border-b"
                          style={{ borderColor: isDarkMode ? colors.outlineVariant : '#ccc', color: isDarkMode ? colors.onSurface : '#000' }}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, tipo_cuenta: tipo }));
                            setShowTipoCuentaDropdown(false);
                          }}
                        >
                          {tipo}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cantidad Mínima */}
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
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
                  onChange={(e) => setFilters(prev => ({ ...prev, cantidad_min: e.target.value }))}
                />
              </div>

              {/* Cantidad Máxima */}
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm font-medium mb-2" style={{ color: colors.outline }}>
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
                  onChange={(e) => setFilters(prev => ({ ...prev, cantidad_max: e.target.value }))}
                />
              </div>

              {/* Fecha Desde */}
              <div className="min-w-[140px]">
                <label className="block text-sm font-medium mb-2 whitespace-nowrap" style={{ color: colors.outline }}>
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
                <label className="block text-sm font-medium mb-2 whitespace-nowrap" style={{ color: colors.outline }}>
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
              className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-80"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Search size={16} />
              )}
              <span>{isSearching ? 'Buscando...' : 'Buscar'}</span>
            </button>
            {isDesktop && canManageVentas && (
              <button
                className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: colors.primary, color: '#fff' }}
                onClick={() => router.push('/ventas/create')}
              >
                <Plus size={16} />
                <span>Agregar Venta</span>
              </button>
            )}
            <button
              className="rounded-lg px-4 py-2 flex items-center justify-center gap-2 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleExportExcel}
              disabled={isExporting}
            >
              <Download size={16} />
              <span>Exportar Ventas en Excel</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Mobile/Tablet Layout */}
          <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface }}>Filtros</h2>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD',
                  border: `1px solid ${colors.primary}`
                }}
              >
                {showAdvancedFilters ? <ChevronUp size={20} color={isDarkMode ? colors.primary : '#1976D2'} /> : <ChevronDown size={20} color={isDarkMode ? colors.primary : '#1976D2'} />}
              </button>
            </div>

            <div className="space-y-4">
          {/* Nota Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Nota</label>
            <input
              type="text"
              placeholder="Buscar por nota..."
              value={filters.nota}
              onChange={(e) => setFilters(prev => ({ ...prev, nota: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg"
              style={{ 
                backgroundColor: colors.background,
                color: colors.onSurface,
                border: `1px solid ${colors.outlineVariant}`,
                outline: 'none'
              }}
            />
          </div>

          {/* Solo ventas con nota */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Solo ventas con nota</label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const newIsNota = filters.is_nota === true ? null : true;
                  setFilters(prev => ({ ...prev, is_nota: newIsNota }));
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: filters.is_nota === true ? colors.primary : 'transparent',
                  borderColor: colors.outlineVariant,
                  borderWidth: '1px',
                  color: filters.is_nota === true ? '#fff' : colors.outline
                }}
              >
                Sí
              </button>
              <button
                onClick={() => {
                  const newIsNota = filters.is_nota === false ? null : false;
                  setFilters(prev => ({ ...prev, is_nota: newIsNota }));
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: filters.is_nota === false ? colors.primary : 'transparent',
                  borderColor: colors.outlineVariant,
                  borderWidth: '1px',
                  color: filters.is_nota === false ? '#fff' : colors.outline
                }}
              >
                No
              </button>
              <button
                onClick={() => {
                  setFilters(prev => ({ ...prev, is_nota: null }));
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: filters.is_nota === null ? colors.primary : 'transparent',
                  borderColor: colors.outlineVariant,
                  borderWidth: '1px',
                  color: filters.is_nota === null ? '#fff' : colors.outline
                }}
              >
                Todos
              </button>
            </div>
          </div>

          {/* Tienda Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Tienda</label>
            <div className="relative">
              <button
                onClick={() => {
                  if (canViewAllVentas) {
                    setShowTiendaDropdown(!showTiendaDropdown);
                    if (!hasLoadedAllTiendas && !isLoadingTiendas) {
                      fetchAllTiendas();
                    }
                  }
                }}
                className="w-full px-4 py-2 rounded-lg flex justify-between items-center"
                style={{ 
                  backgroundColor: colors.background,
                  color: filters.id_tienda ? colors.onSurface : colors.outline,
                  border: `1px solid ${colors.outlineVariant}`
                }}
              >
                <span>{tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}</span>
                {showTiendaDropdown ? <ChevronUp size={20} color={colors.outline} /> : <ChevronDown size={20} color={colors.outline} />}
              </button>
              
              {showTiendaDropdown && (
                <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                  {isLoadingTiendas ? (
                    <div className="flex items-center justify-center p-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 mr-2" style={{ borderColor: colors.primary }}></div>
                      <span style={{ color: colors.outline }}>Cargando tiendas...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-2" style={{ backgroundColor: colors.background }}>
                        <div className="flex items-center">
                          <Search size={18} color={colors.outline} className="mr-2" />
                          <input
                            type="text"
                            placeholder="Buscar tienda..."
                            value={tiendaSearchText}
                            onChange={(e) => setTiendaSearchText(e.target.value)}
                            className="w-full bg-transparent outline-none"
                            style={{ color: colors.onSurface }}
                          />
                        </div>
                      </div>
                      {canViewAllVentas && (
                        <button
                          onClick={() => {
                            setFilters(prev => ({ ...prev, id_tienda: '' }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchVentas();
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                          style={{ color: colors.onSurface }}
                        >
                          Todas las tiendas
                        </button>
                      )}
                      {filteredTiendas.length > 0 ? (
                        filteredTiendas.map((tienda) => (
                          <button
                            key={tienda.id_tienda}
                            onClick={() => {
                              const newIdTienda = tienda.id_tienda.toString();
                              setFilters(prev => ({ ...prev, id_tienda: newIdTienda }));
                              setShowTiendaDropdown(false);
                              setTiendaSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchVentas();
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                            style={{ color: colors.onSurface }}
                          >
                            {tienda.nombre}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2" style={{ color: colors.outline }}>No se encontraron tiendas</div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <>
              {/* Usuario Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Usuario</label>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (canViewAllVentas) {
                        setShowUserDropdown(!showUserDropdown);
                        if (!hasLoadedAllUsers && !isLoadingUsers) {
                          fetchAllUsers();
                        }
                      }
                    }}
                    className="w-full px-4 py-2 rounded-lg flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background,
                      color: filters.id_usuario ? colors.onSurface : colors.outline,
                      border: `1px solid ${colors.outlineVariant}`
                    }}
                  >
                    <span>{users.find(u => u.id_usuario === parseInt(filters.id_usuario))?.nombre_natural || 'Todos los usuarios'}</span>
                    {showUserDropdown ? <ChevronUp size={20} color={colors.outline} /> : <ChevronDown size={20} color={colors.outline} />}
                  </button>
                  
                  {showUserDropdown && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center p-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 mr-2" style={{ borderColor: colors.primary }}></div>
                          <span style={{ color: colors.outline }}>Cargando usuarios...</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-2" style={{ backgroundColor: colors.background }}>
                            <div className="flex items-center">
                              <Search size={18} color={colors.outline} className="mr-2" />
                              <input
                                type="text"
                                placeholder="Buscar usuario..."
                                value={userSearchText}
                                onChange={(e) => setUserSearchText(e.target.value)}
                                className="w-full bg-transparent outline-none"
                                style={{ color: colors.onSurface }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setFilters(prev => ({ ...prev, id_usuario: '' }));
                              setShowUserDropdown(false);
                              setUserSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchVentas();
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                            style={{ color: colors.onSurface }}
                          >
                            Todos los usuarios
                          </button>
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((userItem) => (
                              <button
                                key={userItem.id_usuario}
                                onClick={() => {
                                  setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
                                  setShowUserDropdown(false);
                                  setUserSearchText('');
                                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                                  fetchVentas();
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                                style={{ color: colors.onSurface }}
                              >
                                {userItem.nombre_natural}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2" style={{ color: colors.outline }}>No se encontraron usuarios</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Servicio Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Nombre de Servicio o Producto</label>
                <div className="relative">
                  <button
                    onClick={() => {
                      if (!showServicioDropdown) {
                        fetchAllServicios();
                      }
                      setShowServicioDropdown(!showServicioDropdown);
                    }}
                    className="w-full px-4 py-2 rounded-lg flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background,
                      color: filters.nombre_servicio ? colors.onSurface : colors.outline,
                      border: `1px solid ${colors.outlineVariant}`
                    }}
                  >
                    <span>{servicios.find(s => s.nombre === filters.nombre_servicio)?.nombre || 'Seleccionar servicio...'}</span>
                    {showServicioDropdown ? <ChevronUp size={20} color={colors.outline} /> : <ChevronDown size={20} color={colors.outline} />}
                  </button>
                  
                  {showServicioDropdown && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                      {isLoadingServicios ? (
                        <div className="flex items-center justify-center p-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 mr-2" style={{ borderColor: colors.primary }}></div>
                          <span style={{ color: colors.outline }}>Cargando servicios...</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-2" style={{ backgroundColor: colors.background }}>
                            <div className="flex items-center">
                              <Search size={18} color={colors.outline} className="mr-2" />
                              <input
                                type="text"
                                placeholder="Buscar servicio..."
                                value={servicioSearchText}
                                onChange={(e) => setServicioSearchText(e.target.value)}
                                className="w-full bg-transparent outline-none"
                                style={{ color: colors.onSurface }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setFilters(prev => ({ ...prev, nombre_servicio: '' }));
                              setShowServicioDropdown(false);
                              setServicioSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchVentas();
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                            style={{ color: colors.onSurface }}
                          >
                            Todos los servicios
                          </button>
                          {filteredServicios.length > 0 ? (
                            filteredServicios.map((servicio) => (
                              <button
                                key={servicio.id_servicio}
                                onClick={() => {
                                  setFilters(prev => ({ ...prev, nombre_servicio: servicio.nombre }));
                                  setShowServicioDropdown(false);
                                  setServicioSearchText('');
                                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                                  fetchVentas();
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                                style={{ color: colors.onSurface }}
                              >
                                {servicio.nombre}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-2" style={{ color: colors.outline }}>No se encontraron servicios</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Forma de Cobro Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Forma de Cobro</label>
                <div className="relative">
                  <button
                    onClick={() => setShowFormaCobroDropdown(!showFormaCobroDropdown)}
                    className="w-full px-4 py-2 rounded-lg flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background,
                      color: filters.forma_cobro ? colors.onSurface : colors.outline,
                      border: `1px solid ${colors.outlineVariant}`
                    }}
                  >
                    <span>{filters.forma_cobro || 'Seleccionar forma de cobro...'}</span>
                    {showFormaCobroDropdown ? <ChevronUp size={20} color={colors.outline} /> : <ChevronDown size={20} color={colors.outline} />}
                  </button>
                  
                  {showFormaCobroDropdown && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                      <button
                        onClick={() => {
                          setFilters(prev => ({ ...prev, forma_cobro: '' }));
                          setShowFormaCobroDropdown(false);
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchVentas();
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                        style={{ color: colors.onSurface }}
                      >
                        Todas las formas
                      </button>
                      {formasCobro.map((forma) => (
                        <button
                          key={forma}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, forma_cobro: forma }));
                            setShowFormaCobroDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchVentas();
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                          style={{ color: colors.onSurface }}
                        >
                          {forma}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tipo de Cuenta Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Tipo de Cuenta</label>
                <div className="relative">
                  <button
                    onClick={() => setShowTipoCuentaDropdown(!showTipoCuentaDropdown)}
                    className="w-full px-4 py-2 rounded-lg flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background,
                      color: filters.tipo_cuenta ? colors.onSurface : colors.outline,
                      border: `1px solid ${colors.outlineVariant}`
                    }}
                  >
                    <span>{filters.tipo_cuenta || 'Seleccionar tipo de cuenta...'}</span>
                    {showTipoCuentaDropdown ? <ChevronUp size={20} color={colors.outline} /> : <ChevronDown size={20} color={colors.outline} />}
                  </button>
                  
                  {showTipoCuentaDropdown && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto" style={{ backgroundColor: colors.surface, border: `1px solid ${colors.outlineVariant}` }}>
                      <button
                        onClick={() => {
                          setFilters(prev => ({ ...prev, tipo_cuenta: '' }));
                          setShowTipoCuentaDropdown(false);
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchVentas();
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                        style={{ color: colors.onSurface }}
                      >
                        Todos los tipos
                      </button>
                      {tiposCuenta.map((tipo) => (
                        <button
                          key={tipo}
                          onClick={() => {
                            setFilters(prev => ({ ...prev, tipo_cuenta: tipo }));
                            setShowTipoCuentaDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchVentas();
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-black/5 transition-colors"
                          style={{ color: colors.onSurface }}
                        >
                          {tipo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cantidad Min/Max */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Cantidad Mínima</label>
                  <input
                    type="number"
                    placeholder="Cantidad mínima..."
                    value={filters.cantidad_min}
                    onChange={(e) => setFilters(prev => ({ ...prev, cantidad_min: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      border: `1px solid ${colors.outlineVariant}`,
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Cantidad Máxima</label>
                  <input
                    type="number"
                    placeholder="Cantidad máxima..."
                    value={filters.cantidad_max}
                    onChange={(e) => setFilters(prev => ({ ...prev, cantidad_max: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      border: `1px solid ${colors.outlineVariant}`,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Fecha Desde/Hasta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Fecha Desde</label>
                  <input
                    type="date"
                    value={filters.fecha_desde}
                    onChange={(e) => setFilters(prev => ({ ...prev, fecha_desde: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      border: `1px solid ${colors.outlineVariant}`,
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: colors.outline, marginBottom: '8px' }}>Fecha Hasta</label>
                  <input
                    type="date"
                    value={filters.fecha_hasta}
                    onChange={(e) => setFilters(prev => ({ ...prev, fecha_hasta: e.target.value }))}
                    className="w-full px-4 py-2 rounded-lg"
                    style={{ 
                      backgroundColor: colors.background,
                      color: colors.onSurface,
                      border: `1px solid ${colors.outlineVariant}`,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {!isDesktop && (
                <button
                  onClick={handleExportExcel}
                  className="w-full mt-4 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  style={{ 
                    backgroundColor: colors.primary,
                    color: '#fff'
                  }}
                >
                  <Download size={18} />
                  <span>Exportar Ventas en Excel</span>
                </button>
              )}
            </>
          )}

          {/* Filter Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleClearFilters}
              className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              style={{ 
                backgroundColor: colors.surface,
                border: `1px solid ${colors.outlineVariant}`,
                color: colors.onSurface
              }}
            >
              <RefreshCw size={18} />
              <span>Limpiar</span>
            </button>
            {!isDesktop && (
              <button
                className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                style={{ 
                  backgroundColor: colors.primary,
                  color: '#fff'
                }}
                onClick={handleSearch}
                disabled={isSearching}
              >
                {isSearching ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Search size={18} />
                )}
                <span>{isSearching ? 'Buscando...' : 'Buscar'}</span>
              </button>
            )}
            {isDesktop && (
              <button
                onClick={handleExportExcel}
                className="flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                style={{ 
                  backgroundColor: colors.primary,
                  color: '#fff'
                }}
              >
                <Download size={18} />
                <span>Exportar Ventas en Excel</span>
              </button>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* Cuentas Card */}
      {(() => {
        console.log('Cuentas:', cuentas);
        console.log('Cuentas length:', cuentas?.length);
        return cuentas && cuentas.length > 0 && (
          <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface, marginBottom: '16px' }}>Cuentas</h2>
          <div 
            ref={cuentasScrollRef}
            className="flex gap-4 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseEnter={() => setIsCuentasAutoScrollPaused(true)}
            onMouseLeave={() => setIsCuentasAutoScrollPaused(false)}
          >
            {[...Array(20)].map((_, setIndex) => (
              <React.Fragment key={setIndex}>
                {cuentas.map((cuenta, index) => {
                  const cuentaColor = getCuentaTypeColor(cuenta.tipo_cuenta);
                  const cuentaBgColor = cuenta.tipo_cuenta?.toLowerCase().includes('efectivo') && cuenta.tipo_cuenta?.toLowerCase().includes('cup') 
                    ? 'rgba(76, 175, 80, 0.05)'
                    : cuenta.tipo_cuenta?.toLowerCase().includes('efectivo') && cuenta.tipo_cuenta?.toLowerCase().includes('usd')
                    ? 'rgba(33, 150, 243, 0.05)'
                    : cuenta.tipo_cuenta?.toLowerCase().includes('transferencia') && cuenta.tipo_cuenta?.toLowerCase().includes('cup')
                    ? 'rgba(255, 152, 0, 0.05)'
                    : 'rgba(156, 39, 176, 0.05)';
                  const cuentaBorderColor = cuenta.tipo_cuenta?.toLowerCase().includes('efectivo') && cuenta.tipo_cuenta?.toLowerCase().includes('cup')
                    ? 'rgba(76, 175, 80, 0.2)'
                    : cuenta.tipo_cuenta?.toLowerCase().includes('efectivo') && cuenta.tipo_cuenta?.toLowerCase().includes('usd')
                    ? 'rgba(33, 150, 243, 0.2)'
                    : cuenta.tipo_cuenta?.toLowerCase().includes('transferencia') && cuenta.tipo_cuenta?.toLowerCase().includes('cup')
                    ? 'rgba(255, 152, 0, 0.2)'
                    : 'rgba(156, 39, 176, 0.2)';
                  return (
                    <div 
                      key={`${setIndex}-${cuenta.id_cuenta || index}`}
                      className="p-4 rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: cuentaBgColor, minWidth: '150px', border: `1px solid ${cuentaBorderColor}` }}
                      onClick={() => handleCuentaPress(cuenta)}
                    >
                      <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '4px' }}>
                        {cuenta.nombre}
                      </p>
                      {cuenta.num_cuenta && (
                        <p style={{ fontSize: '12px', color: colors.outline, marginBottom: '4px' }}>
                          {cuenta.num_cuenta}
                        </p>
                      )}
                      <p style={{ fontSize: '16px', fontWeight: 'bold', color: cuentaColor }}>
                        {formatNumberWithSpaces(cuenta.fondo || 0)}
                      </p>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
      })()}

      {/* Summary Card */}
      {summary && (
        <div className="rounded-xl p-4 shadow-lg mb-4" style={{ backgroundColor: colors.surface }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface, marginBottom: '16px' }}>Resumen de Ventas</h2>
          <div 
            ref={summaryScrollRef}
            className="flex gap-4 overflow-x-auto pb-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            onMouseEnter={() => setIsAutoScrollPaused(true)}
            onMouseLeave={() => setIsAutoScrollPaused(false)}
          >
            {[...Array(10)].map((_, setIndex) => (
              <React.Fragment key={setIndex}>
                <div className="p-4 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(76, 175, 80, 0.05)', minWidth: '150px', border: '1px solid rgba(76, 175, 80, 0.2)' }}>
                  <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '4px' }}>Efectivo CUP</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#4CAF50' }}>
                    {formatNumberWithSpaces(summary.total_efectivo_cup || 0)}
                  </p>
                </div>
                <div className="p-4 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(33, 150, 243, 0.05)', minWidth: '150px', border: '1px solid rgba(33, 150, 243, 0.2)' }}>
                  <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '4px' }}>Efectivo USD</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#2196F3' }}>
                    {formatNumberWithSpaces(summary.total_efectivo_usd || 0)}
                  </p>
                </div>
                <div className="p-4 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(255, 152, 0, 0.05)', minWidth: '150px', border: '1px solid rgba(255, 152, 0, 0.2)' }}>
                  <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '4px' }}>Transferencia CUP</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#FF9800' }}>
                    {formatNumberWithSpaces(summary.total_transferencia_cup || 0)}
                  </p>
                </div>
                <div className="p-4 rounded-lg flex-shrink-0" style={{ backgroundColor: 'rgba(156, 39, 176, 0.05)', minWidth: '150px', border: '1px solid rgba(156, 39, 176, 0.2)' }}>
                  <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '4px' }}>Transferencia USD</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#9C27B0' }}>
                    {formatNumberWithSpaces(summary.total_transferencia_usd || 0)}
                  </p>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {!isDesktop && canManageVentas && (
        <button
          className="w-full px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors hover:opacity-90 mb-4"
          style={{ backgroundColor: colors.primary, color: '#fff' }}
          onClick={() => router.push('/ventas/create')}
        >
          <Plus size={20} />
          <span>Agregar Venta</span>
        </button>
      )}

      {/* Ventas List */}
      {error ? (
        <div className="rounded-xl p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.surface }}>
          <AlertCircle size={60} style={{ color: colors.error, marginBottom: '16px' }} />
          <p style={{ color: colors.onSurface, marginBottom: '16px' }}>{error}</p>
          <button
            onClick={fetchVentas}
            className="px-6 py-2 rounded-lg"
            style={{ backgroundColor: colors.primary, color: '#fff' }}
          >
            Reintentar
          </button>
        </div>
      ) : ventas.length === 0 ? (
        <div className="rounded-xl p-8 flex flex-col items-center justify-center text-center" style={{ backgroundColor: colors.surface }}>
          <AlertCircle size={60} style={{ color: colors.outline, marginBottom: '16px' }} />
          <p style={{ color: colors.outline }}>No se encontraron ventas</p>
        </div>
      ) : (
        <>
          {viewMode === 'card' ? (
            <div className="space-y-3">
              {ventas.map((venta) => (
                <div
                  key={venta.id_lista_venta}
                  onClick={() => handleVentaPress(venta)}
                  className="rounded-xl p-4 shadow-lg cursor-pointer transition-transform hover:scale-[1.02]"
                  style={{ 
                    backgroundColor: venta.is_deuda 
                      ? (venta.deuda?.monto_restante_cup > 0 || venta.deuda?.monto_restante_usd > 0 
                          ? (isDarkMode ? 'rgba(255, 193, 7, 0.15)' : '#FFF8E1') 
                          : (isDarkMode ? 'rgba(76, 175, 80, 0.15)' : '#E8F5E9'))
                      : colors.surface 
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {venta.nota && (
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full mb-2" style={{ backgroundColor: '#2196F3' }}>
                          <FileText size={14} color="#fff" />
                        </div>
                      )}
                      <p style={{ fontSize: '16px', fontWeight: '600', color: colors.onSurface, marginBottom: '4px' }}>
                        {venta.nota || 'Venta sin nota'}
                      </p>
                      <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                        Tienda: {venta.ventas?.[0]?.servicioTienda?.tienda?.nombre || 'N/A'}
                      </p>
                      {!venta.is_deuda && (
                        <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                          Usuario: {venta.operaciones?.[0]?.usuario?.nombre_natural || 'N/A'}
                        </p>
                      )}
                      {venta.is_deuda && venta.deuda && (
                        <>
                          <p style={{ fontSize: '14px', color: colors.outline, marginBottom: '2px' }}>
                            Cliente: {venta.deuda.cliente?.nombre || 'N/A'}
                          </p>
                          {(venta.deuda.monto_restante_cup > 0 || venta.deuda.monto_restante_usd > 0) && (
                            <p style={{ fontSize: '14px', color: colors.error, marginBottom: '2px' }}>
                              Restante: ${((venta.deuda.monto_restante_cup || 0) + (venta.deuda.monto_restante_usd || 0)).toFixed(2)}
                            </p>
                          )}
                        </>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(() => {
                          const totalCUP = (parseFloat(venta.cantidad_cobrada_efectivo_cup || 0) + parseFloat(venta.cantidad_cobrada_transferencia_cup || 0));
                          const totalUSD = (parseFloat(venta.cantidad_cobrada_efectivo_usd || 0) + parseFloat(venta.cantidad_cobrada_transferencia_usd || 0));
                          return (
                            <>
                              {totalCUP > 0 && (
                                <span style={{ fontSize: '14px', color: colors.primary }}>
                                  Total CUP: ${totalCUP.toFixed(2)}
                                </span>
                              )}
                              {totalUSD > 0 && (
                                <span style={{ fontSize: '14px', color: colors.primary }}>
                                  Total USD: ${totalUSD.toFixed(2)}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getPaymentTypes(venta).map((paymentType, idx) => (
                          <span 
                            key={idx} 
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: isDarkMode ? `${paymentType.color}33` : `${paymentType.color}22`, color: paymentType.color, border: `1px solid ${paymentType.color}` }}
                          >
                            {paymentType.label}
                          </span>
                        ))}
                      </div>
                      <p style={{ fontSize: '12px', color: colors.outline, marginTop: '4px' }}>
                        Fecha: {formatCubaDate(venta.fecha_hora)}
                      </p>
                    </div>
                    {canManageVentas && (
                      <div className="flex gap-2 ml-4">
                        {canEditDeleteVenta(venta) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(venta);
                            }}
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                          >
                            <Edit size={22} color={colors.primary} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowComprobante(venta);
                          }}
                          className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                          style={{ backgroundColor: isDarkMode ? '#FFC107' : '#FFF9C4' }}
                        >
                          <Printer size={22} color={isDarkMode ? '#fff' : colors.primary} />
                        </button>
                        {canEditDeleteVenta(venta) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(venta);
                            }}
                            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                            style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                          >
                            <Trash2 size={22} color={colors.error} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl shadow-lg">
              <table className="w-full" style={{ backgroundColor: colors.surface }}>
                <thead>
                  <tr style={{ backgroundColor: colors.primary }}>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Nota</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Tienda</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '150px' }}>Usuario</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white" style={{ width: '100px' }}>Total CUP</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white" style={{ width: '100px' }}>Total USD</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '200px' }}>Tipo de Pago</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '120px' }}>Fecha</th>
                    {canManageVentas && (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white" style={{ width: '100px' }}>Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((venta, index) => (
                    <tr
                      key={venta.id_lista_venta}
                      onClick={() => handleVentaPress(venta)}
                      className="cursor-pointer hover:bg-black/5 transition-colors"
                      style={{ 
                        backgroundColor: venta.is_deuda 
                          ? (venta.deuda?.monto_restante_cup > 0 || venta.deuda?.monto_restante_usd > 0 
                              ? (isDarkMode ? 'rgba(255, 193, 7, 0.15)' : '#FFF8E1') 
                              : (isDarkMode ? 'rgba(76, 175, 80, 0.15)' : '#E8F5E9'))
                          : (index % 2 === 0 ? colors.surface : colors.surfaceVariant)
                      }}
                    >
                      <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                        <div className="flex items-center gap-2">
                          {venta.nota && (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: '#2196F3' }}>
                              <FileText size={12} color="#fff" />
                            </div>
                          )}
                          <span>{venta.nota || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                        {venta.ventas?.[0]?.servicioTienda?.tienda?.nombre || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                        {venta.is_deuda ? '-' : (venta.operaciones?.[0]?.usuario?.nombre_natural || 'N/A')}
                      </td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: colors.onSurface }}>
                        {(() => {
                          const totalCUP = (parseFloat(venta.cantidad_cobrada_efectivo_cup || 0) + parseFloat(venta.cantidad_cobrada_transferencia_cup || 0));
                          return totalCUP > 0 ? `$${totalCUP.toFixed(2)}` : '-';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: colors.onSurface }}>
                        {(() => {
                          const totalUSD = (parseFloat(venta.cantidad_cobrada_efectivo_usd || 0) + parseFloat(venta.cantidad_cobrada_transferencia_usd || 0));
                          return totalUSD > 0 ? `$${totalUSD.toFixed(2)}` : '-';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                        <div className="flex flex-wrap gap-1">
                          {getPaymentTypes(venta).map((paymentType, idx) => (
                            <span 
                              key={idx} 
                              className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{ backgroundColor: isDarkMode ? `${paymentType.color}33` : `${paymentType.color}22`, color: paymentType.color, border: `1px solid ${paymentType.color}` }}
                            >
                              {paymentType.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.onSurface }}>
                        {formatCubaDate(venta.fecha_hora)}
                      </td>
                      {canManageVentas && (
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            {canEditDeleteVenta(venta) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(venta);
                                }}
                                className="p-2 rounded-lg transition-colors hover:opacity-80"
                                style={{ backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }}
                              >
                                <Edit size={18} color={colors.primary} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShowComprobante(venta);
                              }}
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ backgroundColor: isDarkMode ? '#FFC107' : '#FFF9C4' }}
                            >
                              <Printer size={18} color={isDarkMode ? '#fff' : colors.primary} />
                            </button>
                            {canEditDeleteVenta(venta) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(venta);
                                }}
                                className="p-2 rounded-lg transition-colors hover:opacity-80"
                                style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                              >
                                <Trash2 size={18} color={colors.error} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                disabled={pagination.currentPage === 1 || isSearching}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.outlineVariant}`,
                  color: colors.onSurface
                }}
              >
                <ChevronLeft size={20} />
              </button>
              {isSearching ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2" style={{ borderColor: colors.primary }}></div>
              ) : (
                <span style={{ color: colors.onSurface }}>
                  Página {pagination.currentPage} de {pagination.totalPages}
                </span>
              )}
              <button
                onClick={() => setPagination(prev => ({ ...prev, currentPage: Math.min(pagination.totalPages, prev.currentPage + 1) }))}
                disabled={pagination.currentPage === pagination.totalPages || isSearching}
                className="p-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.outlineVariant}`,
                  color: colors.onSurface
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          <div className="text-center mt-4">
            <span style={{ color: colors.outline }}>
              Total: {pagination.totalItems} ventas
            </span>
          </div>
        </>
      )}

      {/* Comprobante Modal */}
      {showComprobanteModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowComprobanteModal(false)}
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
                Comprobante de Venta
              </h3>
              <button
                className="p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.background, color: colors.onSurface }}
                onClick={() => setShowComprobanteModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div 
              className="rounded-lg p-4 border-2 mb-4"
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
                DEPENDIENTE: {user?.nombre_natural || 'N/A'}
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
              {comprobanteSaleItems.map((item, index) => (
                <div key={index} className="flex justify-between text-xs mb-1" style={{ color: '#000' }}>
                  <span>{item.nombre}</span>
                  <span>{item.cantidad}</span>
                  <span>${formatNumberWithSpaces(item.cantidad * item.precio_cup)}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold mb-1" style={{ color: '#000' }}>
                <span>TOTAL</span>
                <span></span>
                <span>${formatNumberWithSpaces(comprobanteSaleItems.reduce((sum, item) => sum + (item.cantidad * item.precio_cup), 0))}</span>
              </div>
              <div className="border-b border-black mt-1 mb-1"></div>
              <div className="text-center" style={{ color: '#000', fontSize: '12px' }}>
                ¡Gracias por su compra!
              </div>
            </div>

            <button
              className="w-full px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleGeneratePDF}
            >
              <Download size={20} />
              <span>Generar PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Order Selection Modal for Excel Export */}
      {showOrderModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowOrderModal(false)}
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
                Ordenar por
              </h3>
              <button
                className="p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ backgroundColor: colors.background, color: colors.onSurface }}
                onClick={() => setShowOrderModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {[
                { value: 'fecha_hora', label: 'Fecha y Hora' },
                { value: 'nombre_producto', label: 'Nombre de Producto' },
                { value: 'forma_cobro', label: 'Forma de Cobro' },
                { value: 'nombre_usuario', label: 'Nombre de Usuario' },
              ].map((option) => (
                <button
                  key={option.value}
                  className="w-full p-3 rounded-lg flex items-center gap-3 transition-colors hover:opacity-80"
                  style={{ 
                    backgroundColor: colors.surfaceVariant,
                    borderColor: selectedOrderField === option.value ? colors.primary : 'transparent',
                    borderWidth: 2,
                  }}
                  onClick={() => setSelectedOrderField(option.value)}
                >
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ 
                      borderColor: colors.outlineVariant,
                      borderWidth: 2,
                    }}
                  >
                    {selectedOrderField === option.value && (
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      />
                    )}
                  </div>
                  <span style={{ color: colors.onSurface }}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              className="w-full px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors hover:opacity-90"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleExportExcelWithOrder}
              disabled={isExporting}
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Download size={20} />
              )}
              <span>Generar Excel</span>
            </button>
          </div>
        </div>
      )}

      {/* QR Modal for Transfermovil */}
      {showQRModal && selectedCuenta && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQRModal(false)}
        >
          <div 
            className="rounded-2xl p-6 max-w-md w-full shadow-2xl"
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.onSurface }}>
                Realizar transferencia por Transfermovil
              </h2>
              <button onClick={() => setShowQRModal(false)}>
                <X size={24} color={colors.onSurface} />
              </button>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-lg bg-white">
                <QRCodeSVG 
                  value={getTransfermovilQRContent(selectedCuenta)}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <div className="text-center">
                <p style={{ color: colors.onSurface, fontWeight: '600', marginBottom: '4px' }}>
                  {selectedCuenta.nombre}
                </p>
                <p style={{ color: colors.outline, fontSize: '14px' }}>
                  Número: {selectedCuenta.num_cuenta}
                </p>
                <p style={{ color: colors.outline, fontSize: '12px', marginTop: '8px' }}>
                  Escanea este código QR con Transfermovil para realizar la transferencia
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
</>
  );
};

export default VentasPage;

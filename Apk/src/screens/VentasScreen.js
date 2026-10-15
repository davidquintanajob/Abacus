import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Modal, Keyboard } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { useViewMode } from '../context/ViewModeContext';
import { getVentas, deleteVenta, getVentaById } from '../services/ventaService';
import { getTiendas } from '../services/tiendaService';
import { getUsuarios } from '../services/usuarioService';
import { getServicios } from '../services/servicioService';
import { getCuentas } from '../services/cuentaService';
import { getUsuarioById } from '../services/usuarioService';
import { getDeudaById } from '../services/deudaService';
import { getClienteById } from '../services/clienteService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { storageService } from '../services/storageService';
import configService from '../services/configService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const VentasContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, ventaAccessLevels, ventaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState(null);
  const [completeUserData, setCompleteUserData] = useState(null);
  const [tiendaCuentasConfig, setTiendaCuentasConfig] = useState({});
  const [showOrderSelectionModal, setShowOrderSelectionModal] = useState(false);
  const [selectedOrderField, setSelectedOrderField] = useState('fecha_hora');
  const [isExporting, setIsExporting] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);
  const [userTiendaReady, setUserTiendaReady] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isFirstFocus = useRef(true);
  const isInitializedRef = useRef(false);
  const filtersRef = useRef(filters);
  const userTiendaRef = useRef(user?.id_tienda);
  const summaryScrollViewRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const scrollXRef = useRef(0);
  const isAutoScrollPausedRef = useRef(false);
  const cuentasScrollViewRef = useRef(null);
  const cuentasAutoScrollIntervalRef = useRef(null);
  const cuentasScrollXRef = useRef(0);
  const cuentasIsAutoScrollPausedRef = useRef(false);

  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    userTiendaRef.current = user?.id_tienda;
  }, [user?.id_tienda]);

  // Auto-scroll for summary section (infinite carousel)
  const startAutoScroll = () => {
    if (!summaryScrollViewRef.current || isAutoScrollPausedRef.current) return;
    
    // Stop any existing interval
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }

    // Don't reset scrollXRef.current - continue from current position
    const scrollAmount = 1; // pixels per interval
    const intervalDuration = 30; // ms

    const scroll = () => {
      if (!summaryScrollViewRef.current || isAutoScrollPausedRef.current) return;

      scrollXRef.current += scrollAmount;

      // Simple infinite scroll: when reaching 10000px, reset to 0
      // Since we have 10x duplicated content, this creates a seamless loop
      if (scrollXRef.current >= 10000) {
        scrollXRef.current = 0;
        summaryScrollViewRef.current.scrollTo({ x: 0, animated: false });
      } else {
        summaryScrollViewRef.current.scrollTo({ x: scrollXRef.current, animated: true });
      }
    };

    autoScrollIntervalRef.current = setInterval(scroll, intervalDuration);
  };

  const stopAutoScroll = () => {
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
  };

  const toggleAutoScroll = () => {
    isAutoScrollPausedRef.current = !isAutoScrollPausedRef.current;
    if (!isAutoScrollPausedRef.current) {
      // Get current scroll position and continue from there
      summaryScrollViewRef.current?.measure((x, y, width, height, pageX, pageY) => {
        // We'll use the current scrollXRef value as starting point
        startAutoScroll();
      });
    } else {
      stopAutoScroll();
    }
  };

  // Auto-scroll for cuentas section (infinite carousel)
  const startCuentasAutoScroll = () => {
    if (!cuentasScrollViewRef.current || cuentasIsAutoScrollPausedRef.current) return;
    
    // Stop any existing interval
    if (cuentasAutoScrollIntervalRef.current) {
      clearInterval(cuentasAutoScrollIntervalRef.current);
    }

    const scrollAmount = 1; // pixels per interval
    const intervalDuration = 30; // ms

    const scroll = () => {
      if (!cuentasScrollViewRef.current || cuentasIsAutoScrollPausedRef.current) return;

      cuentasScrollXRef.current += scrollAmount;

      // Simple infinite scroll: when reaching 10000px, reset to 0
      if (cuentasScrollXRef.current >= 10000) {
        cuentasScrollXRef.current = 0;
        cuentasScrollViewRef.current.scrollTo({ x: 0, animated: false });
      } else {
        cuentasScrollViewRef.current.scrollTo({ x: cuentasScrollXRef.current, animated: true });
      }
    };

    cuentasAutoScrollIntervalRef.current = setInterval(scroll, intervalDuration);
  };

  const stopCuentasAutoScroll = () => {
    if (cuentasAutoScrollIntervalRef.current) {
      clearInterval(cuentasAutoScrollIntervalRef.current);
      cuentasAutoScrollIntervalRef.current = null;
    }
  };

  const toggleCuentasAutoScroll = () => {
    cuentasIsAutoScrollPausedRef.current = !cuentasIsAutoScrollPausedRef.current;
    if (!cuentasIsAutoScrollPausedRef.current) {
      cuentasScrollViewRef.current?.measure((x, y, width, height, pageX, pageY) => {
        startCuentasAutoScroll();
      });
    } else {
      stopCuentasAutoScroll();
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (summary) {
        isAutoScrollPausedRef.current = false;
        scrollXRef.current = 0;
        startAutoScroll();
      }

      if (cuentas.length > 0) {
        cuentasIsAutoScrollPausedRef.current = false;
        cuentasScrollXRef.current = 0;
        startCuentasAutoScroll();
      }

      return () => {
        stopAutoScroll();
        isAutoScrollPausedRef.current = false;
        stopCuentasAutoScroll();
        cuentasIsAutoScrollPausedRef.current = false;
      };
    }, [summary, cuentas.length])
  );

  // Get current date in YYYY-MM-DD format for default filters (local timezone)
  const getLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const formattedDate = getLocalDate();

  // Format number with spaces every 3 characters for better readability
  const formatNumberWithSpaces = (num) => {
    const parts = parseFloat(num).toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${integerPart}.${parts[1]}`;
  };

  // Get payment types with their colors for a venta
  const getPaymentTypes = (venta) => {
    const paymentTypes = [];
    
    // Check for CUP payments
    const hasEfectivoCUP = parseFloat(venta.cantidad_cobrada_efectivo_cup || 0) > 0;
    const hasTransferenciaCUP = parseFloat(venta.cantidad_cobrada_transferencia_cup || 0) > 0;
    
    // Check for USD payments
    const hasEfectivoUSD = parseFloat(venta.cantidad_cobrada_efectivo_usd || 0) > 0;
    const hasTransferenciaUSD = parseFloat(venta.cantidad_cobrada_transferencia_usd || 0) > 0;
    
    // Add CUP payments together
    if (hasEfectivoCUP) {
      paymentTypes.push({ label: 'Efectivo CUP', color: '#4CAF50' });
    }
    if (hasTransferenciaCUP) {
      paymentTypes.push({ label: 'Transferencia CUP', color: '#FF9800' });
    }
    
    // Add USD payments together
    if (hasEfectivoUSD) {
      paymentTypes.push({ label: 'Efectivo USD', color: '#2196F3' });
    }
    if (hasTransferenciaUSD) {
      paymentTypes.push({ label: 'Transferencia USD', color: '#9C27B0' });
    }
    
    return paymentTypes;
  };

  // Get color for cuenta based on account number (similar to summary carousel colors)
  const getCuentaColor = (numCuenta) => {
    if (!numCuenta) return '#757575';
    const hash = numCuenta.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#FFC107', '#8BC34A'];
    return colors[hash % colors.length];
  };

  // Get cuenta style based on tipo_cuenta (matching summary carousel styles)
  const getCuentaStyle = (tipoCuenta) => {
    const tipoLower = tipoCuenta?.toLowerCase() || '';
    
    if (tipoLower.includes('efectivo') && tipoLower.includes('cup')) {
      return 'summaryItemGreen';
    }
    if (tipoLower.includes('efectivo') && tipoLower.includes('usd')) {
      return 'summaryItemBlue';
    }
    if (tipoLower.includes('transferencia') && tipoLower.includes('cup')) {
      return 'summaryItemOrange';
    }
    if (tipoLower.includes('transferencia') && tipoLower.includes('usd')) {
      return 'summaryItemPurple';
    }
    
    // Default style
    return null;
  };

  // Get cuenta color value based on tipo_cuenta
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

  // Handle cuenta press to show QR modal
  const handleCuentaPress = (cuenta) => {
    if (cuenta.num_cuenta) {
      setSelectedCuenta(cuenta);
      setShowQRModal(true);
    }
  };

  // Get Transfermovil QR content
  const getTransfermovilQRContent = (cuenta) => {
    const telefono = completeUserData?.telefono || user?.telefono || '';
    return `TRANSFERMOVIL_ETECSA, TRANSFERENCIA,${cuenta.num_cuenta},${telefono},`;
  };

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
  const [tiendas, setTiendas] = useState([]);
  const [users, setUsers] = useState([]);
  const [servicios, setServicios] = useState([]);
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
  const [showServicioDropdown, setShowServicioDropdown] = useState(false);
  const [servicioSearchText, setServicioSearchText] = useState('');
  const [isLoadingServicios, setIsLoadingServicios] = useState(false);
  const [hasLoadedAllServicios, setHasLoadedAllServicios] = useState(false);
  const servicioSearchDebounceRef = useRef(null);
  const [showFormaCobroDropdown, setShowFormaCobroDropdown] = useState(false);
  const [showTipoCuentaDropdown, setShowTipoCuentaDropdown] = useState(false);
  const [showFechaDesdePicker, setShowFechaDesdePicker] = useState(false);
  const [showFechaHastaPicker, setShowFechaHastaPicker] = useState(false);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);

  const formasCobro = ['Efectivo CUP', 'Efectivo USD', 'Transferencia CUP', 'Transferencia USD'];
  const tiposCuenta = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();

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

  // Fetch cuentas on mount and when tienda filter or tiendaCuentasConfig changes
  useEffect(() => {
    fetchCuentas();
  }, [filters.id_tienda, tiendaCuentasConfig]);

  // Fetch complete user data on mount
  useEffect(() => {
    fetchCompleteUserData();
  }, [user?.id_usuario]);

  // Fetch tienda cuentas config on mount
  useEffect(() => {
    fetchTiendaCuentasConfig();
  }, []);

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
      fetchVentas();
      hasDoneInitialFetch.current = true;
    }
  }, [userTiendaReady]);

  // Fetch on pagination changes after initial load
  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchVentas();
    }
  }, [pagination.currentPage]);

  // Mostrar toast al entrar en modo offline
  useEffect(() => {
    if (isOfflineMode && !hasShownOfflineToast) {
      showToast({ 
        type: 'warning', 
        message: 'Modo offline activado. Usando datos locales.',
        duration: 4000 
      });
      setHasShownOfflineToast(true);
    } else if (!isOfflineMode) {
      setHasShownOfflineToast(false);
    }
  }, [isOfflineMode]);

  useFocusEffect(
    React.useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (isInitializedRef.current) {
        const restoreFilters = async () => {
          try {
            const savedFilters = await AsyncStorage.getItem('ventas_filters');
            if (savedFilters) {
              const parsedFilters = JSON.parse(savedFilters);
              setFilters(parsedFilters);
              fetchVentas(null, parsedFilters);
            } else {
              const shouldRestore = !filtersRef.current.id_tienda && userTiendaRef.current;
              if (shouldRestore) {
                setFilters(prev => ({ ...prev, id_tienda: userTiendaRef.current.toString() }));
                fetchVentas(userTiendaRef.current.toString());
              } else {
                fetchVentas();
              }
            }
            // Refresh cuentas when returning from edit/create
            fetchCuentas();
          } catch (error) {
            fetchVentas();
            fetchCuentas();
          }
        };
        restoreFilters();
      }
    }, [])
  );

  const fetchAllTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      const userRole = user?.rol?.toLowerCase();
      const canViewAllVentas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && ventaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && ventaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && ventaAccessLevels?.economico === 'all_stores');

      const canViewOwnStore = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && ventaAccessLevels?.dependiente !== 'none') ||
        (userRole === 'almacenero' && ventaAccessLevels?.almacenero !== 'none') ||
        (userRole === 'económico' && ventaAccessLevels?.economico !== 'none');

      let allTiendas = [];
      
      if (isOfflineMode) {
        allTiendas = await storageService.getTiendas();
      } else {
        const data = await getTiendas({}, 1, 1000);
        allTiendas = data.data || [];
      }
      
      if (user?.id_tienda && canViewOwnStore) {
        if (canViewAllVentas) {
          setTiendas(allTiendas);
        } else {
          const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
          if (userTienda) {
            setTiendas([userTienda]);
          }
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
      let allUsers = [];
      
      if (isOfflineMode) {
        allUsers = await storageService.getUsuarios();
      } else {
        const data = await getUsuarios({ activo: true }, 1, 1000);
        allUsers = data.data || [];
      }
      
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
      let allServicios = [];

      if (isOfflineMode) {
        allServicios = await storageService.getServicios();
      } else {
        const filters = nombreFilter ? { nombre: nombreFilter } : {};
        // Use fetchProducto=true to get servicios and productos (including ofertas)
        const data = await getServicios({ ...filters, fetchProducto: true }, 1, 10);
        allServicios = data.data || [];
      }

      setServicios(allServicios);
      setHasLoadedAllServicios(true);
    } catch (error) {
      showToast({ type: 'error', message: 'Error al cargar servicios' });
    } finally {
      setIsLoadingServicios(false);
    }
  };

  const fetchCuentas = useCallback(async () => {
    try {
      if (isOfflineMode) {
        return;
      }
      // Fetch all accounts first
      const data = await getCuentas({}, 1, 10000);
      let allCuentas = data.data || [];

      // Filter by tiendaCuentasConfig if tienda is selected and config exists
      if (filters.id_tienda && filters.id_tienda !== '' && filters.id_tienda !== 'all') {
        const tiendaConfig = tiendaCuentasConfig[filters.id_tienda];

        if (tiendaConfig) {
          // Get all configured account IDs for this tienda
          const configuredCuentaIds = new Set();
          Object.values(tiendaConfig).forEach(cuentasArray => {
            if (cuentasArray && Array.isArray(cuentasArray)) {
              cuentasArray.forEach(cuenta => {
                if (cuenta && cuenta.id_cuenta) {
                  configuredCuentaIds.add(cuenta.id_cuenta);
                }
              });
            }
          });

          // Filter accounts to only show configured ones
          allCuentas = allCuentas.filter(cuenta => configuredCuentaIds.has(cuenta.id_cuenta));
        } else {
          // No config found for this tienda, hide carousel
          allCuentas = [];
        }
      }

      setCuentas(allCuentas);
    } catch (error) {
      // Error fetching cuentas
    }
  }, [filters.id_tienda, tiendaCuentasConfig, isOfflineMode]);

  const fetchCompleteUserData = async () => {
    try {
      if (!user?.id_usuario || isOfflineMode) {
        return;
      }
      const data = await getUsuarioById(user.id_usuario);
      setCompleteUserData(data);
    } catch (error) {
      // Error fetching complete user data
    }
  };

  const fetchTiendaCuentasConfig = async () => {
    try {
      if (isOfflineMode) {
        return;
      }
      const config = await configService.getConfig();
      if (config && config.tiendaCuentasConfig) {
        setTiendaCuentasConfig(config.tiendaCuentasConfig);
      }
    } catch (error) {
      // Error fetching tienda cuentas config
    }
  };

  // Debounce search for servicios
  useEffect(() => {
    if (servicioSearchDebounceRef.current) {
      clearTimeout(servicioSearchDebounceRef.current);
    }

    servicioSearchDebounceRef.current = setTimeout(() => {
      if (servicioSearchText.length > 0) {
        fetchAllServicios(servicioSearchText);
      }
    }, 500);

    return () => {
      if (servicioSearchDebounceRef.current) {
        clearTimeout(servicioSearchDebounceRef.current);
      }
    };
  }, [servicioSearchText]);

  const fetchVentas = async (tiendaFilter = null, filtersToUse = null) => {
    try {
      setIsSearching(true);
      setError(null);

      const currentFilters = filtersToUse || filters;
      const effectiveFilters = { ...currentFilters };
      
      if (tiendaFilter) {
        effectiveFilters.id_tienda = tiendaFilter;
      }

      const userRole = user?.rol?.toLowerCase();
      const canViewAllVentas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && ventaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && ventaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && ventaAccessLevels?.economico === 'all_stores');

      const canViewOwnStore = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && ventaAccessLevels?.dependiente !== 'none') ||
        (userRole === 'almacenero' && ventaAccessLevels?.almacenero !== 'none') ||
        (userRole === 'económico' && ventaAccessLevels?.economico !== 'none');

      if (!canViewAllVentas && !canViewOwnStore) {
        setVentas([]);
        setIsLoading(false);
        setIsSearching(false);
        return;
      }

      if (!canViewAllVentas && user?.id_tienda) {
        effectiveFilters.id_tienda = user.id_tienda.toString();
      }

      // Adjust date filters for Cuba timezone before sending to backend
      const adjustedFilters = adjustFiltersForCubaTimezone(effectiveFilters);

      let data;
      if (isOfflineMode) {
        data = await storageService.getVentas(adjustedFilters, pagination.currentPage, pagination.limit);
      } else {
        data = await getVentas(adjustedFilters, pagination.currentPage, pagination.limit);
      }

      // Cargar información completa para ventas que son deudas
      const ventasWithDeudaInfo = await Promise.all(
        (data.data || []).map(async (venta) => {
          if (venta.is_deuda) {
            try {
              // Obtener venta completa con getVentaById para obtener id_deuda
              const ventaCompleta = await getVentaById(venta.id_lista_venta);
              
              if (ventaCompleta.deuda) {
                const deudaData = ventaCompleta.deuda;
                
                // Load cliente information separately if not included or if nombre is missing
                if (deudaData.id_cliente && (!deudaData.cliente || !deudaData.cliente.nombre)) {
                  try {
                    const clienteData = await getClienteById(deudaData.id_cliente);
                    deudaData.cliente = clienteData;
                  } catch (error) {
                    // Error loading cliente for deuda
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
      setPagination(prev => ({
        ...prev,
        totalPages: data.pagination?.totalPages || 1,
        totalItems: data.pagination?.total || 0
      }));
      setSummary(data.summary || null);

      await AsyncStorage.setItem('ventas_filters', JSON.stringify(effectiveFilters));
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

  // Function to fetch all ventas for export (without pagination)
  const fetchAllVentasForExport = async () => {
    try {
      const effectiveFilters = { ...filters };
      
      const userRole = user?.rol?.toLowerCase();
      const canViewAllVentas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && ventaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && ventaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && ventaAccessLevels?.economico === 'all_stores');

      if (!canViewAllVentas && user?.id_tienda) {
        effectiveFilters.id_tienda = user.id_tienda.toString();
      }

      const adjustedFilters = adjustFiltersForCubaTimezone(effectiveFilters);

      let allVentas = [];
      let page = 1;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        let data;
        if (isOfflineMode) {
          data = await storageService.getVentas(adjustedFilters, page, limit);
        } else {
          data = await getVentas(adjustedFilters, page, limit);
        }

        allVentas = [...allVentas, ...(data.data || [])];
        hasMore = (data.data || []).length === limit && (data.pagination?.currentPage < data.pagination?.totalPages);
        page++;
      }

      return allVentas;
    } catch (error) {
      throw error;
    }
  };

  // Function to export ventas to Excel
  const exportVentasToExcel = async () => {
    try {
      setIsExporting(true);
      setShowOrderSelectionModal(false);

      const allVentas = await fetchAllVentasForExport();

      // Fetch complete venta data for each venta to get usuario, forma_cobro, and cuenta
      const ventasWithFullData = await Promise.all(
        allVentas.map(async (venta) => {
          try {
            const ventaCompleta = await getVentaById(venta.id_lista_venta);
            return ventaCompleta;
          } catch (error) {
            return venta;
          }
        })
      );

      // Sort ventas based on selected order field
      const sortedVentas = [...ventasWithFullData].sort((a, b) => {
        switch (selectedOrderField) {
          case 'fecha_hora':
            return new Date(a.fecha) - new Date(b.fecha);
          case 'nombre_producto':
            const productA = a.ventas?.[0]?.servicioTienda?.servicio?.nombre || '';
            const productB = b.ventas?.[0]?.servicioTienda?.servicio?.nombre || '';
            return productA.localeCompare(productB);
          case 'forma_cobro':
            return (a.forma_cobro || '').localeCompare(b.forma_cobro || '');
          case 'nombre_usuario':
            return (a.usuario?.nombre_natural || '').localeCompare(b.usuario?.nombre_natural || '');
          default:
            return 0;
        }
      });

      // Prepare data for Excel
      const data = sortedVentas.map(venta => {
        const row = {};
        row['Fecha y Hora'] = venta.fecha_hora || 'N/A';
        
        // Tienda from ventas array
        const tienda = venta.ventas?.[0]?.servicioTienda?.tienda;
        row['Tienda'] = tienda?.nombre || 'N/A';
        
        // Usuario from operaciones or from venta.id_usuario
        const usuario = venta.operaciones?.[0]?.usuario || venta.usuario;
        row['Usuario'] = usuario?.nombre_natural || 'N/A';
        
        // Forma de cobro - derive from which cantidad is > 0
        let formaCobro = 'N/A';
        if (venta.cantidad_cobrada_efectivo_cup > 0) formaCobro = 'Efectivo CUP';
        else if (venta.cantidad_cobrada_efectivo_usd > 0) formaCobro = 'Efectivo USD';
        else if (venta.cantidad_cobrada_transferencia_cup > 0) formaCobro = 'Transferencia CUP';
        else if (venta.cantidad_cobrada_transferencia_usd > 0) formaCobro = 'Transferencia USD';
        row['Forma de Cobro'] = formaCobro;
        
        // Cuenta from operaciones
        const cuenta = venta.operaciones?.[0]?.cuenta;
        row['Cuenta'] = cuenta?.nombre || 'N/A';
        
        // Get product names from ventas array
        const productos = venta.ventas?.map(v => v.servicioTienda?.servicio?.nombre).filter(Boolean).join(', ') || 'N/A';
        row['Productos'] = productos;
        
        row['Efectivo CUP'] = venta.cantidad_cobrada_efectivo_cup || 0;
        row['Transferencia CUP'] = venta.cantidad_cobrada_transferencia_cup || 0;
        row['Efectivo USD'] = venta.cantidad_cobrada_efectivo_usd || 0;
        row['Transferencia USD'] = venta.cantidad_cobrada_transferencia_usd || 0;
        row['Total CUP'] = (venta.cantidad_cobrada_efectivo_cup || 0) + (venta.cantidad_cobrada_transferencia_cup || 0);
        row['Total USD'] = (venta.cantidad_cobrada_efectivo_usd || 0) + (venta.cantidad_cobrada_transferencia_usd || 0);
        row['Nota'] = venta.nota || '';
        
        return row;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Ventas');

      // Generate file
      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      // Save file
      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = `Ventas_${formattedDate}.xlsx`;
      const downloadDir = FileSystem.documentDirectory;
      const fileUri = `${downloadDir}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Show share alert
      Alert.alert(
        'Excel Generado',
        'El archivo Excel ha sido generado exitosamente.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Compartir',
            onPress: async () => {
              try {
                if (await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(fileUri, {
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    dialogTitle: 'Compartir Excel',
                    UTI: 'com.microsoft.excel.xls',
                  });
                } else {
                  showToast({ type: 'error', message: 'Compartir no está disponible en este dispositivo' });
                }
              } catch (error) {
                showToast({ type: 'error', message: 'Error al compartir el archivo' });
              }
            },
          },
          {
            text: 'Guardar',
            onPress: () => {
              showToast({ type: 'success', message: `Archivo guardado en: ${fileUri}` });
            },
          },
        ]
      );
    } catch (error) {
      showToast({ type: 'error', message: 'Error al exportar ventas: ' + error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEdit = (venta) => {
    const mode = canManageVentas ? 'edit' : 'view';
    navigation.navigate('VentaEdit', { venta, mode });
  };

  const handleDelete = (venta) => {
    Alert.alert(
      'Eliminar Venta',
      '¿Estás seguro de que quieres eliminar esta venta? Esta acción no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isOfflineMode) {
                await storageService.deleteVenta(venta.id_lista_venta);
                showToast({ type: 'success', message: 'Venta eliminada correctamente' });
                fetchVentas();
                fetchCuentas();
              } else {
                await deleteVenta(venta.id_lista_venta);
                showToast({ type: 'success', message: 'Venta eliminada correctamente' });
                fetchVentas();
                fetchCuentas();
              }
            } catch (error) {
              showToast({ type: 'error', message: 'Error al eliminar venta' });
            }
          },
        },
      ]
    );
  };

  const handleVentaPress = (venta) => {
    const mode = canManageVentas ? 'edit' : 'view';
    navigation.navigate('VentaEdit', { venta, mode });
  };

  // Format a Date object to YYYY-MM-DD using local timezone (avoids UTC offset issues)
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse a YYYY-MM-DD string as a local date (avoids UTC midnight offset issues)
  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  // Format ISO date string to local date string using Cuba timezone (UTC-4)
  const formatCubaDate = (isoDateStr) => {
    const date = new Date(isoDateStr);
    // Convert UTC to Cuba timezone (UTC-4)
    const cubaOffset = -4; // Cuba is UTC-4
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
    const cubaTime = new Date(utcTime + (cubaOffset * 3600000));
    return cubaTime.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Adjust date filters to Cuba timezone (UTC-4) before sending to backend
  const adjustFiltersForCubaTimezone = (filters) => {
    const adjustedFilters = { ...filters };

    if (adjustedFilters.fecha_desde) {
      // Backend interprets "2024-08-27" as UTC 2024-08-27 00:00:00
      // Cuba 00:00:00 = UTC 04:00:00 (since Cuba is UTC-4)
      // To filter from Cuba 00:00:00 on 2024-08-27, we need UTC 2024-08-27 04:00:00
      // Send ISO datetime instead of just date
      const [year, month, day] = adjustedFilters.fecha_desde.split('-').map(Number);
      const cubaMidnightUTC = new Date(Date.UTC(year, month - 1, day, 4, 0, 0));
      adjustedFilters.fecha_desde = cubaMidnightUTC.toISOString();
    }

    if (adjustedFilters.fecha_hasta) {
      // Backend adds 1 day to fecha_hasta and uses it as UTC
      // Cuba 23:59:59 on day D = UTC 03:59:59 on day D+1
      // To filter until Cuba 23:59:59 on 2024-08-27, we need UTC 2024-08-28 03:59:59
      // But backend will add 1 day, so we send UTC 2024-08-27 03:59:59
      // Backend will convert it to UTC 2024-08-28 03:59:59
      const [year, month, day] = adjustedFilters.fecha_hasta.split('-').map(Number);
      const cubaEndOfDayUTC = new Date(Date.UTC(year, month - 1, day, 3, 59, 59));
      adjustedFilters.fecha_hasta = cubaEndOfDayUTC.toISOString();
    }

    return adjustedFilters;
  };

  const handleFechaDesdeChange = (event, selectedDate) => {
    setShowFechaDesdePicker(false);
    if (selectedDate) {
      setFilters(prev => ({ ...prev, fecha_desde: formatLocalDate(selectedDate) }));
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowFechaHastaPicker(false);
    if (selectedDate) {
      setFilters(prev => ({ ...prev, fecha_hasta: formatLocalDate(selectedDate) }));
    }
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

  const styles = createStyles(responsive);

  if (isLoading && !hasDoneInitialFetch.current) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <Header
          title="Ventas"
          onMenuPress={() => setSidebarOpen(true)}
          colors={colors}
          responsive={responsive}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.outline }]}>Cargando ventas...</Text>
        </View>
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          navigation={navigation}
          currentRoute="Ventas"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} animated={true} />
      
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
      
      <Header 
        onMenuPress={() => setSidebarOpen(true)}
        onThemePress={toggleTheme}
        onSettingsPress={undefined}
        onNotificationsPress={() => {}}
        onProfilePress={() => navigation.navigate('UserProfile')}
        onViewModeToggle={toggleViewMode}
        showViewToggle={true}
        viewMode={viewMode}
        isChangingView={isChangingView}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
      />

      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        navigation={navigation}
        currentRoute="Ventas"
      />

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01}
        enabled={true}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustContentInsets={true}
        >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Ventas</Text>
        </View>

        {/* Filter Section */}
        <Card style={[styles.filterCard, { backgroundColor: colors.surface }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Filtros</Text>
            <TouchableOpacity 
              style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
              onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Ionicons 
                name={showAdvancedFilters ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(24)} 
                color={isDarkMode ? colors.primary : '#1976D2'} 
              />
            </TouchableOpacity>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nota..."
              value={filters.nota}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nota: text }))}
            />
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Solo ventas con nota</Text>
            <View style={styles.switchContainer}>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  { borderColor: colors.outlineVariant },
                  filters.is_nota === true && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => {
                  const newIsNota = filters.is_nota === true ? null : true;
                  const updatedFilters = { ...filters, is_nota: newIsNota };
                  setFilters(updatedFilters);
                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                  fetchVentas(null, updatedFilters);
                }}
              >
                <Text style={[styles.switchOptionText, { color: filters.is_nota === true ? '#fff' : colors.outline }]}>Sí</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  { borderColor: colors.outlineVariant },
                  filters.is_nota === false && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => {
                  const newIsNota = filters.is_nota === false ? null : false;
                  const updatedFilters = { ...filters, is_nota: newIsNota };
                  setFilters(updatedFilters);
                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                  fetchVentas(null, updatedFilters);
                }}
              >
                <Text style={[styles.switchOptionText, { color: filters.is_nota === false ? '#fff' : colors.outline }]}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchOption,
                  { borderColor: colors.outlineVariant },
                  filters.is_nota === null && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => {
                  const updatedFilters = { ...filters, is_nota: null };
                  setFilters(updatedFilters);
                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                  fetchVentas(null, updatedFilters);
                }}
              >
                <Text style={[styles.switchOptionText, { color: filters.is_nota === null ? '#fff' : colors.outline }]}>Todos</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
              onPress={() => {
                if (canViewAllVentas) {
                  setShowTiendaDropdown(!showTiendaDropdown);
                  if (!hasLoadedAllTiendas && !isLoadingTiendas) {
                    fetchAllTiendas();
                  }
                }
              }}
            >
              <Text style={[styles.dropdownText, { color: filters.id_tienda ? colors.onSurface : colors.outline }]}>
                {tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda))?.nombre || 'Todas las tiendas'}
              </Text>
              <Ionicons 
                name={showTiendaDropdown ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(20)} 
                color={colors.outline} 
              />
            </TouchableOpacity>
            
            {showTiendaDropdown && (
              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                {isLoadingTiendas && (
                  <View style={styles.dropdownLoadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando tiendas...</Text>
                  </View>
                )}
                {!isLoadingTiendas && (
                  <>
                    <View style={[styles.dropdownSearchInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Ionicons 
                        name="search-outline" 
                        size={responsive.responsiveWidth(18)} 
                        color={colors.outline} 
                        style={styles.searchIcon}
                      />
                      <TextInput
                        style={[styles.dropdownSearchInputText, { color: colors.onSurface }]}
                        placeholderTextColor={colors.outline}
                        placeholder="Buscar tienda..."
                        value={tiendaSearchText}
                        onChangeText={setTiendaSearchText}
                      />
                    </View>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      {canViewAllVentas && (
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, id_tienda: '' }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchVentas('');
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las tiendas</Text>
                        </TouchableOpacity>
                      )}
                      {filteredTiendas.length > 0 ? (
                        filteredTiendas.map((tienda, index) => (
                          <TouchableOpacity
                            key={tienda.id_tienda}
                            style={[styles.dropdownItem, index === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                            onPress={() => {
                              const newIdTienda = tienda.id_tienda.toString();
                              setFilters(prev => ({ ...prev, id_tienda: newIdTienda }));
                              setShowTiendaDropdown(false);
                              setTiendaSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchVentas(newIdTienda);
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={styles.dropdownItem}>
                          <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron tiendas</Text>
                        </View>
                      )}
                    </ScrollView>
                  </>
                )}
              </View>
            )}
          </View>

          {showAdvancedFilters && (
            <>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Usuario</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    if (canViewAllVentas) {
                      setShowUserDropdown(!showUserDropdown);
                      if (!hasLoadedAllUsers && !isLoadingUsers) {
                        fetchAllUsers();
                      }
                    }
                  }}
                >
                  <Text style={[styles.dropdownText, { color: filters.id_usuario ? colors.onSurface : colors.outline }]}>
                    {users.find(u => u.id_usuario === parseInt(filters.id_usuario))?.nombre_natural || 'Todos los usuarios'}
                  </Text>
                  <Ionicons 
                    name={showUserDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showUserDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {isLoadingUsers && (
                      <View style={styles.dropdownLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando usuarios...</Text>
                      </View>
                    )}
                    {!isLoadingUsers && (
                      <>
                        <View style={[styles.dropdownSearchInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                          <Ionicons 
                            name="search-outline" 
                            size={responsive.responsiveWidth(18)} 
                            color={colors.outline} 
                            style={styles.searchIcon}
                          />
                          <TextInput
                            style={[styles.dropdownSearchInputText, { color: colors.onSurface }]}
                            placeholderTextColor={colors.outline}
                            placeholder="Buscar usuario..."
                            value={userSearchText}
                            onChangeText={setUserSearchText}
                          />
                        </View>
                        <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                          <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                              setFilters(prev => ({ ...prev, id_usuario: '' }));
                              setShowUserDropdown(false);
                              setUserSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchVentas();
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los usuarios</Text>
                          </TouchableOpacity>
                          {filteredUsers.length > 0 ? (
                            filteredUsers.map((userItem, index) => (
                              <TouchableOpacity
                                key={userItem.id_usuario}
                                style={[styles.dropdownItem, index === filteredUsers.length - 1 && styles.dropdownItemLast]}
                                onPress={() => {
                                  setFilters(prev => ({ ...prev, id_usuario: userItem.id_usuario.toString() }));
                                  setShowUserDropdown(false);
                                  setUserSearchText('');
                                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                                  fetchVentas();
                                }}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{userItem.nombre_natural}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.dropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron usuarios</Text>
                            </View>
                          )}
                        </ScrollView>
                      </>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nombre de Servicio o Producto</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    if (!showServicioDropdown) {
                      fetchAllServicios();
                    }
                    setShowServicioDropdown(!showServicioDropdown);
                  }}
                >
                  <Text style={[styles.dropdownText, { color: filters.nombre_servicio ? colors.onSurface : colors.outline }]}>
                    {servicios.find(s => s.nombre === filters.nombre_servicio)?.nombre || 'Seleccionar servicio...'}
                  </Text>
                  <Ionicons 
                    name={showServicioDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showServicioDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {isLoadingServicios ? (
                      <View style={styles.dropdownLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando servicios...</Text>
                      </View>
                    ) : (
                      <>
                        <View style={[styles.dropdownSearchInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                          <Ionicons 
                            name="search-outline" 
                            size={responsive.responsiveWidth(18)} 
                            color={colors.outline} 
                            style={styles.searchIcon}
                          />
                          <TextInput
                            style={[styles.dropdownSearchInputText, { color: colors.onSurface }]}
                            placeholderTextColor={colors.outline}
                            placeholder="Buscar servicio..."
                            value={servicioSearchText}
                            onChangeText={setServicioSearchText}
                          />
                        </View>
                        <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                          <TouchableOpacity
                            style={styles.dropdownItem}
                            onPress={() => {
                              setFilters(prev => ({ ...prev, nombre_servicio: '' }));
                              setShowServicioDropdown(false);
                              setServicioSearchText('');
                              setPagination(prev => ({ ...prev, currentPage: 1 }));
                              fetchVentas();
                            }}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los servicios</Text>
                          </TouchableOpacity>
                          {filteredServicios.length > 0 ? (
                            filteredServicios.map((servicio, index) => (
                              <TouchableOpacity
                                key={servicio.id_servicio}
                                style={[styles.dropdownItem, index === filteredServicios.length - 1 && styles.dropdownItemLast]}
                                onPress={() => {
                                  setFilters(prev => ({ ...prev, nombre_servicio: servicio.nombre }));
                                  setShowServicioDropdown(false);
                                  setServicioSearchText('');
                                  setPagination(prev => ({ ...prev, currentPage: 1 }));
                                  fetchVentas();
                                }}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{servicio.nombre}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.dropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron servicios</Text>
                            </View>
                          )}
                        </ScrollView>
                      </>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Forma de Cobro</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowFormaCobroDropdown(!showFormaCobroDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: filters.forma_cobro ? colors.onSurface : colors.outline }]}>
                    {filters.forma_cobro || 'Seleccionar forma de cobro...'}
                  </Text>
                  <Ionicons 
                    name={showFormaCobroDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showFormaCobroDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setFilters(prev => ({ ...prev, forma_cobro: '' }));
                          setShowFormaCobroDropdown(false);
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchVentas();
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las formas</Text>
                      </TouchableOpacity>
                      {formasCobro.map((forma, index) => (
                        <TouchableOpacity
                          key={forma}
                          style={[styles.dropdownItem, index === formasCobro.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, forma_cobro: forma }));
                            setShowFormaCobroDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchVentas();
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{forma}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tipo de Cuenta</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowTipoCuentaDropdown(!showTipoCuentaDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: filters.tipo_cuenta ? colors.onSurface : colors.outline }]}>
                    {filters.tipo_cuenta || 'Seleccionar tipo de cuenta...'}
                  </Text>
                  <Ionicons 
                    name={showTipoCuentaDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showTipoCuentaDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setFilters(prev => ({ ...prev, tipo_cuenta: '' }));
                          setShowTipoCuentaDropdown(false);
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchVentas();
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los tipos</Text>
                      </TouchableOpacity>
                      {tiposCuenta.map((tipo, index) => (
                        <TouchableOpacity
                          key={tipo}
                          style={[styles.dropdownItem, index === tiposCuenta.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, tipo_cuenta: tipo }));
                            setShowTipoCuentaDropdown(false);
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchVentas();
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tipo}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.filterRow}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cantidad Mínima</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Cantidad mínima..."
                    value={filters.cantidad_min}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, cantidad_min: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.filterGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cantidad Máxima</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Cantidad máxima..."
                    value={filters.cantidad_max}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, cantidad_max: text }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.filterRow}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Fecha Desde</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    onPress={() => setShowFechaDesdePicker(true)}
                  >
                    <Text style={[styles.inputText, { color: filters.fecha_desde ? colors.onSurface : colors.outline }]}>
                      {filters.fecha_desde || 'Seleccionar...'}
                    </Text>
                  </TouchableOpacity>
                  {showFechaDesdePicker && (
                    <DateTimePicker
                      value={filters.fecha_desde ? parseLocalDate(filters.fecha_desde) : new Date()}
                      mode="date"
                      display="default"
                      onChange={handleFechaDesdeChange}
                    />
                  )}
                </View>

                <View style={[styles.filterGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Fecha Hasta</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    onPress={() => setShowFechaHastaPicker(true)}
                  >
                    <Text style={[styles.inputText, { color: filters.fecha_hasta ? colors.onSurface : colors.outline }]}>
                    {filters.fecha_hasta || 'Seleccionar...'}
                  </Text>
                  </TouchableOpacity>
                  {showFechaHastaPicker && (
                    <DateTimePicker
                      value={filters.fecha_hasta ? parseLocalDate(filters.fecha_hasta) : new Date()}
                      mode="date"
                      display="default"
                      onChange={handleFechaHastaChange}
                    />
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.exportButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowOrderSelectionModal(true)}
                disabled={isExporting}
              >
                {isExporting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#fff" />
                    <Text style={styles.exportButtonText}>Exportar Ventas en Excel</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={[styles.filterButton, styles.clearButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
              onPress={handleClearFilters}
            >
              <Ionicons name="refresh-outline" size={responsive.responsiveWidth(18)} color={colors.onSurface} />
              <Text style={[styles.filterButtonText, { color: colors.onSurface }]}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, styles.searchButton, { backgroundColor: colors.primary }]}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="search" size={responsive.responsiveWidth(18)} color="#fff" />
                  <Text style={[styles.filterButtonText, { color: '#fff' }]}>Buscar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Cuentas Carousel */}
        {cuentas.length > 0 && (
          <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryTitle, { color: colors.onSurface }]}>Cuentas</Text>
            </View>
            <ScrollView
              ref={cuentasScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.summaryGridContainer}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                stopCuentasAutoScroll();
              }}
              onScrollEndDrag={(event) => {
                cuentasScrollXRef.current = event.nativeEvent.contentOffset.x;
                if (cuentas.length > 0 && !cuentasIsAutoScrollPausedRef.current) {
                  startCuentasAutoScroll();
                }
              }}
              onTouchStart={() => {
                toggleCuentasAutoScroll();
              }}
            >
              {[...Array(10)].map((_, setIndex) => (
                <React.Fragment key={setIndex}>
                  {cuentas.map((cuenta, index) => {
                    const cuentaStyle = getCuentaStyle(cuenta.tipo_cuenta);
                    const cuentaColor = getCuentaTypeColor(cuenta.tipo_cuenta);
                    return (
                      <TouchableOpacity
                        key={`${setIndex}-${cuenta.id_cuenta || index}`}
                        style={[
                          styles.summaryItem,
                          cuentaStyle ? styles[cuentaStyle] : null,
                          { backgroundColor: colors.background }
                        ]}
                        onPress={() => handleCuentaPress(cuenta)}
                        disabled={!cuenta.num_cuenta}
                      >
                        <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>
                          {cuenta.nombre}
                        </Text>
                        {cuenta.num_cuenta && (
                          <Text style={[styles.summaryItemValue, { color: colors.outline, fontWeight: '400', fontSize: responsive.fontSizes.caption }]}>
                            {cuenta.num_cuenta}
                          </Text>
                        )}
                        <Text style={[styles.summaryItemLabel, { color: cuentaColor, fontSize: responsive.fontSizes.caption, fontWeight: '700' }]}>
                          {formatNumberWithSpaces(cuenta.fondo || 0)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </React.Fragment>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Summary Card */}
        {summary && (
          <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryTitle, { color: colors.onSurface }]}>Resumen de Ventas</Text>
            </View>
            <ScrollView
              ref={summaryScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.summaryGridContainer}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => {
                stopAutoScroll();
              }}
              onScrollEndDrag={(event) => {
                // Update scrollXRef to current position after manual scroll
                scrollXRef.current = event.nativeEvent.contentOffset.x;
                if (summary && !isAutoScrollPausedRef.current) {
                  startAutoScroll();
                }
              }}
              onTouchStart={() => {
                toggleAutoScroll();
              }}
            >
              {[...Array(10)].map((_, setIndex) => (
                <React.Fragment key={setIndex}>
                  <View style={[styles.summaryItem, styles.summaryItemGreen]}>
                    <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>Efectivo CUP</Text>
                    <Text style={[styles.summaryItemValue, { color: '#4CAF50' }]}>
                      {formatNumberWithSpaces(summary.total_efectivo_cup || 0)}
                    </Text>
                  </View>
                  <View style={[styles.summaryItem, styles.summaryItemBlue]}>
                    <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>Efectivo USD</Text>
                    <Text style={[styles.summaryItemValue, { color: '#2196F3' }]}>
                      {formatNumberWithSpaces(summary.total_efectivo_usd || 0)}
                    </Text>
                  </View>
                  <View style={[styles.summaryItem, styles.summaryItemOrange]}>
                    <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>Transferencia CUP</Text>
                    <Text style={[styles.summaryItemValue, { color: '#FF9800' }]}>
                      {formatNumberWithSpaces(summary.total_transferencia_cup || 0)}
                    </Text>
                  </View>
                  <View style={[styles.summaryItem, styles.summaryItemPurple]}>
                    <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>Transferencia USD</Text>
                    <Text style={[styles.summaryItemValue, { color: '#9C27B0' }]}>
                      {formatNumberWithSpaces(summary.total_transferencia_usd || 0)}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </ScrollView>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {!isOfflineMode && canManageVentas && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Sales')}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Venta</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Ventas List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando ventas...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchVentas}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : ventas.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="cube-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron ventas
            </Text>
          </Card>
        ) : (
          <>
            {viewMode === 'card' ? (
              ventas.map((venta) => (
                <TouchableOpacity
                  key={venta.id_lista_venta}
                  onPress={() => handleVentaPress(venta)}
                  activeOpacity={0.7}
                >
                  <Card style={[
                    styles.ventaCard, 
                    { 
                      backgroundColor: venta.is_deuda 
                        ? (venta.deuda?.monto_restante_cup > 0 || venta.deuda?.monto_restante_usd > 0 
                            ? (isDarkMode ? 'rgba(255, 193, 7, 0.15)' : '#FFF8E1') 
                            : (isDarkMode ? 'rgba(76, 175, 80, 0.15)' : '#E8F5E9'))
                        : colors.surface 
                    }
                  ]}>
                    {venta.nota && (
                      <View style={[styles.noteFlag, { backgroundColor: '#2196F3' }]}>
                        <Ionicons name="document-text-outline" size={responsive.responsiveWidth(14)} color="#fff" />
                      </View>
                    )}
                    <View style={styles.ventaInfo}>
                      <View style={styles.ventaHeader}>
                        <Text style={[styles.ventaNota, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                          {venta.nota || ''}
                        </Text>
                      </View>
                      <Text style={[styles.ventaTienda, { color: colors.outline }]}>
                        Tienda: {venta.ventas?.[0]?.servicioTienda?.tienda?.nombre || 'N/A'}
                      </Text>
                      {!venta.is_deuda && (
                        <Text style={[styles.ventaUsuario, { color: colors.outline }]}>
                          Usuario: {venta.operaciones?.[0]?.usuario?.nombre_natural || 'N/A'}
                        </Text>
                      )}
                      {venta.is_deuda && venta.deuda && (
                        <>
                          <Text style={[styles.ventaUsuario, { color: colors.outline }]}>
                            Cliente: {venta.deuda.cliente?.nombre || 'N/A'}
                          </Text>
                          <View style={styles.deudaInfoContainer}>
                            {(venta.deuda.monto_restante_cup > 0 || venta.deuda.monto_cup > 0) && (
                              <View style={styles.deudaAmountRow}>
                                <Text style={[styles.deudaLabel, { color: colors.outline }]}>Restante CUP:</Text>
                                <Text style={[styles.deudaAmount, { color: venta.deuda.monto_restante_cup > 0 ? colors.error : '#4CAF50' }]}>
                                  ${venta.deuda.monto_restante_cup.toFixed(2)}
                                </Text>
                              </View>
                            )}
                            {(venta.deuda.monto_restante_usd > 0 || venta.deuda.monto_usd > 0) && (
                              <View style={styles.deudaAmountRow}>
                                <Text style={[styles.deudaLabel, { color: colors.outline }]}>Restante USD:</Text>
                                <Text style={[styles.deudaAmount, { color: venta.deuda.monto_restante_usd > 0 ? colors.error : '#4CAF50' }]}>
                                  ${venta.deuda.monto_restante_usd.toFixed(2)}
                                </Text>
                              </View>
                            )}
                            {(venta.deuda.monto_cup > 0) && (
                              <View style={styles.deudaAmountRow}>
                                <Text style={[styles.deudaLabel, { color: colors.outline }]}>Total CUP:</Text>
                                <Text style={[styles.deudaAmount, { color: colors.onSurface }]}>
                                  ${venta.deuda.monto_cup.toFixed(2)}
                                </Text>
                              </View>
                            )}
                            {(venta.deuda.monto_usd > 0) && (
                              <View style={styles.deudaAmountRow}>
                                <Text style={[styles.deudaLabel, { color: colors.outline }]}>Total USD:</Text>
                                <Text style={[styles.deudaAmount, { color: colors.onSurface }]}>
                                  ${venta.deuda.monto_usd.toFixed(2)}
                                </Text>
                              </View>
                            )}
                            {(() => {
                              const pagadoCup = venta.deuda.monto_restante_cup !== undefined 
                                ? venta.deuda.monto_cup - venta.deuda.monto_restante_cup 
                                : 0;
                              const pagadoUsd = venta.deuda.monto_restante_usd !== undefined 
                                ? venta.deuda.monto_usd - venta.deuda.monto_restante_usd 
                                : 0;
                              
                              return (
                                <>
                                  {pagadoCup > 0 && (
                                    <View style={styles.deudaAmountRow}>
                                      <Text style={[styles.deudaLabel, { color: colors.outline }]}>Pagado CUP:</Text>
                                      <Text style={[styles.deudaAmount, { color: '#4CAF50' }]}>
                                        ${pagadoCup.toFixed(2)}
                                      </Text>
                                    </View>
                                  )}
                                  {pagadoUsd > 0 && (
                                    <View style={styles.deudaAmountRow}>
                                      <Text style={[styles.deudaLabel, { color: colors.outline }]}>Pagado USD:</Text>
                                      <Text style={[styles.deudaAmount, { color: '#4CAF50' }]}>
                                        ${pagadoUsd.toFixed(2)}
                                      </Text>
                                    </View>
                                  )}
                                </>
                              );
                            })()}
                          </View>
                        </>
                      )}
                      <View style={styles.cantidadRow}>
                        {(() => {
                          const totalCUP = (parseFloat(venta.cantidad_cobrada_efectivo_cup || 0) + parseFloat(venta.cantidad_cobrada_transferencia_cup || 0));
                          const totalUSD = (parseFloat(venta.cantidad_cobrada_efectivo_usd || 0) + parseFloat(venta.cantidad_cobrada_transferencia_usd || 0));
                          const paidInCUP = totalCUP > 0;
                          const paidInUSD = totalUSD > 0;

                          return (
                            <>
                              {paidInCUP && (
                                <Text style={[styles.ventaCantidad, { color: colors.primary }]}>
                                  Total CUP: ${totalCUP.toFixed(2)}
                                </Text>
                              )}
                              {paidInUSD && (
                                <Text style={[styles.ventaCantidad, { color: colors.primary }]}>
                                  Total USD: ${totalUSD.toFixed(2)}
                                </Text>
                              )}
                            </>
                          );
                        })()}
                      </View>
                      <View style={styles.cardPaymentTypesContainer}>
                        {getPaymentTypes(venta).map((paymentType, idx) => (
                          <View 
                            key={idx} 
                            style={[styles.cardPaymentTypeBadge, { backgroundColor: isDarkMode ? `${paymentType.color}33` : `${paymentType.color}22`, borderColor: paymentType.color }]}
                          >
                            <Text style={[styles.cardPaymentTypeText, { color: paymentType.color }]}>
                              {paymentType.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={[styles.ventaFecha, { color: colors.outline }]}>
                        Fecha: {formatCubaDate(venta.fecha_hora)}
                      </Text>
                    </View>
                    {canManageVentas && (
                      <View style={styles.ventaActions}>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEdit(venta);
                          }}
                        >
                          <Image
                            source={require('../../assets/editar.png')}
                            style={styles.actionIconSmall}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(venta);
                          }}
                        >
                          <Image
                            source={require('../../assets/basura.png')}
                            style={styles.actionIconSmall}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              ))
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollView}>
                <View style={styles.tableContainer}>
                  <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Nota</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Tienda</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Usuario</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Total CUP</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Total USD</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Tipo de Pago</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Fecha</Text>
                    {canManageVentas && (
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                    )}
                  </View>
                  {ventas.map((venta, index) => (
                    <TouchableOpacity
                      key={venta.id_lista_venta}
                      onPress={() => handleVentaPress(venta)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.tableRow, 
                        { 
                          backgroundColor: venta.is_deuda 
                            ? (venta.deuda?.monto_restante_cup > 0 || venta.deuda?.monto_restante_usd > 0 
                                ? (isDarkMode ? 'rgba(255, 193, 7, 0.15)' : '#FFF8E1') 
                                : (isDarkMode ? 'rgba(76, 175, 80, 0.15)' : '#E8F5E9'))
                            : (index % 2 === 0 ? colors.surface : colors.surfaceVariant)
                        }
                      ]}>
                        <View style={[styles.tableCellWithFlags, { width: responsive.responsiveWidth(150) }]}>
                          <View style={styles.tableFlagsContainer}>
                            {venta.nota && (
                              <View style={[styles.tableNoteFlag, { backgroundColor: '#2196F3' }]}>
                                <Ionicons name="document-text-outline" size={responsive.responsiveWidth(12)} color="#fff" />
                              </View>
                            )}
                          </View>
                          <Text style={[styles.tableCellText, { color: colors.onSurface }]} numberOfLines={2}>
                            {venta.nota || ''}
                          </Text>
                        </View>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                          {venta.ventas?.[0]?.servicioTienda?.tienda?.nombre || 'N/A'}
                        </Text>
                        {!venta.is_deuda && (
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                            {venta.operaciones?.[0]?.usuario?.nombre_natural || 'N/A'}
                          </Text>
                        )}
                        {venta.is_deuda && (
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                            -
                          </Text>
                        )}
                        {venta.is_deuda && venta.deuda && (
                          <View style={[styles.tableCellText, { width: responsive.responsiveWidth(150) }]}>
                            <Text style={{ color: colors.onSurface }}>
                              {venta.deuda.cliente?.nombre || 'N/A'}
                            </Text>
                            {(venta.deuda.monto_restante_cup > 0 || venta.deuda.monto_restante_usd > 0) && (
                              <Text style={{ color: (venta.deuda.monto_restante_cup > 0 || venta.deuda.monto_restante_usd > 0) ? colors.error : '#4CAF50', fontSize: responsive.responsiveFontSize(10) }}>
                                Restante: ${((venta.deuda.monto_restante_cup || 0) + (venta.deuda.monto_restante_usd || 0)).toFixed(2)}
                              </Text>
                            )}
                          </View>
                        )}
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                          {(() => {
                            const totalCUP = (parseFloat(venta.cantidad_cobrada_efectivo_cup || 0) + parseFloat(venta.cantidad_cobrada_transferencia_cup || 0));
                            return totalCUP > 0 ? `$${totalCUP.toFixed(2)}` : '-';
                          })()}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                          {(() => {
                            const totalUSD = (parseFloat(venta.cantidad_cobrada_efectivo_usd || 0) + parseFloat(venta.cantidad_cobrada_transferencia_usd || 0));
                            return totalUSD > 0 ? `$${totalUSD.toFixed(2)}` : '-';
                          })()}
                        </Text>
                        <View style={[styles.tableCellWithFlags, { width: responsive.responsiveWidth(200) }]}>
                          <View style={styles.paymentTypesContainer}>
                            {getPaymentTypes(venta).map((paymentType, idx) => (
                              <View 
                                key={idx} 
                                style={[styles.paymentTypeBadge, { backgroundColor: isDarkMode ? `${paymentType.color}33` : `${paymentType.color}22`, borderColor: paymentType.color }]}
                              >
                                <Text style={[styles.paymentTypeText, { color: paymentType.color }]}>
                                  {paymentType.label}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                          {formatCubaDate(venta.fecha_hora)}
                        </Text>
                        {canManageVentas && (
                          <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                            <View style={styles.tableActionsRow}>
                              <TouchableOpacity
                                style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleEdit(venta);
                                }}
                              >
                                <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleDelete(venta);
                                }}
                              >
                                <Ionicons name="trash-outline" size={responsive.responsiveWidth(18)} color={colors.error} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => setPagination(prev => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                  disabled={pagination.currentPage === 1 || isSearching}
                >
                  <Ionicons name="chevron-back" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                </TouchableOpacity>
                {isSearching ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => setPagination(prev => ({ ...prev, currentPage: Math.min(pagination.totalPages, prev.currentPage + 1) }))}
                  disabled={pagination.currentPage === pagination.totalPages || isSearching}
                >
                  <Ionicons name="chevron-forward" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )} 
      </ScrollView>
      </KeyboardAvoidingView>

      {/* QR Modal for Transfermovil */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]} >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Realizar transferencia por Transfermovil
              </Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            {selectedCuenta && (
              <View style={styles.qrContainer}>
                <View style={styles.qrCodeWrapper}>
                  <QRCode
                    value={getTransfermovilQRContent(selectedCuenta)}
                    size={responsive.responsiveWidth(200)}
                    color="black"
                    backgroundColor="white"
                    logo={require('../../assets/Logos/Abacus_sinFondo v1.png')}
                    logoSize={responsive.responsiveWidth(40)}
                    logoBackgroundColor="white"
                    logoMargin={responsive.responsiveWidth(5)}
                  />
                </View>
                <Text style={[styles.cuentaInfoText, { color: colors.outline }]}>
                  {selectedCuenta.nombre}
                </Text>
                {selectedCuenta.num_cuenta && (
                  <Text style={[styles.cuentaNumberText, { color: colors.outline, fontWeight: '700' }]}>
                    {selectedCuenta.num_cuenta}
                  </Text>
                )}
                <Text style={[styles.cuentaFondoText, { color: getCuentaTypeColor(selectedCuenta.tipo_cuenta) }]}>
                  Fondo: {formatNumberWithSpaces(selectedCuenta.fondo || 0)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Order Selection Modal for Excel Export */}
      <Modal
        visible={showOrderSelectionModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOrderSelectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Ordenar por
              </Text>
              <TouchableOpacity onPress={() => setShowOrderSelectionModal(false)}>
                <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.orderOptionsScroll}>
              {[
                { value: 'fecha_hora', label: 'Fecha y Hora' },
                { value: 'nombre_producto', label: 'Nombre de Producto' },
                { value: 'forma_cobro', label: 'Forma de Cobro' },
                { value: 'nombre_usuario', label: 'Nombre de Usuario' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.orderOptionItem,
                    { 
                      backgroundColor: colors.surfaceVariant,
                      borderColor: selectedOrderField === option.value ? colors.primary : 'transparent',
                      borderWidth: 2,
                    }
                  ]}
                  onPress={() => setSelectedOrderField(option.value)}
                >
                  <View style={[styles.radioButton, { borderColor: colors.outlineVariant }]}>
                    {selectedOrderField === option.value && (
                      <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                  <Text style={[styles.orderOptionText, { color: colors.onSurface }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.exportConfirmButton, { backgroundColor: colors.primary }]}
              onPress={exportVentasToExcel}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.exportConfirmButtonText, { color: '#fff' }]}>Generar Excel</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default function VentasScreen() {
  return <VentasContent />;
}

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  pageTitleContainer: {
    marginTop: responsive.responsiveMargin(58),
    marginBottom: responsive.responsiveMargin(20),
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: responsive.responsiveFontSize(24),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  filterCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  filterTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  expandButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  filterGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  filterRow: {
    flexDirection: 'row',
  },
  switchContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveWidth(8),
  },
  switchOption: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(8),
    borderRadius: 8,
    borderWidth: 1,
    minWidth: responsive.responsiveWidth(60),
    alignItems: 'center',
  },
  switchOptionText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  label: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  inputText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
  },
  dropdownText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: responsive.responsiveHeight(200),
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(150),
  },
  summaryCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  summaryTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  summaryGridContainer: {
    gap: responsive.responsiveMargin(6),
  },
  summaryItem: {
    flex: 1,
    minWidth: responsive.responsiveWidth(100),
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    padding: responsive.responsivePadding(10),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  summaryItemGreen: {
    borderColor: 'rgba(76, 175, 80, 0.2)',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  summaryItemBlue: {
    borderColor: 'rgba(33, 150, 243, 0.2)',
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
  },
  summaryItemOrange: {
    borderColor: 'rgba(255, 152, 0, 0.2)',
    backgroundColor: 'rgba(255, 152, 0, 0.05)',
  },
  summaryItemPurple: {
    borderColor: 'rgba(156, 39, 176, 0.2)',
    backgroundColor: 'rgba(156, 39, 176, 0.05)',
  },
  summaryItemLabel: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(2),
    textAlign: 'center',
  },
  summaryItemValue: {
    fontSize: responsive.responsiveFontSize(13),
    fontWeight: '700',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  dropdownSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(8),
    marginBottom: responsive.responsiveMargin(4),
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(4),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
    paddingVertical: 0,
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(16),
    gap: responsive.responsiveMargin(8),
  },
  dropdownLoadingText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  filterActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(8),
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  clearButton: {
    borderWidth: 1,
  },
  searchButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(16),
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    flexShrink: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  errorCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    alignItems: 'center',
  },
  errorText: {
    marginTop: responsive.responsiveMargin(16),
    marginBottom: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  emptyCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(40),
    alignItems: 'center',
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  ventaCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noteFlag: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
    borderRadius: responsive.responsiveWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  ventaInfo: {
    flex: 1,
  },
  ventaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  ventaNota: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  ventaTienda: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  ventaUsuario: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  ventaCantidad: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  deudaInfoContainer: {
    marginTop: responsive.responsiveMargin(4),
  },
  deudaAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: responsive.responsiveMargin(2),
  },
  deudaLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  deudaAmount: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cantidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(2),
  },
  ventaFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  ventaActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  actionButtonSmall: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconSmall: {
    width: responsive.responsiveWidth(22),
    height: responsive.responsiveHeight(22),
  },
  editButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tableActionsCell: {
    justifyContent: 'center',
  },
  tableActionsRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  tableActionButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableEditButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tableDeleteButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(24),
    marginBottom: responsive.responsiveMargin(24),
  },
  paginationButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  paginationText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  tableScrollView: {
    marginBottom: responsive.responsiveMargin(16),
  },
  tableContainer: {
    minWidth: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(8),
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tableHeaderText: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  tableCellText: {
    fontSize: responsive.responsiveFontSize(13),
    fontFamily: 'Inter',
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableCellWithFlags: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsivePadding(8),
  },
  tableFlagsContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(4),
    marginRight: responsive.responsiveMargin(6),
  },
  tableNoteFlag: {
    width: responsive.responsiveWidth(18),
    height: responsive.responsiveHeight(18),
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsive.responsiveMargin(4),
  },
  paymentTypeBadge: {
    paddingHorizontal: responsive.responsivePadding(6),
    paddingVertical: responsive.responsivePadding(2),
    borderRadius: 4,
    borderWidth: 1,
  },
  paymentTypeText: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cardPaymentTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsive.responsiveMargin(4),
    marginTop: responsive.responsiveMargin(4),
  },
  cardPaymentTypeBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(3),
    borderRadius: 6,
    borderWidth: 1,
  },
  cardPaymentTypeText: {
    fontSize: responsive.responsiveFontSize(11),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsive.responsivePadding(20),
  },
  modalContent: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '100%',
    maxWidth: responsive.responsiveWidth(350),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(20),
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    flex: 1,
  },
  qrContainer: {
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
  },
  qrCodeWrapper: {
    padding: responsive.responsivePadding(16),
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  cuentaInfoText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  cuentaNumberText: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '700',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  cuentaFondoText: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '500',
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(16),
  },
  exportButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#fff',
  },
  orderOptionsScroll: {
    maxHeight: responsive.responsiveHeight(200),
    marginBottom: responsive.responsiveMargin(16),
  },
  orderOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(8),
  },
  radioButton: {
    width: responsive.responsiveWidth(20),
    height: responsive.responsiveWidth(20),
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: responsive.responsiveWidth(10),
    height: responsive.responsiveWidth(10),
    borderRadius: 5,
  },
  orderOptionText: {
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
    flex: 1,
  },
  exportConfirmButton: {
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
  },
  exportConfirmButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

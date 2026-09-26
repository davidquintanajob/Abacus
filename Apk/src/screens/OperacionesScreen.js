import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Keyboard, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { getOperaciones, deleteOperacion, createOperacion } from '../services/operacionService';
import { getCuentas } from '../services/cuentaService';
import configService from '../services/configService';
import { getUsuarios } from '../services/usuarioService';
import { getTiendas } from '../services/tiendaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const OperacionesContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, operacionAccessLevels, operacionManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [operaciones, setOperaciones] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [userTiendaReady, setUserTiendaReady] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isFirstFocus = useRef(true);
  const isInitializedRef = useRef(false);
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

  // Get summary values based on selected currency and account type
  const getSummaryValues = () => {
    if (!summary) return { ingresos: 0, retiros: 0, ingresosVenta: 0 };
    
    const currency = selectedCurrency; // 'CUP' or 'USD'
    
    // If no account is selected, sum both Efectivo and Transferencia
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
    
    // If account is selected, use specific account type
    const accountType = selectedAccountType; // 'Efectivo' or 'Transferencia'
    const keyPrefix = `totalIngreso${accountType}${currency}`;
    const retiroKey = `totalRetiro${accountType}${currency}`;
    const ventaKey = `totalIngresoVenta${accountType}${currency}`;
    
    return {
      ingresos: summary[keyPrefix] || 0,
      retiros: summary[retiroKey] || 0,
      ingresosVenta: summary[ventaKey] || 0
    };
  };

  // Filter states
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
  const [cuentas, setCuentas] = useState([]);
  const [users, setUsers] = useState([]);
  const [tiendas, setTiendas] = useState([]);
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
  const [showTipoOperacionDropdown, setShowTipoOperacionDropdown] = useState(false);
  const [showFechaDesdePicker, setShowFechaDesdePicker] = useState(false);
  const [showFechaHastaPicker, setShowFechaHastaPicker] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('CUP'); // 'CUP' or 'USD'
  const [selectedAccountType, setSelectedAccountType] = useState('Efectivo'); // 'Efectivo' or 'Transferencia'

  // Transfer modal states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferFormData, setTransferFormData] = useState({
    cuentaOrigen: null,
    cuentaDestino: null,
    cantidad: '',
    motivo: '',
  });
  const [showCuentaOrigenDropdown, setShowCuentaOrigenDropdown] = useState(false);
  const [showCuentaDestinoDropdown, setShowCuentaDestinoDropdown] = useState(false);
  const [cuentaOrigenSearchText, setCuentaOrigenSearchText] = useState('');
  const [cuentaDestinoSearchText, setCuentaDestinoSearchText] = useState('');
  const [allCuentas, setAllCuentas] = useState([]);
  const [config, setConfig] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    setIsInitialized(true);
    fetchConfig();
  }, []);

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

  useEffect(() => {
    if (user?.id_tienda) {
      const userTienda = {
        id_tienda: user.id_tienda,
        nombre: user.tienda?.nombre || `Tienda ${user.id_tienda}`
      };
      setTiendas([userTienda]);
      // Set tienda filter on initial load only if user hasn't interacted with it yet
      if (!hasUserInteractedWithTiendaFilter.current) {
        setFilters(prev => ({ ...prev, id_tienda: user.id_tienda.toString() }));
      }
      setUserTiendaReady(true);
      setIsInitialized(true);
    }
  }, [user?.id_tienda]);

  useFocusEffect(
    React.useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (isInitializedRef.current) {
        const restoreFilters = async () => {
          try {
            const savedFilters = await AsyncStorage.getItem('operaciones_filters');
            if (savedFilters) {
              const parsedFilters = JSON.parse(savedFilters);
              setFilters(parsedFilters);
              fetchOperaciones(null, parsedFilters);
            } else {
              // Only restore user's tienda filter if it's empty and user has a tienda
              const shouldRestore = !filtersRef.current.id_tienda && userTiendaRef.current;
              if (shouldRestore) {
                setFilters(prev => ({ ...prev, id_tienda: userTiendaRef.current.toString() }));
                fetchOperaciones(userTiendaRef.current.toString());
              } else {
                fetchOperaciones();
              }
            }
          } catch (error) {
            console.error('Error restoring filters:', error);
            fetchOperaciones();
          }
        };
        restoreFilters();
      }
    }, [])
  );

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
      const userRole = user?.rol?.toLowerCase();
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && operacionAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && operacionAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && operacionAccessLevels?.economico === 'all_stores');

      let allTiendas = [];
      
      if (isOfflineMode) {
        // En modo offline, cargar tiendas de AsyncStorage
        allTiendas = [];
      } else {
        // En modo online, cargar tiendas de la API
        const data = await getTiendas({}, 1, 1000);
        allTiendas = data.data || [];
      }
      
      // Always default to user's store if they have one
      if (user?.id_tienda) {
        // If user can view all stores, show all stores in dropdown
        // If user cannot view all stores, show only their store
        if (canViewAllStores) {
          setTiendas(allTiendas);
        } else {
          const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
          setTiendas(userTienda ? [userTienda] : []);
        }
      } else {
        setTiendas(allTiendas);
      }
      setHasLoadedAllTiendas(true);
    } catch (err) {
      if (!isOfflineMode) {
        setTiendas([]);
      }
    } finally {
      setIsLoadingTiendas(false);
    }
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

  const fetchOperaciones = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setOperaciones([]);
        setIsLoading(false);
        return;
      }

      const userRole = user?.rol?.toLowerCase();
      const canViewAllOperaciones =
        userRole === 'administrador' ||
        (userRole === 'dependiente' && operacionAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && operacionAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && operacionAccessLevels?.economico === 'all_stores');

      const filtersToUse = overrideFilters || filters;

      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;

      // Build filters to send to API
      const apiFilters = { ...filtersToUse };

      // Adjust date filters for Cuba timezone before sending to backend
      const adjustedFilters = adjustFiltersForCubaTimezone(apiFilters);

      const data = await getOperaciones(adjustedFilters, fetchPage, fetchLimit);
      let operaciones = data.data || [];

      setOperaciones(operaciones);
      setPagination(data.pagination || pagination);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  // Single API call when all data is ready
  useEffect(() => {
    if (userTiendaReady && !hasDoneInitialFetch.current) {
      fetchOperaciones();
      hasDoneInitialFetch.current = true;
    }
  }, [userTiendaReady]);

  useEffect(() => {
    if (isInitialized && !hasDoneInitialFetch.current && !user?.id_tienda) {
      fetchOperaciones();
      hasDoneInitialFetch.current = true;
    }
  }, [isInitialized]);

  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchOperaciones();
    }
  }, [pagination.currentPage]);

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
    
    // Send cleared filters directly to API to avoid state issues
    fetchOperaciones(clearedFilters);
  };

  const handleDelete = (operacion) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Operación',
      `¿Estás seguro de que quieres eliminar esta operación?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteOperacion(operacion.id_operacion);
              showToast({ type: 'success', message: 'Operación eliminada correctamente' });
              fetchOperaciones();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleOperacionPress = (operacion) => {
    if (isOfflineMode) {
      navigation.navigate('OperacionForm', { operacion, mode: 'view' });
      return;
    }
    
    AsyncStorage.setItem('operaciones_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    const openMode = canManageOperaciones ? 'edit' : 'view';
    navigation.navigate('OperacionForm', { operacion, mode: openMode });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }

    AsyncStorage.setItem('operaciones_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });

    navigation.navigate('OperacionForm', {
      mode: 'add',
      canViewAllOperaciones: canViewAllOperaciones
    });
  };

  const handleTransfer = async () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    // Load all cuentas for the transfer modal
    try {
      const data = await getCuentas({}, 1, 1000);
      setAllCuentas(data.data || []);
      setShowTransferModal(true);
    } catch (err) {
      showToast({ type: 'error', message: 'Error al cargar las cuentas' });
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

      // Apply currency conversion if transferring between CUP and USD
      if (isOrigenCUP && isDestinoUSD) {
        // CUP to USD: divide by exchange rate
        cantidadDestino = cantidad / cambio;
      } else if (isOrigenUSD && isDestinoCUP) {
        // USD to CUP: multiply by exchange rate
        cantidadDestino = cantidad * cambio;
      }

      // Create retiro operation for origin account
      const operacionOrigen = {
        id_cuenta: transferFormData.cuentaOrigen.id_cuenta,
        id_usuario: user.id_usuario,
        cantidad_operacion: cantidadOrigen,
        tipo_operacion: 'Retiro',
        fecha_hora: new Date().toISOString(),
        motivo: `Transferencia a ${transferFormData.cuentaDestino.nombre}. ${transferFormData.motivo}`,
        cambio_moneda: cambio,
      };

      // Create ingreso operation for destination account
      const operacionDestino = {
        id_cuenta: transferFormData.cuentaDestino.id_cuenta,
        id_usuario: user.id_usuario,
        cantidad_operacion: cantidadDestino,
        tipo_operacion: 'Ingreso',
        fecha_hora: new Date().toISOString(),
        motivo: `Transferencia de ${transferFormData.cuentaOrigen.nombre}. ${transferFormData.motivo}`,
        cambio_moneda: cambio,
      };

      // Execute both operations
      await Promise.all([
        createOperacion(operacionOrigen),
        createOperacion(operacionDestino),
      ]);

      showToast({ type: 'success', message: 'Transferencia realizada correctamente' });
      setShowTransferModal(false);
      setTransferFormData({
        cuentaOrigen: null,
        cuentaDestino: null,
        cantidad: '',
        motivo: '',
      });
      setCuentaOrigenSearchText('');
      setCuentaDestinoSearchText('');
      fetchOperaciones();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Error al realizar la transferencia' });
    } finally {
      setIsTransferring(false);
    }
  };

  // Calculate expected fund after transfer
  const calculateExpectedFund = (cuenta, isOrigin, cantidad) => {
    if (!cuenta || !cantidad) return null;
    const currentFund = parseFloat(cuenta.fondo || 0);
    const amount = parseFloat(cantidad);
    const cambio = exchangeRate || 1;

    const cuentaTipo = cuenta.tipo_cuenta;
    const isCUP = cuentaTipo.includes('CUP');
    const isUSD = cuentaTipo.includes('USD');

    let adjustedAmount = amount;

    // If transferring between different currencies, convert the amount
    if (isOrigin) {
      // Origin account: always subtract the amount in its own currency
      adjustedAmount = amount;
    } else {
      // Destination account: add converted amount
      const origenTipo = transferFormData.cuentaOrigen?.tipo_cuenta || '';
      const isOrigenCUP = origenTipo.includes('CUP');
      const isOrigenUSD = origenTipo.includes('USD');

      if (isOrigenCUP && isUSD) {
        adjustedAmount = amount / cambio;
      } else if (isOrigenUSD && isCUP) {
        adjustedAmount = amount * cambio;
      }
    }

    if (isOrigin) {
      return currentFund - adjustedAmount;
    } else {
      return currentFund + adjustedAmount;
    }
  };

  const handleCuentasPress = () => {
    navigation.navigate('Cuentas');
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    // Notificaciones
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
  };

  const handleNextPage = () => {
    if (pagination.currentPage < pagination.totalPages) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }));
      fetchOperaciones();
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
      fetchOperaciones();
    }
  };

  const handleFechaDesdeChange = (event, selectedDate) => {
    setShowFechaDesdePicker(false);
    if (event.type === 'set' && selectedDate) {
      setFilters(prev => ({ ...prev, fecha_desde: formatLocalDate(selectedDate) }));
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowFechaHastaPicker(false);
    if (event.type === 'set' && selectedDate) {
      setFilters(prev => ({ ...prev, fecha_hasta: formatLocalDate(selectedDate) }));
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

  const userRole = user?.rol?.toLowerCase();
  const canViewAllStores = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && operacionAccessLevels?.dependiente === 'all_stores') ||
    (userRole === 'almacenero' && operacionAccessLevels?.almacenero === 'all_stores') ||
    (userRole === 'económico' && operacionAccessLevels?.economico === 'all_stores');

  const getOperacionTypeColor = (tipo) => {
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

  const canViewAllOperaciones = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && operacionAccessLevels?.dependiente === 'all_stores') ||
    (userRole === 'almacenero' && operacionAccessLevels?.almacenero === 'all_stores') ||
    (userRole === 'económico' && operacionAccessLevels?.economico === 'all_stores');

  const canManageOperaciones = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && operacionManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && operacionManagePermissions?.almacenero) ||
    (userRole === 'económico' && operacionManagePermissions?.economico);

  const styles = createStyles(responsive);

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          title="Operaciones"
          onMenuPress={() => setSidebarOpen(true)}
          onThemePress={toggleTheme}
          onSettingsPress={undefined}
          onNotificationsPress={handleNotificationsPress}
          onProfilePress={handleProfilePress}
          onViewModeToggle={toggleViewMode}
          showViewToggle={true}
          viewMode={viewMode}
          isChangingView={isChangingView}
          isDark={isDarkMode}
          showLogo={true}
        />
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          navigation={navigation}
          currentRoute="Operaciones"
        />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={styles.content}
        keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01}
        enabled={true}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Operaciones</Text>
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
            <Text style={[styles.label, { color: colors.outline }]}>Cuenta</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar cuenta..."
              value={filters.nombre_cuenta}
              onChangeText={(text) => {
                setFilters(prev => ({ ...prev, nombre_cuenta: text }));
                setCuentaSearchText(text);
              }}
              onFocus={() => {
                setShowCuentaDropdown(true);
                if (!hasLoadedAllCuentas && !isLoadingCuentas) {
                  fetchAllCuentas();
                }
              }}
            />
            {showCuentaDropdown && (
              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                {isLoadingCuentas && (
                  <View style={styles.dropdownLoadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando cuentas...</Text>
                  </View>
                )}
                {!isLoadingCuentas && (
                  <>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        const newFilters = { ...filters, id_cuenta: null, nombre_cuenta: '' };
                        setFilters(newFilters);
                        setCuentaSearchText('');
                        setShowCuentaDropdown(false);
                        // Reset to default when no account is selected
                        setSelectedCurrency('CUP');
                        setSelectedAccountType('Efectivo');
                        fetchOperaciones(newFilters);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las cuentas</Text>
                    </TouchableOpacity>
                    {filteredCuentas.length > 0 ? (
                      filteredCuentas.map((cuenta, index) => (
                        <TouchableOpacity
                          key={cuenta.id_cuenta}
                          style={[styles.dropdownItem, index === filteredCuentas.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            const newFilters = { ...filters, id_cuenta: cuenta.id_cuenta, nombre_cuenta: cuenta.nombre };
                            setFilters(newFilters);
                            setCuentaSearchText(cuenta.nombre);
                            setShowCuentaDropdown(false);
                            // Detect currency and account type from selected account
                            const accountType = cuenta.tipo_cuenta || 'Efectivo CUP';
                            const currency = accountType.includes('USD') ? 'USD' : 'CUP';
                            const type = accountType.includes('Transferencia') ? 'Transferencia' : 'Efectivo';
                            setSelectedCurrency(currency);
                            setSelectedAccountType(type);
                            fetchOperaciones(newFilters);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                          <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>
                            {cuenta.tipo_cuenta} • Fondo: {parseFloat(cuenta.fondo || 0).toFixed(2)}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No hay cuentas</Text>
                    )}
                  </>
                )}
              </View>
            )}
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
              onPress={() => {
                if (canViewAllStores) {
                  setShowTiendaDropdown(!showTiendaDropdown);
                  // Lazy load all tiendas when dropdown is opened
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
                  {canViewAllStores && (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        const newFilters = { ...filters, id_tienda: '' };
                        setFilters(newFilters);
                        setShowTiendaDropdown(false);
                        setTiendaSearchText('');
                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                        hasUserInteractedWithTiendaFilter.current = true;
                        fetchOperaciones(newFilters);
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
                          const newFilters = { ...filters, id_tienda: newIdTienda };
                          setFilters(newFilters);
                          setShowTiendaDropdown(false);
                          setTiendaSearchText('');
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          hasUserInteractedWithTiendaFilter.current = true;
                          fetchOperaciones(newFilters);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No hay tiendas</Text>
                  )}
                </>
              )}
            </View>
          )}
        </View>

          {showAdvancedFilters && (
            <>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Usuario</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar usuario..."
                  value={filters.nombre_usuario}
                  onChangeText={(text) => {
                    setFilters(prev => ({ ...prev, nombre_usuario: text }));
                    setUserSearchText(text);
                  }}
                  onFocus={() => {
                    setShowUserDropdown(true);
                    if (!hasLoadedAllUsers && !isLoadingUsers) {
                      fetchAllUsers();
                    }
                  }}
                />
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
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            const newFilters = { ...filters, id_usuario: null, nombre_usuario: '' };
                            setFilters(newFilters);
                            setUserSearchText('');
                            setShowUserDropdown(false);
                            fetchOperaciones(newFilters);
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
                                const newFilters = { ...filters, id_usuario: userItem.id_usuario, nombre_usuario: userItem.nombre_natural };
                                setFilters(newFilters);
                                setUserSearchText(userItem.nombre_natural);
                                setShowUserDropdown(false);
                                fetchOperaciones(newFilters);
                              }}
                            >
                              <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{userItem.nombre_natural}</Text>
                              <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>
                                {userItem.rol}
                              </Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No hay usuarios</Text>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tipo de Operación</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowTipoOperacionDropdown(!showTipoOperacionDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: filters.tipo_operacion ? colors.onSurface : colors.outline }]}>
                    {filters.tipo_operacion || 'Todos los tipos'}
                  </Text>
                  <Ionicons 
                    name={showTipoOperacionDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                {showTipoOperacionDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        const newFilters = { ...filters, tipo_operacion: '' };
                        setFilters(newFilters);
                        setShowTipoOperacionDropdown(false);
                        fetchOperaciones(newFilters);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los tipos</Text>
                    </TouchableOpacity>
                    <ScrollView
                      nestedScrollEnabled={true}
                      style={{ maxHeight: 200 }}
                    >
                      {tiposOperacion.map((tipo, index) => (
                        <TouchableOpacity
                          key={tipo}
                          style={[styles.dropdownItem, index === tiposOperacion.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            const newFilters = { ...filters, tipo_operacion: tipo };
                            setFilters(newFilters);
                            setShowTipoOperacionDropdown(false);
                            fetchOperaciones(newFilters);
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
                    keyboardType="decimal-pad"
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
                    keyboardType="decimal-pad"
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
                      value={filters.fecha_desde ? new Date(filters.fecha_desde) : new Date()}
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
                      value={filters.fecha_hasta ? new Date(filters.fecha_hasta) : new Date()}
                      mode="date"
                      display="default"
                      onChange={handleFechaHastaChange}
                    />
                  )}
                </View>
              </View>
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
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="search-outline" size={responsive.responsiveWidth(18)} color="#fff" />
                  <Text style={[styles.filterButtonText, { color: '#fff' }]}>Buscar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Card>

        {/* Summary Card */}
        {summary && (
          <Card style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryTitle, { color: colors.onSurface }]}>Resumen de Operaciones</Text>
              {!filters.id_cuenta ? (
                <View style={[styles.currencyToggle, { backgroundColor: colors.background }]}>
                  <TouchableOpacity
                    style={[styles.currencyToggleButton, selectedCurrency === 'CUP' && { backgroundColor: colors.primary }]}
                    onPress={() => setSelectedCurrency('CUP')}
                  >
                    <Text style={[styles.currencyToggleText, selectedCurrency === 'CUP' ? { color: '#fff' } : { color: colors.outline }]}>CUP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.currencyToggleButton, selectedCurrency === 'USD' && { backgroundColor: colors.primary }]}
                    onPress={() => setSelectedCurrency('USD')}
                  >
                    <Text style={[styles.currencyToggleText, selectedCurrency === 'USD' ? { color: '#fff' } : { color: colors.outline }]}>USD</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.currencyBadge, { backgroundColor: selectedCurrency === 'USD' ? '#16A34A' : colors.primary }]}>
                  <Text style={styles.currencyBadgeText}>{selectedCurrency}</Text>
                </View>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.summaryGridContainer}
            >
              <View style={[styles.summaryItem, styles.summaryItemGreen]}>
                <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>Ingresos Manuales</Text>
                <Text style={[styles.summaryItemValue, { color: '#4CAF50' }]}>
                  {formatNumberWithSpaces(getSummaryValues().ingresos)}
                </Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryItemRed]}>
                <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>Retiros Manuales</Text>
                <Text style={[styles.summaryItemValue, { color: '#F44336' }]}>
                  {formatNumberWithSpaces(getSummaryValues().retiros)}
                </Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryItemBlue]}>
                <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>Ingresos por Venta</Text>
                <Text style={[styles.summaryItemValue, { color: '#2196F3' }]}>
                  {formatNumberWithSpaces(getSummaryValues().ingresosVenta)}
                </Text>
              </View>
              <View style={[styles.summaryItem, styles.summaryItemPrimary]}>
                <Text style={[styles.summaryItemLabel, { color: colors.outline }]}>Cantidad en Negocio</Text>
                <Text style={[styles.summaryItemValue, { color: colors.primary }]}>
                  {formatNumberWithSpaces(getSummaryValues().ingresos + getSummaryValues().ingresosVenta - getSummaryValues().retiros)}
                </Text>
              </View>
            </ScrollView>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={handleCuentasPress}
            >
              <Ionicons name="wallet-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>Gestionar Cuentas</Text>
            </TouchableOpacity>
            {!isOfflineMode && canManageOperaciones && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleAdd}
              >
                <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Agregar Operación</Text>
              </TouchableOpacity>
            )}
          </View>
          {!isOfflineMode && isAdmin && (
            <TouchableOpacity
              style={[styles.actionButton, styles.fullWidthButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
              onPress={handleTransfer}
            >
              <Ionicons name="swap-horizontal-outline" size={responsive.responsiveWidth(20)} color={isDarkMode ? colors.primary : '#1976D2'} />
              <Text style={[styles.actionButtonText, { color: isDarkMode ? colors.primary : '#1976D2' }]}>Transferir</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Operations List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando operaciones...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchOperaciones}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : operaciones.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={responsive.responsiveWidth(40)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No hay operaciones registradas
            </Text>
          </View>
        ) : (
          <>
            {viewMode === 'card' ? (
              operaciones.map((operacion) => (
                <TouchableOpacity
                  key={operacion.id_operacion}
                  onPress={() => handleOperacionPress(operacion)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.operacionCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.operacionInfo}>
                      <View style={styles.operacionHeader}>
                        <Text style={[styles.operacionCuenta, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                          {operacion.cuenta?.nombre || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.operacionTypeRow}>
                        <View style={[styles.typeBadge, { backgroundColor: getOperacionTypeColor(operacion.tipo_operacion).bgColor, borderColor: getOperacionTypeColor(operacion.tipo_operacion).borderColor }]}>
                          <Text style={[styles.typeBadgeText, { color: getOperacionTypeColor(operacion.tipo_operacion).color }]}>
                            {getOperacionTypeColor(operacion.tipo_operacion).label}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.operacionUsuario, { color: colors.outline }]}>
                        Usuario: {operacion.usuario?.nombre_natural || 'N/A'}
                      </Text>
                      <Text style={[styles.operacionMonto, { color: colors.primary }]}>
                        Cantidad: {parseFloat(operacion.cantidad_operacion || 0).toFixed(2)}
                      </Text>
                      <Text style={[styles.operacionTipoCuenta, { color: colors.outline }]}>
                        Tipo Cuenta: {operacion.cuenta?.tipo_cuenta || 'N/A'}
                      </Text>
                      {operacion.motivo && (
                        <Text style={[styles.operacionMotivo, { color: colors.outline }]}>
                          Motivo: {operacion.motivo}
                        </Text>
                      )}
                      <Text style={[styles.operacionFecha, { color: colors.outline }]}>
                        Fecha: {new Date(operacion.fecha_hora).toLocaleString()}
                      </Text>
                    </View>
                    {canManageOperaciones && (
                      <View style={styles.operacionActions}>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleOperacionPress(operacion);
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
                            handleDelete(operacion);
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
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Fecha</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Cuenta</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Tipo</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Cantidad</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Tipo Cuenta</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Usuario</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Motivo</Text>
                    {canManageOperaciones && (
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                    )}
                  </View>
                  {operaciones.map((operacion, index) => {
                    const typeStyle = getOperacionTypeColor(operacion.tipo_operacion);
                    return (
                      <TouchableOpacity
                        key={operacion.id_operacion}
                        onPress={() => handleOperacionPress(operacion)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                            {new Date(operacion.fecha_hora).toLocaleDateString()}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                            {operacion.cuenta?.nombre || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: typeStyle.color, width: responsive.responsiveWidth(120) }]}>{typeStyle.label}</Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                            {parseFloat(operacion.cantidad_operacion || 0).toFixed(2)}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]} numberOfLines={1}>
                            {operacion.cuenta?.tipo_cuenta || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]} numberOfLines={1}>
                            {operacion.usuario?.nombre_natural || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                            {operacion.motivo || '-'}
                          </Text>
                          {canManageOperaciones && (
                            <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                              <View style={styles.tableActionsRow}>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleOperacionPress(operacion);
                                  }}
                                >
                                  <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDelete(operacion);
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={responsive.responsiveWidth(18)} color={colors.error} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={handlePrevPage}
                  disabled={pagination.currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
                </TouchableOpacity>
                <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                  Página {pagination.currentPage} de {pagination.totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={handleNextPage}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Transfer Modal */}
      <Modal
        visible={showTransferModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          // Allow closing with back button on Android, but not from keyboard
          // The modal should primarily close via the X button or submit button
          if (Platform.OS === 'android') {
            setShowTransferModal(false);
          }
        }}
        statusBarTranslucent={true}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Transferir entre Cuentas</Text>
                <TouchableOpacity onPress={() => setShowTransferModal(false)}>
                  <Ionicons name="close" size={24} color={colors.onSurface} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Cuenta Origen */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cuenta Origen *</Text>
                  <TouchableOpacity
                    style={[styles.dropdown, styles.modalInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                    onPress={() => setShowCuentaOrigenDropdown(!showCuentaOrigenDropdown)}
                  >
                    <Text style={[styles.dropdownText, { color: cuentaOrigenSearchText ? colors.onSurface : colors.outline }]}>
                      {cuentaOrigenSearchText || 'Seleccionar cuenta origen'}
                    </Text>
                    <Ionicons
                      name={showCuentaOrigenDropdown ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.outline}
                    />
                  </TouchableOpacity>

                  {showCuentaOrigenDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                        {allCuentas
                          .filter(cuenta => cuenta.id_cuenta !== transferFormData.cuentaDestino?.id_cuenta)
                          .map((cuenta) => (
                          <TouchableOpacity
                            key={cuenta.id_cuenta}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setTransferFormData(prev => ({ ...prev, cuentaOrigen: cuenta }));
                              setCuentaOrigenSearchText(cuenta.nombre);
                              setShowCuentaOrigenDropdown(false);
                            }}
                          >
                            <View style={styles.cuentaDropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                              <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>{cuenta.tipo_cuenta}</Text>
                              <Text style={[styles.dropdownItemFondo, { color: colors.primary }]}>
                                Fondo actual: {parseFloat(cuenta.fondo || 0).toFixed(2)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Show selected account info */}
                  {transferFormData.cuentaOrigen && !showCuentaOrigenDropdown && (
                    <View style={styles.selectedAccountInfo}>
                      <View style={styles.selectedAccountRow}>
                        <Text style={[styles.selectedAccountLabel, { color: colors.outline }]}>Fondo actual:</Text>
                        <Text style={[styles.selectedAccountValue, { color: colors.primary }]}>
                          {parseFloat(transferFormData.cuentaOrigen.fondo || 0).toFixed(2)}
                        </Text>
                      </View>
                      {transferFormData.cantidad && (
                        <View style={styles.selectedAccountRow}>
                          <Text style={[styles.selectedAccountLabel, { color: colors.outline }]}>Después de transferir:</Text>
                          <Text style={[styles.selectedAccountValue, { color: colors.primary }]}>
                            {calculateExpectedFund(transferFormData.cuentaOrigen, true, transferFormData.cantidad)?.toFixed(2) || '0.00'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Cuenta Destino */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cuenta Destino *</Text>
                  <TouchableOpacity
                    style={[styles.dropdown, styles.modalInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                    onPress={() => setShowCuentaDestinoDropdown(!showCuentaDestinoDropdown)}
                  >
                    <Text style={[styles.dropdownText, { color: cuentaDestinoSearchText ? colors.onSurface : colors.outline }]}>
                      {cuentaDestinoSearchText || 'Seleccionar cuenta destino'}
                    </Text>
                    <Ionicons
                      name={showCuentaDestinoDropdown ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={colors.outline}
                    />
                  </TouchableOpacity>

                  {showCuentaDestinoDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                        {allCuentas
                          .filter(cuenta => cuenta.id_cuenta !== transferFormData.cuentaOrigen?.id_cuenta)
                          .map((cuenta) => (
                          <TouchableOpacity
                            key={cuenta.id_cuenta}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setTransferFormData(prev => ({ ...prev, cuentaDestino: cuenta }));
                              setCuentaDestinoSearchText(cuenta.nombre);
                              setShowCuentaDestinoDropdown(false);
                            }}
                          >
                            <View style={styles.cuentaDropdownItem}>
                              <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                              <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>{cuenta.tipo_cuenta}</Text>
                              <Text style={[styles.dropdownItemFondo, { color: colors.primary }]}>
                                Fondo actual: {parseFloat(cuenta.fondo || 0).toFixed(2)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Show selected account info */}
                  {transferFormData.cuentaDestino && !showCuentaDestinoDropdown && (
                    <View style={styles.selectedAccountInfo}>
                      <View style={styles.selectedAccountRow}>
                        <Text style={[styles.selectedAccountLabel, { color: colors.outline }]}>Fondo actual:</Text>
                        <Text style={[styles.selectedAccountValue, { color: colors.primary }]}>
                          {parseFloat(transferFormData.cuentaDestino.fondo || 0).toFixed(2)}
                        </Text>
                      </View>
                      {transferFormData.cantidad && (
                        <View style={styles.selectedAccountRow}>
                          <Text style={[styles.selectedAccountLabel, { color: colors.outline }]}>Después de recibir:</Text>
                          <Text style={[styles.selectedAccountValue, { color: colors.primary }]}>
                            {calculateExpectedFund(transferFormData.cuentaDestino, false, transferFormData.cantidad)?.toFixed(2) || '0.00'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Cantidad */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cantidad *</Text>
                  <TextInput
                    style={[styles.input, styles.modalInput, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Ingrese la cantidad"
                    value={transferFormData.cantidad}
                    onChangeText={(text) => setTransferFormData(prev => ({ ...prev, cantidad: text }))}
                    keyboardType="numeric"
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </View>

                {/* Motivo */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Motivo</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Ingrese el motivo (opcional)"
                    value={transferFormData.motivo}
                    onChangeText={(text) => setTransferFormData(prev => ({ ...prev, motivo: text }))}
                    multiline
                    numberOfLines={3}
                    blurOnSubmit={false}
                  />
                </View>
              </ScrollView>

              {/* Submit Button - Fixed at bottom */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.primary }]}
                  onPress={handleTransferSubmit}
                  disabled={isTransferring}
                >
                  {isTransferring ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={[styles.submitButtonText, { color: '#fff' }]}>Realizar Transferencia</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Toast inside modal to ensure it appears on top */}
        {toast.visible && (
          <View style={{ position: 'absolute', top: 50, left: 20, right: 20, zIndex: 99999 }}>
            <Toast
              visible={toast.visible}
              type={toast.type}
              message={toast.message}
              code={toast.code}
              duration={toast.duration}
              onHide={hideToast}
              toastKey={toast.key}
            />
          </View>
        )}
      </Modal>
    </SafeAreaView>

    {/* Toast for when modal is not visible */}
    {!showTransferModal && (
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
    )}
  </>
  );
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    marginTop: responsive.headerHeight,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
  },
  pageTitleContainer: {
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(5),
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
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(8),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginLeft: responsive.responsiveMargin(8),
    paddingVertical: 0,
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(4),
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownItemSubtext: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginTop: 2,
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
  currencyBadge: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 20,
  },
  currencyBadgeText: {
    color: '#fff',
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  currencyToggle: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 2,
  },
  currencyToggleButton: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 18,
  },
  currencyToggleText: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  summaryGridContainer: {
    gap: responsive.responsiveMargin(6),
  },
  summaryItem: {
    flex: 1,
    minWidth: responsive.responsiveWidth(100),
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
    padding: responsive.responsivePadding(8),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  summaryItemGreen: {
    borderColor: 'rgba(76, 175, 80, 0.2)',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  summaryItemRed: {
    borderColor: 'rgba(244, 67, 54, 0.2)',
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
  },
  summaryItemBlue: {
    borderColor: 'rgba(33, 150, 243, 0.2)',
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
  },
  summaryItemPrimary: {
    borderColor: 'rgba(0, 0, 0, 0.1)',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  summaryIconContainer: {
    width: '100%',
    height: responsive.responsiveWidth(40),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(10),
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
  summaryTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: responsive.responsiveMargin(12),
  },
  summaryItem: {
    flex: 1,
    minWidth: responsive.responsiveWidth(120),
  },
  summaryLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  actionButtonsContainer: {
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(16),
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  fullWidthButton: {
    width: '100%',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(10),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: responsive.responsiveHeight(48),
  },
  actionButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    flexShrink: 1,
    textAlignVertical: 'center',
    lineHeight: responsive.responsiveWidth(20),
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
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
  tableActionsCell: {
    paddingHorizontal: responsive.responsivePadding(8),
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
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'center',
  },
  typeBadgeText: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  operacionCard: {
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
  operacionInfo: {
    flex: 1,
  },
  operacionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  operacionCuenta: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  operacionTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  operacionUsuario: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  operacionMonto: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  operacionTipoCuenta: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  montoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(2),
  },
  operacionMotivo: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  operacionFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  operacionActions: {
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
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(4),
  },
  cardLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  cardValue: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
    textAlign: 'right',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: responsive.responsiveMargin(8),
  },
  cardActionButton: {
    padding: responsive.responsivePadding(8),
    borderRadius: 6,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(16),
  },
  paginationButton: {
    padding: responsive.responsivePadding(8),
    borderRadius: 8,
    borderWidth: 1,
  },
  paginationText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  modalContent: {
    margin: responsive.responsiveMargin(20),
    borderRadius: 16,
    maxHeight: '85%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  modalScroll: {
    padding: responsive.responsivePadding(20),
    flex: 1,
    paddingBottom: responsive.responsivePadding(20),
  },
  modalFooter: {
    padding: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  modalInput: {
    height: responsive.responsiveHeight(42),
  },
  textArea: {
    height: responsive.responsiveHeight(60),
    textAlignVertical: 'top',
  },
  submitButton: {
    paddingVertical: responsive.responsivePadding(16),
    borderRadius: 8,
    alignItems: 'center',
    marginTop: responsive.responsiveMargin(8),
  },
  submitButtonText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cuentaDropdownItem: {
    paddingVertical: responsive.responsivePadding(8),
  },
  dropdownItemFondo: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
    marginTop: 2,
  },
  dropdownItemExpectedFondo: {
    fontSize: responsive.responsiveFontSize(11),
    fontFamily: 'Inter',
    marginTop: 2,
    fontStyle: 'italic',
  },
  selectedAccountInfo: {
    marginTop: responsive.responsiveMargin(8),
    padding: responsive.responsivePadding(12),
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 8,
  },
  selectedAccountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedAccountLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'Inter',
  },
  selectedAccountValue: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default OperacionesContent;

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Modal, Keyboard } from 'react-native';
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
import { getEntradas, deleteEntrada } from '../services/entradaService';
import { getTiendas } from '../services/tiendaService';
import { getUsuarios } from '../services/usuarioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { storageService } from '../services/storageService';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import ExportService from '../services/ExportService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, Camera } from 'expo-camera';
import BarcodeEngine from '../barcode/BarcodeEngine';
import { ALLOWED_BARCODE_TYPES } from '../barcode/config/BarcodeTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EntradasContent = () => {
  const navigation = useNavigation();
  
  // Initialize Barcode Engine
  const barcodeEngineRef = useRef(null);
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, entradaAccessLevels, entradaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [entradas, setEntradas] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [userTiendaReady, setUserTiendaReady] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isFirstFocus = useRef(true);
  const isInitializedRef = useRef(false);
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

  // Filter states
  const [filters, setFilters] = useState({ nombre_servicio: '', codigo_lote: '', fecha_desde: '', fecha_hasta: '', id_tienda: '', id_usuario: '', cantidad_restante_min: '0.01', cantidad_restante_max: '' });
  const [tiendas, setTiendas] = useState([]);
  const [users, setUsers] = useState([]);
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
  const [showFechaDesdePicker, setShowFechaDesdePicker] = useState(false);
  const [showFechaHastaPicker, setShowFechaHastaPicker] = useState(false);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState(null);
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

  useEffect(() => {
    requestCameraPermission();
  }, []);

  // Initialize Barcode Engine
  useEffect(() => {
    barcodeEngineRef.current = new BarcodeEngine('QUICK_SCAN');
    
    // Start session when component mounts
    barcodeEngineRef.current.startSession();
    
    return () => {
      if (barcodeEngineRef.current) {
        barcodeEngineRef.current.resetSession();
      }
    };
  }, []);

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

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setCameraPermission(status === 'granted');
  };

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
      // Only fetch on screen focus after initial load
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      if (isInitializedRef.current) {
        // Restore saved filters from AsyncStorage
        const restoreFilters = async () => {
          try {
            const savedFilters = await AsyncStorage.getItem('entradas_filters');
            if (savedFilters) {
              const parsedFilters = JSON.parse(savedFilters);
              setFilters(parsedFilters);
              fetchEntradas(null, parsedFilters);
            } else {
              // Restore user's tienda filter if it's empty and user has a tienda
              const shouldRestore = !filtersRef.current.id_tienda && userTiendaRef.current;
              if (shouldRestore) {
                setFilters(prev => ({ ...prev, id_tienda: userTiendaRef.current.toString() }));
                fetchEntradas(userTiendaRef.current.toString());
              } else {
                fetchEntradas();
              }
            }
          } catch (error) {
            console.error('Error restoring filters:', error);
            fetchEntradas();
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
      const canViewAllEntradas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && entradaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && entradaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && entradaAccessLevels?.economico === 'all_stores');

      const canViewOwnStore = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && entradaAccessLevels?.dependiente !== 'none') ||
        (userRole === 'almacenero' && entradaAccessLevels?.almacenero !== 'none') ||
        (userRole === 'económico' && entradaAccessLevels?.economico !== 'none');

      let allTiendas = [];
      
      if (isOfflineMode) {
        allTiendas = await storageService.getTiendas();
      } else {
        const data = await getTiendas({}, 1, 1000);
        allTiendas = data.data || [];
      }
      
      if (user?.id_tienda && canViewOwnStore) {
        if (canViewAllEntradas) {
          setTiendas(allTiendas);
        } else {
          const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
          setTiendas(userTienda ? [userTienda] : []);
        }
      } else if (!canViewOwnStore) {
        setTiendas([]);
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

  const fetchAllUsers = async () => {
    try {
      setIsLoadingUsers(true);
      if (isOfflineMode) {
        return;
      }
      const data = await getUsuarios({ activo: true }, 1, 1000);
      setUsers(data.data || []);
      setHasLoadedAllUsers(true);
    } catch (err) {
      // Error fetching users
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
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

  const fetchEntradas = async (overrideIdTienda = null, overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setEntradas([]);
        setIsLoading(false);
        return;
      }

      const userRole = user?.rol?.toLowerCase();
      const canViewAllEntradas =
        userRole === 'administrador' ||
        (userRole === 'dependiente' && entradaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && entradaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && entradaAccessLevels?.economico === 'all_stores');

      // Use override filters if provided, otherwise use current state
      const filtersToUse = overrideFilters || filters;

      const hasActiveFilters = Object.entries(filtersToUse).some(([key, value]) => {
        // Don't count id_tienda as an active filter if it's just the user's default store
        if (key === 'id_tienda' && value === user?.id_tienda?.toString()) {
          return false;
        }
        return value !== '' && value !== null && value !== undefined;
      });
      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;

      // Build filters to send to API
      const apiFilters = { ...filtersToUse };

      // Use overrideIdTienda if provided (for immediate filter changes)
      if (overrideIdTienda !== null) {
        apiFilters.id_tienda = overrideIdTienda;
      }

      // Adjust date filters for Cuba timezone before sending to backend
      const adjustedFilters = adjustFiltersForCubaTimezone(apiFilters);

      const data = await getEntradas(adjustedFilters, fetchPage, fetchLimit);
      let entradas = data.data || [];

      setEntradas(entradas);
      setPagination(data.pagination || pagination);
    } catch (err) {
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
    const userRole = user?.rol?.toLowerCase();
    const canViewAllEntradas = 
      userRole === 'administrador' ||
      (userRole === 'dependiente' && entradaAccessLevels?.dependiente === 'all_stores') ||
      (userRole === 'almacenero' && entradaAccessLevels?.almacenero === 'all_stores') ||
      (userRole === 'económico' && entradaAccessLevels?.economico === 'all_stores');

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
    
    // Pass entire cleared filters object to ensure all filters are properly sent to API
    fetchEntradas(null, clearedFilters);
  };

  const handleDelete = (entrada) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Entrada',
      `¿Estás seguro de que quieres eliminar la entrada "${entrada.codigo_lote}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEntrada(entrada.id_entrada);
              showToast({ type: 'success', message: 'Entrada eliminada correctamente' });
              fetchEntradas();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleEntradaPress = (entrada) => {
    if (isOfflineMode) {
      navigation.navigate('EntradaForm', { entrada, mode: 'view' });
      return;
    }
    
    // Save current filters before navigating
    AsyncStorage.setItem('entradas_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    // Open in edit mode if user has permissions, otherwise open in view mode
    const openMode = canManageEntradas ? 'edit' : 'view';
    navigation.navigate('EntradaForm', { entrada, mode: openMode });
  };

  const handleEdit = (entrada) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    // Save current filters before navigating
    AsyncStorage.setItem('entradas_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('EntradaForm', { entrada, mode: 'edit' });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    // Save current filters before navigating
    AsyncStorage.setItem('entradas_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('EntradaForm', { 
      mode: 'add',
      canViewAllEntradas: canViewAllEntradas
    });
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
    }
  };

  const handlePrevPage = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }));
    }
  };

  const handleOpenScanner = async () => {
    if (cameraPermission !== 'granted') {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(status === 'granted');
      if (status !== 'granted') {
        showToast({ type: 'error', message: 'Se requiere permiso de cámara para escanear' });
        return;
      }
    }
    setShowScannerModal(true);
  };

  const handleBarcodeScanned = async (scanningResult) => {
    if (!barcodeEngineRef.current) return;

    try {
      const result = await barcodeEngineRef.current.processScanningResult(scanningResult);
      
      if (!result) {
        // Still accumulating reads, wait for more
        return;
      }

      if (result.success) {
        const clearedFilters = {
          nombre_servicio: '',
          fecha_desde: '',
          fecha_hasta: '',
          id_tienda: '',
          id_usuario: '',
          cantidad_restante_min: '0.01',
          cantidad_restante_max: ''
        };
        
        setFilters({ ...clearedFilters, codigo_lote: result.code });
        setShowScannerModal(false);
        showToast({ 
          type: 'success', 
          message: `Código escaneado (${result.type}) - Confianza: ${(result.confidenceScore * 100).toFixed(0)}%` 
        });
        setPagination(prev => ({ ...prev, currentPage: 1 }));
        setIsSearching(true);
        
        // Reset session for next use
        barcodeEngineRef.current.startSession();
      } else {
        showToast({ 
          type: 'warning', 
          message: result.rejectionReason || 'Código no válido. Por favor vuelva a enfocar.' 
        });
        
        // Reset session to try again
        barcodeEngineRef.current.startSession();
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      showToast({ type: 'error', message: 'Error al procesar código' });
      barcodeEngineRef.current.resetSession();
      barcodeEngineRef.current.startSession();
    }
  };

  const handleExport = async () => {
    try {
      setShowFieldSelectionModal(false);
      setIsExporting(true);
      
      const userRole = user?.rol?.toLowerCase();
      const canViewAllEntradas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && entradaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && entradaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && entradaAccessLevels?.economico === 'all_stores');

      // Build filters to send to API
      const apiFilters = { ...filters };
      
      const data = await getEntradas(apiFilters, 1, 10000);
      let allEntradas = data.data || [];

      if (exportType === 'excel') {
        await exportToExcel(allEntradas);
      } else if (exportType === 'pdf') {
        await exportToPDF(allEntradas);
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Error al exportar: ' + error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const sanitizeFileName = (fileName) => {
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
  };

  const exportToExcel = async (entradas) => {
    try {
      // Prepare data based on selected fields
      const data = entradas.map(entrada => {
        const row = {};
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

      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = sanitizeFileName(`Historial_Entradas_${formattedDate}.xlsx`);
      const downloadDir = FileSystem.cacheDirectory;
      const fileUri = `${downloadDir}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, excelBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      showExportSuccessAlert(fileUri, fileName);
    } catch (error) {
      throw error;
    }
  };

  const exportToPDF = async (entradas) => {
    try {
      let tableRows = '';
      
      // Table header based on selected fields
      let tableHeader = '<tr style="background-color: #f0f0f0;">';
      if (selectedFields.producto) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Nombre</th>';
      if (selectedFields.tienda) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Tienda</th>';
      if (selectedFields.cantidad) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Cantidad</th>';
      if (canManageEntradas && selectedFields.costo_cup) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo CUP</th>';
      if (canManageEntradas && selectedFields.costo_usd) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Costo USD</th>';
      if (selectedFields.fecha) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Fecha</th>';
      if (selectedFields.codigo_lote) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Código Lote</th>';
      if (selectedFields.fecha_vencimiento) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Fecha Vencimiento</th>';
      if (selectedFields.proveedor) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Proveedor</th>';
      if (selectedFields.usuario) tableHeader += '<th style="border: 1px solid #ddd; padding: 8px;">Usuario</th>';
      tableHeader += '</tr>';

      // Table rows based on selected fields
      entradas.forEach(entrada => {
        tableRows += '<tr>';
        if (selectedFields.producto) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.servicioTienda?.servicio?.nombre || 'N/A'}</td>`;
        if (selectedFields.tienda) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.servicioTienda?.tienda?.nombre || 'N/A'}</td>`;
        if (selectedFields.cantidad) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.cantidad_entrada}</td>`;
        if (canManageEntradas && selectedFields.costo_cup) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.costo_cup}</td>`;
        if (canManageEntradas && selectedFields.costo_usd) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.costo_usd}</td>`;
        if (selectedFields.fecha) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${new Date(entrada.fecha).toLocaleDateString()}</td>`;
        if (selectedFields.codigo_lote) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.codigo_lote}</td>`;
        if (selectedFields.fecha_vencimiento) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.fecha_vencimiento ? new Date(entrada.fecha_vencimiento).toLocaleDateString() : 'N/A'}</td>`;
        if (selectedFields.proveedor) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.nombre_proveedor || 'N/A'}</td>`;
        if (selectedFields.usuario) tableRows += `<td style="border: 1px solid #ddd; padding: 8px;">${entrada.usuario?.nombre_natural || 'N/A'}</td>`;
        tableRows += '</tr>';
      });

      const html = `
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
            <h1>Historial de Entradas</h1>
            <p>Fecha: ${new Date().toLocaleDateString()}</p>
            <table>
              ${tableHeader}
              ${tableRows}
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      
      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = sanitizeFileName(`Historial_Entradas_${formattedDate}.pdf`);
      
      showExportSuccessAlert(uri, fileName);
    } catch (error) {
      throw error;
    }
  };

  const showExportSuccessAlert = (fileUri, fileName) => {
    Alert.alert(
      'Documento Exportado',
      `El documento "${fileName}" ha sido generado. ¿Qué deseas hacer?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Guardar',
          onPress: async () => {
            try {
              const fileContent = await FileSystem.readAsStringAsync(fileUri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              const mimeType = fileName.endsWith('.xlsx') 
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'application/pdf';
              
              const result = await ExportService.saveFile({
                filename: fileName,
                mimeType: mimeType,
                base64: fileContent
              });
              
              if (result.success) {
                showToast({ type: 'success', message: result.message || 'Archivo guardado correctamente' });
              } else {
                showToast({ type: 'error', message: result.error || 'Error al guardar el archivo' });
              }
            } catch (error) {
              showToast({ type: 'error', message: 'Error al guardar: ' + error.message });
            }
          },
        },
        {
          text: 'Compartir',
          onPress: async () => {
            try {
              const isAvailable = await Sharing.isAvailableAsync();
              if (isAvailable) {
                await Sharing.shareAsync(fileUri, {
                  mimeType: fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
                  dialogTitle: 'Compartir documento',
                });
              } else {
                showToast({ type: 'error', message: 'Compartir no está disponible en este dispositivo' });
              }
            } catch (error) {
              showToast({ type: 'error', message: 'Error al compartir el archivo' });
            }
          },
        },
      ]
    );
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  const filteredUsers = users.filter(userItem =>
    userItem.nombre_natural?.toLowerCase().includes(userSearchText.toLowerCase())
  );

  const getCantidadStatus = (entrada) => {
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

  const handleFechaDesdeChange = (event, selectedDate) => {
    setShowFechaDesdePicker(false);
    if (event.type === 'set' && selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, fecha_desde: formattedDate }));
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowFechaHastaPicker(false);
    if (event.type === 'set' && selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, fecha_hasta: formattedDate }));
    }
  };

  const userRole = user?.rol?.toLowerCase();
  const canViewAllEntradas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && entradaAccessLevels?.dependiente === 'all_stores') ||
    (userRole === 'almacenero' && entradaAccessLevels?.almacenero === 'all_stores') ||
    (userRole === 'económico' && entradaAccessLevels?.economico === 'all_stores');

  const canManageEntradas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && entradaManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && entradaManagePermissions?.almacenero) ||
    (userRole === 'económico' && entradaManagePermissions?.economico);

  const styles = createStyles(responsive);

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
        onNotificationsPress={handleNotificationsPress}
        onProfilePress={handleProfilePress}
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
        currentRoute="Entradas"
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
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Entradas</Text>
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
            <Text style={[styles.label, { color: colors.outline }]}>Nombre del Producto</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nombre..."
              value={filters.nombre_servicio}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre_servicio: text }))}
            />
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
              onPress={() => {
                if (canViewAllEntradas) {
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
                {canViewAllEntradas && (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      setFilters(prev => ({ ...prev, id_tienda: '' }));
                      setShowTiendaDropdown(false);
                      setTiendaSearchText('');
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                      fetchEntradas('');
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
                        fetchEntradas(newIdTienda);
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
                    if (canViewAllEntradas) {
                      setShowUserDropdown(!showUserDropdown);
                      // Lazy load all users when dropdown is opened
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
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, id_usuario: '' }));
                            setShowUserDropdown(false);
                            setUserSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchEntradas();
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
                                fetchEntradas();
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
                      </>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Código de Lote</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por código de lote..."
                  value={filters.codigo_lote}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, codigo_lote: text }))}
                />
              </View>

              <View style={styles.filterRow}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cant.Restante Mínima</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Cantidad mínima..."
                    value={filters.cantidad_restante_min}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, cantidad_restante_min: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.filterGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cant.Restante Máxima</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Cantidad máxima..."
                    value={filters.cantidad_restante_max}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, cantidad_restante_max: text }))}
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

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {!isOfflineMode && canManageEntradas && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Entrada</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowExportModal(true)}
          >
            <Ionicons name="download-outline" size={responsive.responsiveWidth(20)} color="#fff" />
            <Text style={[styles.exportButtonText, { color: '#fff' }]}>Exportar Datos</Text>
          </TouchableOpacity>
        </View>

        {/* Entradas List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando entradas...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchEntradas}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : entradas.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="cube-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron entradas
            </Text>
          </Card>
        ) : (
          <>
            {viewMode === 'card' ? (
              entradas.map((entrada) => (
                <TouchableOpacity
                  key={entrada.id_entrada}
                  onPress={() => handleEntradaPress(entrada)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.entradaCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.entradaInfo}>
                      <View style={styles.entradaHeader}>
                        <Text style={[styles.entradaNombre, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                          {entrada.servicioTienda?.servicio?.nombre || 'N/A'}
                        </Text>
                      </View>
                      <Text style={[styles.entradaProducto, { color: colors.outline }]}>
                        Código Lote: {entrada.codigo_lote}
                      </Text>
                      <Text style={[styles.entradaTienda, { color: colors.outline }]}>
                        Tienda: {entrada.servicioTienda?.tienda?.nombre || 'N/A'}
                      </Text>
                      <View style={styles.cantidadRow}>
                        <Text style={[styles.entradaCantidad, { color: colors.primary }]}>
                          Inicial: {entrada.cantidad_entrada}
                        </Text>
                        <View style={[styles.cantidadOval, { backgroundColor: getCantidadStatus(entrada).bgColor, borderColor: getCantidadStatus(entrada).borderColor }]}>
                          <Text style={[styles.cantidadOvalText, { color: getCantidadStatus(entrada).color }]}>
                            Actual: {entrada.cantidad_restante || 0}
                          </Text>
                        </View>
                      </View>
                      {canManageEntradas && (
                        <Text style={[styles.entradaCosto, { color: colors.primary }]}>
                          Total CUP: ${(parseFloat(entrada.costo_cup) * parseFloat(entrada.cantidad_entrada)).toFixed(2)} | Total USD: ${(parseFloat(entrada.costo_usd) * parseFloat(entrada.cantidad_entrada)).toFixed(2)}
                        </Text>
                      )}
                      <Text style={[styles.entradaFecha, { color: colors.outline }]}>
                        Fecha: {new Date(entrada.fecha).toLocaleDateString()}
                      </Text>
                    </View>
                    {canManageEntradas && (
                      <View style={styles.entradaActions}>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEdit(entrada);
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
                            handleDelete(entrada);
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
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Producto</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Código Lote</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Tienda</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Proveedor</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(80), textAlign: 'center' }]}>Inicial</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(80), textAlign: 'center' }]}>Actual</Text>
                    {canManageEntradas && (
                      <>
                        <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Total CUP</Text>
                        <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Total USD</Text>
                      </>
                    )}
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Fecha</Text>
                    {canManageEntradas && (
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                    )}
                  </View>
                  {entradas.map((entrada, index) => {
                    const cantidadActual = entrada.cantidad_restante || 0;
                    const cantidadInicial = entrada.cantidad_entrada;
                    let actualColor = colors.onSurface;
                    if (cantidadActual === 0) {
                      actualColor = '#F44336'; // rojo
                    } else if (cantidadActual === cantidadInicial) {
                      actualColor = '#4CAF50'; // verde
                    } else {
                      actualColor = '#FF9800'; // naranja
                    }
                    return (
                      <TouchableOpacity
                        key={entrada.id_entrada}
                        onPress={() => handleEntradaPress(entrada)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                            {entrada.servicioTienda?.servicio?.nombre || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                            {entrada.codigo_lote}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                            {entrada.servicioTienda?.tienda?.nombre || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                            {entrada.nombre_proveedor || '-'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(80), textAlign: 'center' }]}>
                            {entrada.cantidad_entrada}
                          </Text>
                          <Text style={[styles.tableCellText, { color: actualColor, width: responsive.responsiveWidth(80), textAlign: 'center' }]}>
                            {cantidadActual}
                          </Text>
                          {canManageEntradas && (
                            <>
                              <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                                ${(parseFloat(entrada.costo_cup) * parseFloat(entrada.cantidad_entrada)).toFixed(2)}
                              </Text>
                              <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                                ${(parseFloat(entrada.costo_usd) * parseFloat(entrada.cantidad_entrada)).toFixed(2)}
                              </Text>
                            </>
                          )}
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                            {new Date(entrada.fecha).toLocaleDateString()}
                          </Text>
                          {canManageEntradas && (
                            <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                              <View style={styles.tableActionsRow}>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleEdit(entrada);
                                  }}
                                >
                                  <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDelete(entrada);
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
                  style={[
                    styles.paginationButton,
                    { backgroundColor: colors.surface, opacity: pagination.currentPage === 1 ? 0.5 : 1 }
                  ]}
                  onPress={handlePrevPage}
                  disabled={pagination.currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                </TouchableOpacity>
                <View style={styles.paginationInfo}>
                  <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                    Página {pagination.currentPage} de {pagination.totalPages}
                  </Text>
                  <Text style={[styles.paginationText, styles.paginationSubtext, { color: colors.outline }]}>
                    Total de entradas: {pagination.totalItems}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.paginationButton,
                    { backgroundColor: colors.surface, opacity: pagination.currentPage === pagination.totalPages ? 0.5 : 1 }
                  ]}
                  onPress={handleNextPage}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <Ionicons name="chevron-forward" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Export Modal */}
      {showExportModal && (
        <Modal
          visible={showExportModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowExportModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.exportModal, { backgroundColor: colors.surface }]}>
              <View style={styles.exportModalHeader}>
                <Text style={[styles.exportModalTitle, { color: colors.onSurface }]}>Exportar Datos</Text>
                <TouchableOpacity
                  style={styles.exportModalCloseButton}
                  onPress={() => setShowExportModal(false)}
                >
                  <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowExportModal(false);
                  setExportType('excel');
                  setShowFieldSelectionModal(true);
                }}
                disabled={isExporting}
              >
                <Ionicons name="document-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Entradas en Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportOption, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => {
                  setShowExportModal(false);
                  setExportType('pdf');
                  setShowFieldSelectionModal(true);
                }}
                disabled={isExporting}
              >
                <Ionicons name="document-text-outline" size={responsive.responsiveWidth(24)} color={colors.primary} />
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Entradas en PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Field Selection Modal */}
      {showFieldSelectionModal && (
        <Modal
          visible={showFieldSelectionModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowFieldSelectionModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.fieldSelectionModal, { backgroundColor: colors.surface }]}>
              <View style={styles.exportModalHeader}>
                <Text style={[styles.exportModalTitle, { color: colors.onSurface }]}>Seleccionar Campos</Text>
                <TouchableOpacity
                  style={styles.exportModalCloseButton}
                  onPress={() => setShowFieldSelectionModal(false)}
                >
                  <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.fieldSelectionScroll}>
                {Object.keys(selectedFields).map((field) => {
                  // Hide cost fields if user doesn't have management permissions
                  if (!canManageEntradas && (field === 'costo_cup' || field === 'costo_usd')) {
                    return null;
                  }
                  const fieldLabel = field === 'producto' ? 'Nombre' : field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ');
                  return (
                    <TouchableOpacity
                      key={field}
                      style={[styles.fieldSelectionItem, { backgroundColor: colors.surfaceVariant }]}
                      onPress={() => setSelectedFields(prev => ({ ...prev, [field]: !prev[field] }))}
                    >
                      <View style={[styles.checkbox, { borderColor: colors.outlineVariant, backgroundColor: selectedFields[field] ? colors.primary : 'transparent' }]}>
                        {selectedFields[field] && (
                          <Ionicons name="checkmark" size={responsive.responsiveWidth(16)} color="#fff" />
                        )}
                      </View>
                      <Text style={[styles.fieldSelectionText, { color: colors.onSurface }]}>
                        {fieldLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={[styles.exportConfirmButton, { backgroundColor: colors.primary }]}
                onPress={handleExport}
              >
                <Text style={[styles.exportConfirmButtonText, { color: '#fff' }]}>Generar Exportación</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Barcode Scanner Modal */}
      {showScannerModal && (
        <Modal
          visible={showScannerModal}
          animationType="slide"
          onRequestClose={() => setShowScannerModal(false)}
        >
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scanner}
              barcodeScannerSettings={{
                barcodeTypes: ALLOWED_BARCODE_TYPES,
              }}
              onBarcodeScanned={handleBarcodeScanned}
              facing="back"
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerCorner} />
              <View style={[styles.scannerCorner, styles.scannerCornerTopRight]} />
              <View style={[styles.scannerCorner, styles.scannerCornerBottomLeft]} />
              <View style={[styles.scannerCorner, styles.scannerCornerBottomRight]} />
              <Text style={[styles.scannerText, { color: '#fff' }]}>
                Escanea el código de barras
              </Text>
              <TouchableOpacity
                style={styles.scannerCloseButton}
                onPress={() => setShowScannerModal(false)}
              >
                <Ionicons name="close" size={responsive.responsiveWidth(30)} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Export Loading Modal */}
      {isExporting && (
        <Modal
          visible={isExporting}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.loadingModal, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingModalText, { color: colors.onSurface }]}>
                Generando documento...
              </Text>
              <Text style={[styles.loadingModalSubtext, { color: colors.onSurfaceVariant }]}>
                Por favor espere, esto puede tomar unos segundos
              </Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export const EntradasScreen = () => <EntradasContent />;

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
  exportButton: {
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
  exportButtonText: {
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
  entradaCard: {
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
  entradaInfo: {
    flex: 1,
  },
  entradaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  entradaNombre: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  entradaProducto: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  entradaTienda: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  entradaCosto: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  entradaCantidad: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  cantidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    marginTop: responsive.responsiveMargin(2),
  },
  cantidadOval: {
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    borderWidth: 1,
  },
  cantidadOvalText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  entradaFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  entradaActions: {
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
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationSubtext: {
    fontSize: responsive.responsiveFontSize(12),
    marginTop: responsive.responsiveMargin(4),
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
  tableStatusCell: {
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  tableStatusText: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Inter',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportModal: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '80%',
    maxWidth: responsive.responsiveWidth(400),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  exportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(20),
  },
  exportModalTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    flex: 1,
  },
  exportModalCloseButton: {
    padding: responsive.responsivePadding(8),
    marginLeft: responsive.responsiveMargin(12),
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    padding: responsive.responsivePadding(16),
    borderRadius: 12,
    marginBottom: responsive.responsiveMargin(12),
  },
  exportOptionText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  loadingModal: {
    borderRadius: 16,
    padding: responsive.responsivePadding(32),
    width: '85%',
    maxWidth: responsive.responsiveWidth(350),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  loadingModalText: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginTop: responsive.responsiveMargin(16),
    textAlign: 'center',
  },
  loadingModalSubtext: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(8),
    textAlign: 'center',
  },
  fieldSelectionModal: {
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    width: '85%',
    maxWidth: responsive.responsiveWidth(400),
    maxHeight: responsive.responsiveHeight(500),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  fieldSelectionScroll: {
    maxHeight: responsive.responsiveHeight(300),
    marginBottom: responsive.responsiveMargin(16),
  },
  fieldSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    marginBottom: responsive.responsiveMargin(8),
  },
  checkbox: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldSelectionText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  exportConfirmButton: {
    paddingVertical: responsive.responsivePadding(14),
    paddingHorizontal: responsive.responsivePadding(24),
    borderRadius: 8,
    alignItems: 'center',
  },
  exportConfirmButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#fff',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(12),
  },
  inputWithIconText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    paddingVertical: 0,
  },
  cameraButton: {
    marginLeft: responsive.responsiveMargin(8),
  },
  scannerContainer: {
    flex: 1,
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  scannerCorner: {
    position: 'absolute',
    width: responsive.responsiveWidth(60),
    height: responsive.responsiveHeight(60),
    borderColor: '#fff',
    borderWidth: 2,
  },
  scannerCornerTopRight: {
    top: responsive.responsiveHeight(150),
    right: responsive.responsiveWidth(50),
  },
  scannerCornerBottomLeft: {
    bottom: responsive.responsiveHeight(150),
    left: responsive.responsiveWidth(50),
  },
  scannerCornerBottomRight: {
    bottom: responsive.responsiveHeight(150),
    right: responsive.responsiveWidth(50),
  },
  scannerText: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(20),
  },
  scannerCloseButton: {
    position: 'absolute',
    top: responsive.responsiveHeight(50),
    right: responsive.responsiveWidth(20),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: responsive.responsiveWidth(20),
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

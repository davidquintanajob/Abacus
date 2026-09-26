import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal, Image } from 'react-native';
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
import { getSalidas, deleteSalida } from '../services/salidaService';
import { getTiendas } from '../services/tiendaService';
import { getUsuarios } from '../services/usuarioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { storageService } from '../services/storageService';
import configService from '../services/configService';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import ExportService from '../services/ExportService';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SalidasContent = () => {
  const navigation = useNavigation();
  
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, salidaAccessLevels, salidaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [salidas, setSalidas] = useState([]);
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
  const [filters, setFilters] = useState({ tipo_salida: '', descripcion: '', fecha_desde: '', fecha_hasta: '', id_tienda: '', id_usuario: '' });
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFieldSelectionModal, setShowFieldSelectionModal] = useState(false);
  
  const predefinedSalidaTypes = ['Perdida', 'Consumo personal', 'Baja', 'Ajuste de Inventario'];
  const [customSalidaTypes, setCustomSalidaTypes] = useState([]);
  const [showTipoSalidaDropdown, setShowTipoSalidaDropdown] = useState(false);
  const [tipoSalidaSearchText, setTipoSalidaSearchText] = useState('');
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

  // Load custom salida types
  useEffect(() => {
    loadCustomSalidaTypes();
  }, []);

  const loadCustomSalidaTypes = async () => {
    try {
      const config = await configService.getConfig();
      if (config.customSalidaTypes) {
        setCustomSalidaTypes(config.customSalidaTypes);
      }
      
      const asyncStorageTypes = await AsyncStorage.getItem('customSalidaTypes');
      if (asyncStorageTypes) {
        const parsedTypes = JSON.parse(asyncStorageTypes);
        setCustomSalidaTypes(prev => {
          const combined = [...new Set([...prev, ...parsedTypes])];
          return combined;
        });
      }
    } catch (error) {
      console.error('Error loading custom salida types:', error);
    }
  };

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
            const savedFilters = await AsyncStorage.getItem('salidas_filters');
            if (savedFilters) {
              const parsedFilters = JSON.parse(savedFilters);
              setFilters(parsedFilters);
              fetchSalidas(null, parsedFilters);
            } else {
              // Restore user's tienda filter if it's empty and user has a tienda
              const shouldRestore = !filtersRef.current.id_tienda && userTiendaRef.current;
              if (shouldRestore) {
                setFilters(prev => ({ ...prev, id_tienda: userTiendaRef.current.toString() }));
                fetchSalidas(userTiendaRef.current.toString());
              } else {
                fetchSalidas();
              }
            }
          } catch (error) {
            console.error('Error restoring filters:', error);
            fetchSalidas();
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
      const canViewAllSalidas = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && salidaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && salidaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && salidaAccessLevels?.economico === 'all_stores');

      const canViewOwnStore = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && salidaAccessLevels?.dependiente !== 'none') ||
        (userRole === 'almacenero' && salidaAccessLevels?.almacenero !== 'none') ||
        (userRole === 'económico' && salidaAccessLevels?.economico !== 'none');

      let allTiendas = [];
      
      if (isOfflineMode) {
        allTiendas = await storageService.getTiendas();
      } else {
        const data = await getTiendas({}, 1, 1000);
        allTiendas = data.data || [];
      }
      
      if (user?.id_tienda && canViewOwnStore) {
        if (canViewAllSalidas) {
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

  const fetchSalidas = async (overrideIdTienda = null, overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setSalidas([]);
        setIsLoading(false);
        return;
      }

      const userRole = user?.rol?.toLowerCase();
      const canViewAllSalidas =
        userRole === 'administrador' ||
        (userRole === 'dependiente' && salidaAccessLevels?.dependiente === 'all_stores') ||
        (userRole === 'almacenero' && salidaAccessLevels?.almacenero === 'all_stores') ||
        (userRole === 'económico' && salidaAccessLevels?.economico === 'all_stores');

      const filtersToUse = overrideFilters || filters;

      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;

      const apiFilters = { ...filtersToUse };

      if (overrideIdTienda !== null) {
        apiFilters.id_tienda = overrideIdTienda;
      }

      // Adjust date filters for Cuba timezone before sending to backend
      const adjustedFilters = adjustFiltersForCubaTimezone(apiFilters);

      const data = await getSalidas(adjustedFilters, fetchPage, fetchLimit);
      let salidas = data.data || [];

      setSalidas(salidas);
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
    fetchSalidas();
  };

  const handleClearFilters = () => {
    const userRole = user?.rol?.toLowerCase();
    const canViewAllSalidas = 
      userRole === 'administrador' ||
      (userRole === 'dependiente' && salidaAccessLevels?.dependiente === 'all_stores') ||
      (userRole === 'almacenero' && salidaAccessLevels?.almacenero === 'all_stores') ||
      (userRole === 'económico' && salidaAccessLevels?.economico === 'all_stores');

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

  const handleDelete = (salida) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Salida',
      `¿Estás seguro de que quieres eliminar la salida?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSalida(salida.id_salida);
              showToast({ type: 'success', message: 'Salida eliminada correctamente' });
              fetchSalidas();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleSalidaPress = (salida) => {
    if (isOfflineMode) {
      navigation.navigate('SalidaForm', { salida, mode: 'view' });
      return;
    }
    
    AsyncStorage.setItem('salidas_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    const openMode = canManageSalidas ? 'edit' : 'view';
    navigation.navigate('SalidaForm', { salida, mode: openMode });
  };

  const handleEdit = (salida) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    AsyncStorage.setItem('salidas_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('SalidaForm', { salida, mode: 'edit' });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    AsyncStorage.setItem('salidas_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('SalidaForm', { 
      mode: 'add',
      canViewAllSalidas: canViewAllSalidas
    });
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

  const exportToExcel = async (salidas) => {
    try {
      const data = salidas.map(salida => {
        const row = {};
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

      const excelBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      
      const date = new Date();
      const formattedDate = `${date.getDate().toString().padStart(2, '0')}_${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
      const fileName = sanitizeFileName(`Historial_Salidas_${formattedDate}.xlsx`);
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

  const exportToPDF = async (salidas) => {
    try {
      let tableRows = '';
      
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
            <h1>Historial de Salidas</h1>
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
      const fileName = sanitizeFileName(`Historial_Salidas_${formattedDate}.pdf`);
      
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

  const handleFechaDesdeChange = (event, selectedDate) => {
    setShowFechaDesdePicker(false);
    if (event.type === 'set' && selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setFilters(prev => ({ ...prev, fecha_desde: formattedDate }));
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowFechaHastaPicker(false);
    if (event.type === 'set' && selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      setFilters(prev => ({ ...prev, fecha_hasta: formattedDate }));
    }
  };

  const userRole = user?.rol?.toLowerCase();
  const canViewAllSalidas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && salidaAccessLevels?.dependiente === 'all_stores') ||
    (userRole === 'almacenero' && salidaAccessLevels?.almacenero === 'all_stores') ||
    (userRole === 'económico' && salidaAccessLevels?.economico === 'all_stores');

  const canManageSalidas = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && salidaManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && salidaManagePermissions?.almacenero) ||
    (userRole === 'económico' && salidaManagePermissions?.economico);

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
        currentRoute="Salidas"
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
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Salidas</Text>
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
            <Text style={[styles.label, { color: colors.outline }]}>Tipo de Salida</Text>
            <View style={styles.relativeContainer}>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => setShowTipoSalidaDropdown(!showTipoSalidaDropdown)}
              >
                <Text style={[styles.dropdownText, { color: filters.tipo_salida ? colors.onSurface : colors.outline }]}>
                  {filters.tipo_salida || 'Todos los tipos'}
                </Text>
                <Ionicons 
                  name={showTipoSalidaDropdown ? "chevron-up" : "chevron-down"} 
                  size={responsive.responsiveWidth(20)} 
                  color={colors.outline} 
                />
              </TouchableOpacity>
              
              {showTipoSalidaDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
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
                      placeholder="Buscar tipo..."
                      value={tipoSalidaSearchText}
                      onChangeText={setTipoSalidaSearchText}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      const updatedFilters = { ...filters, tipo_salida: '' };
                      setFilters(updatedFilters);
                      setShowTipoSalidaDropdown(false);
                      setTipoSalidaSearchText('');
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                      fetchSalidas(null, updatedFilters);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los tipos</Text>
                  </TouchableOpacity>
                  {[...predefinedSalidaTypes, ...customSalidaTypes]
                    .filter(type => type.toLowerCase().includes(tipoSalidaSearchText.toLowerCase()))
                    .map((type, index) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.dropdownItem, index === ([...predefinedSalidaTypes, ...customSalidaTypes].filter(t => t.toLowerCase().includes(tipoSalidaSearchText.toLowerCase())).length - 1) && styles.dropdownItemLast]}
                        onPress={() => {
                          const updatedFilters = { ...filters, tipo_salida: type };
                          setFilters(updatedFilters);
                          setShowTipoSalidaDropdown(false);
                          setTipoSalidaSearchText('');
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchSalidas(null, updatedFilters);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
              onPress={() => {
                if (canViewAllSalidas) {
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
                    {canViewAllSalidas && (
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          const updatedFilters = { ...filters, id_tienda: '' };
                          setFilters(updatedFilters);
                          setShowTiendaDropdown(false);
                          setTiendaSearchText('');
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchSalidas(null, updatedFilters);
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
                            const updatedFilters = { ...filters, id_tienda: newIdTienda };
                            setFilters(updatedFilters);
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchSalidas(null, updatedFilters);
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
                    if (canViewAllSalidas) {
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
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            const updatedFilters = { ...filters, id_usuario: '' };
                            setFilters(updatedFilters);
                            setShowUserDropdown(false);
                            setUserSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchSalidas(null, updatedFilters);
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
                                const updatedFilters = { ...filters, id_usuario: userItem.id_usuario.toString() };
                                setFilters(updatedFilters);
                                setShowUserDropdown(false);
                                setUserSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchSalidas(null, updatedFilters);
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
                <Text style={[styles.label, { color: colors.outline }]}>Descripción</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por descripción..."
                  value={filters.descripcion}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, descripcion: text }))}
                />
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
          {!isOfflineMode && canManageSalidas && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Salida</Text>
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

        {/* Salidas List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando salidas...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchSalidas}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : salidas.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="cube-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron salidas
            </Text>
          </Card>
        ) : (
          <>
            {viewMode === 'card' ? (
              salidas.map((salida) => (
                <TouchableOpacity
                  key={salida.id_salida}
                  onPress={() => handleSalidaPress(salida)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.salidaCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.salidaInfo}>
                      <View style={styles.salidaHeader}>
                        <Text style={[styles.salidaNombre, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                          {salida.servicioTienda?.servicio?.nombre || 'N/A'}
                        </Text>
                      </View>
                      <Text style={[styles.salidaTipo, { color: colors.outline }]}>
                        Tipo: {salida.tipo_salida}
                      </Text>
                      <Text style={[styles.salidaTienda, { color: colors.outline }]}>
                        Tienda: {salida.servicioTienda?.tienda?.nombre || 'N/A'}
                      </Text>
                      <Text style={[styles.salidaCantidad, { color: colors.primary }]}>
                        Cantidad: {salida.cantidad_total}
                      </Text>
                      {canManageSalidas && (
                        <Text style={[styles.salidaCosto, { color: colors.primary }]}>
                          Total CUP: ${(parseFloat(salida.costo_cup) * parseFloat(salida.cantidad_total)).toFixed(2)} | Total USD: ${(parseFloat(salida.costo_usd) * parseFloat(salida.cantidad_total)).toFixed(2)}
                        </Text>
                      )}
                      <Text style={[styles.salidaFecha, { color: colors.outline }]}>
                        Fecha: {new Date(salida.fecha).toLocaleDateString()}
                      </Text>
                    </View>
                    {canManageSalidas && (
                      <View style={styles.salidaActions}>
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEdit(salida);
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
                            handleDelete(salida);
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
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Tipo Salida</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Tienda</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Descripción</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(80), textAlign: 'center' }]}>Cantidad</Text>
                    {canManageSalidas && (
                      <>
                        <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Total CUP</Text>
                        <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100), textAlign: 'center' }]}>Total USD</Text>
                      </>
                    )}
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Fecha</Text>
                    {canManageSalidas && (
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                    )}
                  </View>
                  {salidas.map((salida, index) => (
                    <TouchableOpacity
                      key={salida.id_salida}
                      onPress={() => handleSalidaPress(salida)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                          {salida.servicioTienda?.servicio?.nombre || 'N/A'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                          {salida.tipo_salida}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                          {salida.servicioTienda?.tienda?.nombre || 'N/A'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                          {salida.descripcion || '-'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(80), textAlign: 'center' }]}>
                          {salida.cantidad_total}
                        </Text>
                        {canManageSalidas && (
                          <>
                            <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                              ${(parseFloat(salida.costo_cup) * parseFloat(salida.cantidad_total)).toFixed(2)}
                            </Text>
                            <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                              ${(parseFloat(salida.costo_usd) * parseFloat(salida.cantidad_total)).toFixed(2)}
                            </Text>
                          </>
                        )}
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                          {new Date(salida.fecha).toLocaleDateString()}
                        </Text>
                        {canManageSalidas && (
                          <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                            <View style={styles.tableActionsRow}>
                              <TouchableOpacity
                                style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleEdit(salida);
                                }}
                              >
                                <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleDelete(salida);
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
                    Total de salidas: {pagination.totalItems}
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
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Salidas en Excel</Text>
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
                <Text style={[styles.exportOptionText, { color: colors.onSurface }]}>Salidas en PDF</Text>
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
                  if (!canManageSalidas && (field === 'costo_cup' || field === 'costo_usd')) {
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

export const SalidasScreen = () => <SalidasContent />;

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
  relativeContainer: {
    position: 'relative',
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
  salidaCard: {
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
  salidaInfo: {
    flex: 1,
  },
  salidaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  salidaNombre: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  salidaTipo: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  salidaTienda: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  salidaCosto: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  salidaCantidad: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(2),
  },
  salidaFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  salidaActions: {
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
});

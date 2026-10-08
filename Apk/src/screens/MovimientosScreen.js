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
import { getMovimientos, deleteMovimiento } from '../services/movimientoService';
import { getTiendas } from '../services/tiendaService';
import { getUsuarios } from '../services/usuarioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import configService from '../services/configService';

const MovimientosContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, movimientoAccessLevels, movimientoManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isFirstFocus = useRef(true);
  const hasRestoredFilters = useRef(false);
  const isInitializedRef = useRef(false);
  const filtersRef = useRef(filters);
  const savedPaginationRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => {
    isInitializedRef.current = isInitialized;
  }, [isInitialized]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // Filter states
  const getCubaDate = () => {
    const now = new Date();
    // Use local date directly (system should already be in Cuba time UTC-4)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const getCubaDateDaysAgo = (daysAgo) => {
    const now = new Date();
    now.setDate(now.getDate() - daysAgo);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const toCubaDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Use local date directly
    return date.toLocaleDateString();
  };
  
  const today = getCubaDate();
  const sevenDaysAgo = getCubaDateDaysAgo(6); // 6 days ago + today = 7 days total
  const [filters, setFilters] = useState({ 
    tipo_movimiento: '', 
    estado: '', 
    fecha_desde: sevenDaysAgo, 
    fecha_hasta: today, 
    id_tienda_origen: '', 
    id_tienda_destino: '',
    id_usuario: ''
  });
  
  // Preseleccionar tienda del usuario en filtros si tiene permiso all_stores
  // Deshabilitado porque el backend espera id_servicio_tienda, no id_tienda
  // const hasPreselectedTienda = useRef(false);
  // useEffect(() => {
  //   if (canManageAllTiendas && userTiendaId && !shouldHideTiendaFilters && !hasPreselectedTienda.current) {
  //     setFilters(prev => ({
  //       ...prev,
  //       id_servicio_tienda_origen: userTiendaId.toString(),
  //       id_servicio_tienda_destino: userTiendaId.toString()
  //     }));
  //     hasPreselectedTienda.current = true;
  //   }
  // }, [canManageAllTiendas, userTiendaId, shouldHideTiendaFilters]);
  const [tiendas, setTiendas] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaOrigenDropdown, setShowTiendaOrigenDropdown] = useState(false);
  const [showTiendaDestinoDropdown, setShowTiendaDestinoDropdown] = useState(false);
  const [tiendaOrigenSearchText, setTiendaOrigenSearchText] = useState('');
  const [tiendaDestinoSearchText, setTiendaDestinoSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [hasLoadedAllTiendas, setHasLoadedAllTiendas] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearchText, setUserSearchText] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [hasLoadedAllUsers, setHasLoadedAllUsers] = useState(false);
  const [showEstadoDropdown, setShowEstadoDropdown] = useState(false);
  const [showTipoMovimientoDropdown, setShowTipoMovimientoDropdown] = useState(false);
  const [tipoMovimientoSearchText, setTipoMovimientoSearchText] = useState('');
  const [showFechaDesdePicker, setShowFechaDesdePicker] = useState(false);
  const [showFechaHastaPicker, setShowFechaHastaPicker] = useState(false);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  const [isCompletingMovimiento, setIsCompletingMovimiento] = useState(false);

  const predefinedMovimientoTypes = ['Transferencia', 'Ajuste', 'Devolucion'];
  const [customMovimientoTypes, setCustomMovimientoTypes] = useState([]);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();
  const userTiendaId = user?.id_tienda;
  
  // Verificar nivel de acceso a movimientos
  const movimientoAccessLevel = 
    userRole === 'dependiente' ? movimientoAccessLevels?.dependiente :
    userRole === 'almacenero' ? movimientoAccessLevels?.almacenero :
    userRole === 'económico' ? movimientoAccessLevels?.economico : 'all_stores';
  
  const canManageAllTiendas = isAdmin || movimientoAccessLevel === 'all_stores';
  const canManageOwnTienda = movimientoAccessLevel === 'own_store';
  const shouldHideTiendaFilters = canManageOwnTienda && !canManageAllTiendas;

  // Load custom movimiento types
  useEffect(() => {
    const loadCustomMovimientoTypes = async () => {
      try {
        const config = await configService.getConfig();
        if (config.customMovimientoTypes) {
          setCustomMovimientoTypes(config.customMovimientoTypes);
        }
        
        const asyncStorageTypes = await AsyncStorage.getItem('customMovimientoTypes');
        if (asyncStorageTypes) {
          const parsedTypes = JSON.parse(asyncStorageTypes);
          setCustomMovimientoTypes(prev => {
            const combined = [...new Set([...prev, ...parsedTypes])];
            return combined;
          });
        }
      } catch (error) {
        console.error('Error loading custom movimiento types:', error);
      }
    };
    loadCustomMovimientoTypes();
  }, []);

  // Initialize
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Single API call when all data is ready
  useEffect(() => {
    if (isInitialized && !hasDoneInitialFetch.current && !hasRestoredFilters.current) {
      fetchMovimientos();
      hasDoneInitialFetch.current = true;
    }
  }, [isInitialized]);

  // Fetch on pagination changes after initial load
  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchMovimientos();
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

  // Restore saved state only on initial load
  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('movimientos_state');
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          setFilters(parsedState.filters);
          setPagination(prev => ({ ...prev, currentPage: parsedState.pagination.currentPage }));
          // Clear the saved state after restoring to avoid issues
          await AsyncStorage.removeItem('movimientos_state');
        }
      } catch (error) {
        console.error('Error restoring state:', error);
      }
    };
    restoreState();
  }, []);

  const fetchAllTiendas = async () => {
    try {
      setIsLoadingTiendas(true);
      let allTiendas = [];
      
      if (isOfflineMode) {
        return;
      } else {
        const data = await getTiendas({}, 1, 1000);
        allTiendas = data.data || [];
      }
      
      setTiendas(allTiendas);
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

  const fetchMovimientos = async (overrideFilters = null) => {
    try {
      setIsLoading(true);
      setError(null);

      if (isOfflineMode) {
        showToast({ type: 'warning', message: 'No disponible en modo offline' });
        setMovimientos([]);
        setIsLoading(false);
        return;
      }

      // Use override filters if provided, otherwise use current state
      const filtersToUse = overrideFilters || filters;

      const fetchLimit = pagination.limit;
      const fetchPage = pagination.currentPage;

      // Build filters to send to API
      const apiFilters = { ...filtersToUse };

      // Apply movement access level filters
      const userRole = user?.rol?.toLowerCase();
      const isAdmin = userRole === 'administrador';
      const userTiendaId = user?.id_tienda;

      if (!isAdmin && movimientoAccessLevels) {
        const accessLevel = 
          userRole === 'dependiente' ? movimientoAccessLevels.dependiente :
          userRole === 'almacenero' ? movimientoAccessLevels.almacenero :
          userRole === 'económico' ? movimientoAccessLevels.economico : 'none';

        // No enviamos filtro al backend porque no lo soporta
        // Filtraremos en el cliente
      }

      // Remove estado filter if empty to avoid backend validation error
      if (apiFilters.estado === '' || apiFilters.estado === null || apiFilters.estado === undefined) {
        delete apiFilters.estado;
      }

      // Adjust date filters for Cuba timezone before sending to backend
      const adjustedFilters = adjustFiltersForCubaTimezone(apiFilters);

      const data = await getMovimientos(adjustedFilters, fetchPage, fetchLimit);
      let movimientosList = data.data || [];

      // Additional client-side filtering if needed
      if (!isAdmin && movimientoAccessLevels && userTiendaId) {
        const accessLevel = 
          userRole === 'dependiente' ? movimientoAccessLevels.dependiente :
          userRole === 'almacenero' ? movimientoAccessLevels.almacenero :
          userRole === 'económico' ? movimientoAccessLevels.economico : 'none';

        if (accessLevel === 'own_store') {
          movimientosList = movimientosList.filter(movimiento => {
            // Check if user's tienda is in origen or destino
            const origenTiendaId = movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.id_tienda;
            const destinoTiendaId = movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.id_tienda;
            return origenTiendaId === userTiendaId || destinoTiendaId === userTiendaId;
          });
        }
      }

      setMovimientos(movimientosList);
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
    fetchMovimientos();
    
    // Save filters when user explicitly searches
    AsyncStorage.setItem('movimientos_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
  };

  const handleClearFilters = () => {
    const clearedFilters = { 
      tipo_movimiento: '', 
      estado: '', 
      fecha_desde: '', 
      fecha_hasta: '', 
      id_tienda_origen: '', 
      id_tienda_destino: '',
      id_usuario: ''
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchMovimientos(null, clearedFilters);
    
    // Clear saved filters
    AsyncStorage.removeItem('movimientos_filters').catch(err => {
      console.error('Error clearing filters:', err);
    });
  };

  const handleDelete = (movimiento) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Movimiento',
      `¿Estás seguro de que quieres eliminar este movimiento?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMovimiento(movimiento.id_movimiento_lista);
              showToast({ type: 'success', message: 'Movimiento eliminado correctamente' });
              fetchMovimientos();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleCompleteMovimiento = async (movimiento) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Completar Movimiento',
      `¿Estás seguro de que quieres completar este movimiento? Esto moverá el stock de la tienda origen a la tienda destino.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          style: 'default',
          onPress: async () => {
            try {
              setIsCompletingMovimiento(true);
              const { updateMovimiento } = await import('../services/movimientoService');
              const idUsuario = parseInt(user?.id_usuario);
              
              const updateData = {
                estado: true,
                id_usuario: idUsuario,
                tipo_movimiento: movimiento.tipo_movimiento,
                nota: movimiento.nota || '',
                id_tienda_origen: movimiento.id_tienda_origen || movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.id_tienda,
                id_tienda_destino: movimiento.id_tienda_destino || movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.id_tienda,
                movimientos: (movimiento.movimientos || []).map(mov => ({
                  id_servicio: mov.servicio?.id_servicio || mov.id_servicio,
                  cantidad: mov.cantidad,
                  nota: mov.nota || '',
                })),
              };
              
              await updateMovimiento(movimiento.id_movimiento_lista, updateData);
              showToast({ type: 'success', message: 'Movimiento completado correctamente' });
              fetchMovimientos();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            } finally {
              setIsCompletingMovimiento(false);
            }
          },
        },
      ]
    );
  };

  // Helper functions for permission-based button visibility
  const canShowEditDeleteButtons = (movimiento) => {
    const userRole = user?.rol?.toLowerCase();
    const isAdmin = userRole === 'administrador';
    const userTiendaId = user?.id_tienda;

    if (isAdmin) {
      return true;
    }

    if (!movimientoManagePermissions) {
      return false;
    }

    const canManage = 
      userRole === 'dependiente' ? movimientoManagePermissions.dependiente :
      userRole === 'almacenero' ? movimientoManagePermissions.almacenero :
      userRole === 'económico' ? movimientoManagePermissions.economico : false;

    if (!canManage) {
      return false;
    }

    const accessLevel = 
      userRole === 'dependiente' ? movimientoAccessLevels.dependiente :
      userRole === 'almacenero' ? movimientoAccessLevels.almacenero :
      userRole === 'económico' ? movimientoAccessLevels.economico : 'none';

    // If user has "own_store" access, only show edit/delete if their tienda is origen
    if (accessLevel === 'own_store' && userTiendaId) {
      const origenTiendaId = movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.id_tienda;
      return origenTiendaId === userTiendaId;
    }

    // If user has "all_stores" access, show edit/delete
    if (accessLevel === 'all_stores') {
      return true;
    }

    return false;
  };

  const canShowCompleteButton = (movimiento) => {
    const userRole = user?.rol?.toLowerCase();
    const isAdmin = userRole === 'administrador';
    const userTiendaId = user?.id_tienda;

    // Only show complete button if movement is pending
    if (movimiento.estado === true || movimiento.estado === 1) {
      return false;
    }

    // Admin always sees complete button for pending movements
    if (isAdmin) {
      return true;
    }

    if (!movimientoManagePermissions) {
      return false;
    }

    const canManage = 
      userRole === 'dependiente' ? movimientoManagePermissions.dependiente :
      userRole === 'almacenero' ? movimientoManagePermissions.almacenero :
      userRole === 'económico' ? movimientoManagePermissions.economico : false;

    if (!canManage) {
      return false;
    }

    const accessLevel = 
      userRole === 'dependiente' ? movimientoAccessLevels.dependiente :
      userRole === 'almacenero' ? movimientoAccessLevels.almacenero :
      userRole === 'económico' ? movimientoAccessLevels.economico : 'none';

    // If user has "own_store" access, only show complete button if their tienda is destino
    if (accessLevel === 'own_store' && userTiendaId) {
      const destinoTiendaId = movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.id_tienda;
      return destinoTiendaId === userTiendaId;
    }

    // If user has "all_stores" access, show complete button
    if (accessLevel === 'all_stores') {
      return true;
    }

    return false;
  };

  const handleMovimientoPress = (movimiento) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    // Save current filters and pagination before navigating
    const stateToSave = {
      filters,
      pagination: { currentPage: pagination.currentPage }
    };
    AsyncStorage.setItem('movimientos_state', JSON.stringify(stateToSave)).catch(err => {
      console.error('Error saving state:', err);
    });
    
    // Navigate to edit mode if user has permissions, otherwise view mode
    const canEdit = canShowEditDeleteButtons(movimiento);
    const mode = canEdit ? 'edit' : 'view';
    navigation.navigate('MovimientoForm', { movimiento, mode });
  };

  const handleEdit = (movimiento) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    // Save current filters and pagination before navigating
    const stateToSave = {
      filters,
      pagination: { currentPage: pagination.currentPage }
    };
    AsyncStorage.setItem('movimientos_state', JSON.stringify(stateToSave)).catch(err => {
      console.error('Error saving state:', err);
    });
    
    navigation.navigate('MovimientoForm', { movimiento, mode: 'edit' });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    // Save current filters and pagination before navigating
    const stateToSave = {
      filters,
      pagination: { currentPage: pagination.currentPage }
    };
    AsyncStorage.setItem('movimientos_state', JSON.stringify(stateToSave)).catch(err => {
      console.error('Error saving state:', err);
    });
    
    navigation.navigate('MovimientoForm', { mode: 'add' });
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

  // Format a Date object to YYYY-MM-DD using local timezone (avoids UTC offset issues)
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse a YYYY-MM-DD string to a Date object using local timezone
  const parseLocalDate = (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
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

  const getEstadoColor = (estado) => {
    if (estado === true) {
      return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', label: 'Completado' };
    } else {
      return { color: '#FF9800', bgColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', borderColor: '#FF9800', label: 'Pendiente' };
    }
  };

  const filteredTiendasOrigen = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaOrigenSearchText.toLowerCase())
  );

  const filteredTiendasDestino = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaDestinoSearchText.toLowerCase())
  );

  const filteredUsers = users.filter(userItem =>
    userItem.nombre_natural.toLowerCase().includes(userSearchText.toLowerCase())
  );

  // Adjust date filters for Cuba timezone (UTC-4) before sending to backend
  const adjustFiltersForCubaTimezone = (filters) => {
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
        currentRoute="Movimientos"
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
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Movimientos</Text>
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
            <Text style={[styles.label, { color: colors.outline }]}>Tipo de Movimiento</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
              onPress={() => setShowTipoMovimientoDropdown(true)}
            >
              <Text style={[styles.inputText, { color: filters.tipo_movimiento ? colors.onSurface : colors.outline, flex: 1 }]}>
                {filters.tipo_movimiento || 'Todos'}
              </Text>
              <Ionicons name={showTipoMovimientoDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
            </TouchableOpacity>
            {showTipoMovimientoDropdown && (
              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => {
                      const newFilters = { ...filters, tipo_movimiento: '' };
                      setFilters(newFilters);
                      setShowTipoMovimientoDropdown(false);
                      setTipoMovimientoSearchText('');
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                      fetchMovimientos(newFilters);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos</Text>
                  </TouchableOpacity>
                  {[...predefinedMovimientoTypes, ...customMovimientoTypes]
                    .filter(t => t.toLowerCase().includes(tipoMovimientoSearchText.toLowerCase()))
                    .map((type, index) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.dropdownItem, index === ([...predefinedMovimientoTypes, ...customMovimientoTypes].filter(t => t.toLowerCase().includes(tipoMovimientoSearchText.toLowerCase())).length - 1) && styles.dropdownItemLast]}
                        onPress={() => {
                          const newFilters = { ...filters, tipo_movimiento: type };
                          setFilters(newFilters);
                          setShowTipoMovimientoDropdown(false);
                          setTipoMovimientoSearchText('');
                          setPagination(prev => ({ ...prev, currentPage: 1 }));
                          fetchMovimientos(newFilters);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
          </View>

          {showAdvancedFilters && (
            <>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowEstadoDropdown(!showEstadoDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: filters.estado !== '' ? colors.onSurface : colors.outline }]}>
                    {filters.estado === '' ? 'Todos' : filters.estado === 'true' ? 'Completado' : 'Pendiente'}
                  </Text>
                  <Ionicons 
                    name={showEstadoDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                {showEstadoDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        const newFilters = { ...filters, estado: '' };
                        setFilters(newFilters);
                        setShowEstadoDropdown(false);
                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                        fetchMovimientos(newFilters);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        const newFilters = { ...filters, estado: true };
                        setFilters(newFilters);
                        setShowEstadoDropdown(false);
                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                        fetchMovimientos(newFilters);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Completado</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.dropdownItem, styles.dropdownItemLast]}
                      onPress={() => {
                        const newFilters = { ...filters, estado: false };
                        setFilters(newFilters);
                        setShowEstadoDropdown(false);
                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                        fetchMovimientos(newFilters);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Pendiente</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {!shouldHideTiendaFilters && (
                <View style={styles.filterGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tienda Origen</Text>
                  <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setShowTiendaOrigenDropdown(!showTiendaOrigenDropdown);
                    if (!hasLoadedAllTiendas && !isLoadingTiendas) {
                      fetchAllTiendas();
                    }
                  }}
                >
                  <Text style={[styles.dropdownText, { color: filters.id_tienda_origen ? colors.onSurface : colors.outline }]}>
                    {tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda_origen))?.nombre || 'Todas las tiendas'}
                  </Text>
                  <Ionicons 
                    name={showTiendaOrigenDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showTiendaOrigenDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {isLoadingTiendas && (
                      <View style={styles.dropdownLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando tiendas...</Text>
                      </View>
                    )}
                    {!isLoadingTiendas && (
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
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
                            value={tiendaOrigenSearchText}
                            onChangeText={setTiendaOrigenSearchText}
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            const newFilters = { ...filters, id_tienda_origen: '' };
                            setFilters(newFilters);
                            setShowTiendaOrigenDropdown(false);
                            setTiendaOrigenSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos(newFilters);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las tiendas</Text>
                        </TouchableOpacity>
                        {filteredTiendasOrigen.length > 0 ? (
                          filteredTiendasOrigen.map((tienda, index) => (
                            <TouchableOpacity
                              key={tienda.id_tienda}
                              style={[styles.dropdownItem, index === filteredTiendasOrigen.length - 1 && styles.dropdownItemLast]}
                              onPress={() => {
                                const newFilters = { ...filters, id_tienda_origen: tienda.id_tienda.toString() };
                                setFilters(newFilters);
                                setShowTiendaOrigenDropdown(false);
                                setTiendaOrigenSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchMovimientos(newFilters);
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
                    )}
                  </View>
                )}
                </View>
              )}

              {!shouldHideTiendaFilters && (
                <View style={styles.filterGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tienda Destino</Text>
                  <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setShowTiendaDestinoDropdown(!showTiendaDestinoDropdown);
                    if (!hasLoadedAllTiendas && !isLoadingTiendas) {
                      fetchAllTiendas();
                    }
                  }}
                >
                  <Text style={[styles.dropdownText, { color: filters.id_tienda_destino ? colors.onSurface : colors.outline }]}>
                    {tiendas.find(t => t.id_tienda === parseInt(filters.id_tienda_destino))?.nombre || 'Todas las tiendas'}
                  </Text>
                  <Ionicons 
                    name={showTiendaDestinoDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showTiendaDestinoDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {isLoadingTiendas && (
                      <View style={styles.dropdownLoadingContainer}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.dropdownLoadingText, { color: colors.outline }]}>Cargando tiendas...</Text>
                      </View>
                    )}
                    {!isLoadingTiendas && (
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
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
                            value={tiendaDestinoSearchText}
                            onChangeText={setTiendaDestinoSearchText}
                          />
                        </View>
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => {
                            const newFilters = { ...filters, id_tienda_destino: '' };
                            setFilters(newFilters);
                            setShowTiendaDestinoDropdown(false);
                            setTiendaDestinoSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos(newFilters);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las tiendas</Text>
                        </TouchableOpacity>
                        {filteredTiendasDestino.length > 0 ? (
                          filteredTiendasDestino.map((tienda, index) => (
                            <TouchableOpacity
                              key={tienda.id_tienda}
                              style={[styles.dropdownItem, index === filteredTiendasDestino.length - 1 && styles.dropdownItemLast]}
                              onPress={() => {
                                const newFilters = { ...filters, id_tienda_destino: tienda.id_tienda.toString() };
                                setFilters(newFilters);
                                setShowTiendaDestinoDropdown(false);
                                setTiendaDestinoSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchMovimientos(newFilters);
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
                    )}
                  </View>
                )}
                </View>
              )}

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Usuario</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setShowUserDropdown(!showUserDropdown);
                    if (!hasLoadedAllUsers && !isLoadingUsers) {
                      fetchAllUsers();
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
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
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
                            const newFilters = { ...filters, id_usuario: '' };
                            setFilters(newFilters);
                            setShowUserDropdown(false);
                            setUserSearchText('');
                            setPagination(prev => ({ ...prev, currentPage: 1 }));
                            fetchMovimientos(newFilters);
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
                                const newFilters = { ...filters, id_usuario: userItem.id_usuario.toString() };
                                setFilters(newFilters);
                                setShowUserDropdown(false);
                                setUserSearchText('');
                                setPagination(prev => ({ ...prev, currentPage: 1 }));
                                fetchMovimientos(newFilters);
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
                    )}
                  </View>
                )}
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
          {!isOfflineMode && (isAdmin || (movimientoManagePermissions && (
            (userRole === 'dependiente' && movimientoManagePermissions.dependiente) ||
            (userRole === 'almacenero' && movimientoManagePermissions.almacenero) ||
            (userRole === 'económico' && movimientoManagePermissions.economico)
          ))) && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Movimiento</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Movimientos List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando movimientos...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchMovimientos}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : movimientos.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="swap-horizontal-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron movimientos
            </Text>
          </Card>
        ) : (
          <>
            {viewMode === 'card' ? (
              movimientos.map((movimiento) => (
                <TouchableOpacity
                  key={movimiento.id_movimiento_lista}
                  onPress={() => handleMovimientoPress(movimiento)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.movimientoCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.movimientoFlagsContainer}>
                      <View style={[styles.estadoFlag, { backgroundColor: movimiento.estado ? '#4CAF50' : '#FF9800' }]}>
                        <Ionicons name={movimiento.estado ? "checkmark" : "alert"} size={responsive.responsiveWidth(14)} color="#fff" />
                      </View>
                      {movimiento.nota && (
                        <View style={[styles.noteFlag, styles.noteFlagOverlapped, { backgroundColor: '#2196F3' }]}>
                          <Ionicons name="document-text-outline" size={responsive.responsiveWidth(14)} color="#fff" />
                        </View>
                      )}
                    </View>
                    <View style={styles.movimientoInfo}>
                      <View style={styles.movimientoHeader}>
                        <View style={styles.movimientoTiendasContainer}>
                          <View style={[styles.tiendaBadge, { backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', borderColor: '#2196F3' }]}>
                            <Text style={[styles.tiendaBadgeText, { color: '#2196F3' }]}>
                              {movimiento.tienda_origen?.nombre || 
                               movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.nombre || 
                               movimiento.movimientos?.[0]?.tiendaOrigen?.nombre || 
                               'N/A'}
                            </Text>
                          </View>
                          <Ionicons name="arrow-forward" size={responsive.responsiveWidth(16)} color={colors.outline} />
                          <View style={[styles.tiendaBadge, { backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', borderColor: '#FF9800' }]}>
                            <Text style={[styles.tiendaBadgeText, { color: '#FF9800' }]}>
                              {movimiento.tienda_destino?.nombre || 
                               movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.nombre || 
                               movimiento.movimientos?.[0]?.tiendaDestino?.nombre || 
                               'N/A'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <Text style={[styles.movimientoFecha, { color: colors.outline }]}>
                        Fecha: {toCubaDate(movimiento.fecha_hora)}
                      </Text>
                      <Text style={[styles.movimientoUsuario, { color: colors.outline }]}>
                        Usuario: {movimiento.usuario?.nombre_natural || 'N/A'}
                      </Text>
                      <Text style={[styles.movimientoItems, { color: colors.primary }]}>
                        {movimiento.movimientos?.length || 0} productos
                      </Text>
                    </View>
                    <View style={styles.movimientoActions}>
                      {canShowEditDeleteButtons(movimiento) && (
                        <>
                          <TouchableOpacity
                            style={[styles.actionButtonSmall, styles.editButtonSmall, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleEdit(movimiento);
                            }}
                          >
                            <Ionicons name="create-outline" size={responsive.responsiveWidth(20)} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButtonSmall, styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDelete(movimiento);
                            }}
                          >
                            <Ionicons name="trash-outline" size={responsive.responsiveWidth(20)} color={colors.error} />
                          </TouchableOpacity>
                        </>
                      )}
                      {canShowCompleteButton(movimiento) && (
                        <TouchableOpacity
                          style={[styles.actionButtonSmall, styles.completeButtonSmall, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleCompleteMovimiento(movimiento);
                          }}
                          disabled={isCompletingMovimiento}
                        >
                          {isCompletingMovimiento ? (
                            <ActivityIndicator size="small" color="#4CAF50" />
                          ) : (
                            <Image source={require('../../assets/success.png')} style={[styles.completeIcon, { tintColor: isDarkMode ? '#fff' : undefined }]} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                </TouchableOpacity>
              ))
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollView}>
                <View style={styles.tableContainer}>
                <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(140) }]}>Origen</Text>
                  <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(140) }]}>Destino</Text>
                  <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(80) }]}>Estado</Text>
                  <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(180) }]}>Usuario</Text>
                  <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Fecha</Text>
                  <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(80), textAlign: 'center' }]}>Productos</Text>
                  <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                </View>
                {movimientos.map((movimiento, index) => {
                  return (
                    <TouchableOpacity
                      key={movimiento.id_movimiento_lista}
                      onPress={() => handleMovimientoPress(movimiento)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                        <View style={[styles.tableCell, { width: responsive.responsiveWidth(140) }]}>
                          <View style={[styles.tableTiendaBadge, { backgroundColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', borderColor: '#2196F3' }]}>
                            <Text style={[styles.tableTiendaBadgeText, { color: '#2196F3' }]}>
                              {movimiento.tienda_origen?.nombre || 
                               movimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda?.nombre || 
                               movimiento.movimientos?.[0]?.tiendaOrigen?.nombre || 
                               'N/A'}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.tableCell, { width: responsive.responsiveWidth(140) }]}>
                          <View style={[styles.tableTiendaBadge, { backgroundColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', borderColor: '#FF9800' }]}>
                            <Text style={[styles.tableTiendaBadgeText, { color: '#FF9800' }]}>
                              {movimiento.tienda_destino?.nombre || 
                               movimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda?.nombre || 
                               movimiento.movimientos?.[0]?.tiendaDestino?.nombre || 
                               'N/A'}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.tableCell, { width: responsive.responsiveWidth(80), alignItems: 'center' }]}>
                          <View style={styles.tableFlagsRow}>
                            <View style={[styles.tableEstadoFlag, { backgroundColor: movimiento.estado ? '#4CAF50' : '#FF9800' }]}>
                              <Ionicons name={movimiento.estado ? "checkmark" : "alert"} size={responsive.responsiveWidth(12)} color="#fff" />
                            </View>
                            {movimiento.nota && (
                              <View style={[styles.tableNoteFlag, { backgroundColor: '#2196F3' }]}>
                                <Ionicons name="document-text-outline" size={responsive.responsiveWidth(12)} color="#fff" />
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(180) }]}>
                          {movimiento.usuario?.nombre_natural || 'N/A'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                          {toCubaDate(movimiento.fecha_hora)}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(80), textAlign: 'center' }]}>
                          {movimiento.movimientos?.length || 0}
                        </Text>
                        <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                          <View style={styles.tableActionsRow}>
                            {canShowEditDeleteButtons(movimiento) && (
                              <>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleEdit(movimiento);
                                  }}
                                >
                                  <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDelete(movimiento);
                                  }}
                                >
                                  <Ionicons name="trash-outline" size={responsive.responsiveWidth(18)} color={colors.error} />
                                </TouchableOpacity>
                              </>
                            )}
                            {canShowCompleteButton(movimiento) && (
                              <TouchableOpacity
                                style={[styles.tableActionButton, styles.tableCompleteButton, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9' }]}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleCompleteMovimiento(movimiento);
                                }}
                                disabled={isCompletingMovimiento}
                              >
                                {isCompletingMovimiento ? (
                                  <ActivityIndicator size="small" color="#4CAF50" />
                                ) : (
                                  <Image source={require('../../assets/success.png')} style={[styles.tableCompleteIcon, { tintColor: isDarkMode ? '#fff' : undefined }]} />
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              </ScrollView>
            )}

            {/* Pagination */}
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={handlePrevPage}
                disabled={pagination.currentPage === 1}
              >
                <Ionicons name="chevron-back" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
              </TouchableOpacity>
              <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                Página {pagination.currentPage} de {pagination.totalPages}
              </Text>
              <TouchableOpacity
                style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={handleNextPage}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                <Ionicons name="chevron-forward" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const MovimientosScreen = () => <MovimientosContent />;

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
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(8),
    maxHeight: responsive.responsiveHeight(200),
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(200),
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
    padding: responsive.responsivePadding(12),
    gap: responsive.responsiveMargin(8),
  },
  dropdownLoadingText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
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
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    gap: responsive.responsiveMargin(8),
  },
  addButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  errorCard: {
    alignItems: 'center',
    padding: responsive.responsivePadding(40),
    borderRadius: 16,
  },
  errorText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: responsive.responsiveMargin(16),
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  emptyCard: {
    alignItems: 'center',
    padding: responsive.responsivePadding(40),
    borderRadius: 16,
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  movimientoCard: {
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
  movimientoFlagsContainer: {
    position: 'absolute',
    top: -8,
    left: -8,
    flexDirection: 'row',
    gap: responsive.responsiveMargin(4),
    zIndex: 1,
  },
  movimientoInfo: {
    flex: 1,
  },
  movimientoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  movimientoTiendasContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    flex: 1,
  },
  tiendaBadge: {
    paddingHorizontal: responsive.responsivePadding(10),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 8,
    borderWidth: 1,
  },
  tiendaBadgeText: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  movimientoFlags: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(4),
  },
  estadoFlag: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
    borderRadius: responsive.responsiveWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteFlag: {
    width: responsive.responsiveWidth(24),
    height: responsive.responsiveHeight(24),
    borderRadius: responsive.responsiveWidth(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteFlagOverlapped: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  movimientoTipo: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  estadoBadge: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 4,
    borderWidth: 1,
  },
  estadoBadgeText: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  movimientoFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  movimientoUsuario: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  movimientoNota: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  movimientoItems: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  movimientoActions: {
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
  editButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteButtonSmall: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  completeButtonSmall: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  completeIcon: {
    width: responsive.responsiveWidth(20),
    height: responsive.responsiveHeight(20),
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
  tableCell: {
    flex: 1,
  },
  tableTiendaBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 6,
    borderWidth: 1,
  },
  tableTiendaBadgeText: {
    fontSize: responsive.responsiveFontSize(11),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  tableFlagsRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(4),
    alignItems: 'center',
  },
  tableEstadoFlag: {
    width: responsive.responsiveWidth(18),
    height: responsive.responsiveHeight(18),
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableNoteFlag: {
    width: responsive.responsiveWidth(18),
    height: responsive.responsiveHeight(18),
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableEstadoCell: {
    flex: 1,
    alignItems: 'flex-start',
  },
  tableEstadoBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 4,
    borderWidth: 1,
  },
  tableEstadoBadgeText: {
    fontSize: responsive.responsiveFontSize(11),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  tableActionsCell: {
    width: responsive.responsiveWidth(100),
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
  tableCompleteButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  tableCompleteIcon: {
    width: responsive.responsiveWidth(18),
    height: responsive.responsiveHeight(18),
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(16),
    paddingVertical: responsive.responsivePadding(16),
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
});

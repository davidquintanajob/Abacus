import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
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
import { getVentas, deleteVenta } from '../services/ventaService';
import { getTiendas } from '../services/tiendaService';
import { getUsuarios } from '../services/usuarioService';
import { getServicios } from '../services/servicioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { storageService } from '../services/storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const VentasContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, ventaAccessLevels, ventaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  const [isInitialized, setIsInitialized] = useState(false);
  const [userTiendaReady, setUserTiendaReady] = useState(false);
  const hasDoneInitialFetch = useRef(false);
  const isFirstFocus = useRef(true);
  const isInitializedRef = useRef(false);
  const filtersRef = useRef(filters);
  const userTiendaRef = useRef(user?.id_tienda);

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

  // Filter states
  const [filters, setFilters] = useState({ 
    nota: '', 
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
          } catch (error) {
            console.error('Error restoring filters:', error);
            fetchVentas();
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
      console.error('Error fetching tiendas:', error);
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
      console.error('Error fetching users:', error);
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
        const data = await getServicios(filters, 1, 10);
        allServicios = data.data || [];
      }
      
      setServicios(allServicios);
      setHasLoadedAllServicios(true);
    } catch (error) {
      console.error('Error fetching servicios:', error);
      showToast({ type: 'error', message: 'Error al cargar servicios' });
    } finally {
      setIsLoadingServicios(false);
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

      let data;
      if (isOfflineMode) {
        data = await storageService.getVentas(effectiveFilters, pagination.currentPage, pagination.limit);
      } else {
        data = await getVentas(effectiveFilters, pagination.currentPage, pagination.limit);
      }

      setVentas(data.data || []);
      setPagination(prev => ({
        ...prev,
        totalPages: data.pagination?.totalPages || 1,
        totalItems: data.pagination?.total || 0
      }));

      await AsyncStorage.setItem('ventas_filters', JSON.stringify(effectiveFilters));
    } catch (error) {
      console.error('Error fetching ventas:', error);
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
              } else {
                await deleteVenta(venta.id_lista_venta);
                showToast({ type: 'success', message: 'Venta eliminada correctamente' });
                fetchVentas();
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
    // TODO: Navigate to venta detail screen when implemented
    console.log('Venta pressed:', venta);
  };

  const handleFechaDesdeChange = (event, selectedDate) => {
    setShowFechaDesdePicker(false);
    if (selectedDate) {
      setFilters(prev => ({ ...prev, fecha_desde: selectedDate.toISOString().split('T')[0] }));
    }
  };

  const handleFechaHastaChange = (event, selectedDate) => {
    setShowFechaHastaPicker(false);
    if (selectedDate) {
      setFilters(prev => ({ ...prev, fecha_hasta: selectedDate.toISOString().split('T')[0] }));
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                <Text style={[styles.label, { color: colors.outline }]}>Nombre de Servicio</Text>
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

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          {!isOfflineMode && canManageVentas && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                // TODO: Navigate to VentaFormScreen when implemented
                showToast({ type: 'info', message: 'Formulario de venta en desarrollo' });
              }}
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
                  <Card style={[styles.ventaCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.ventaInfo}>
                      <View style={styles.ventaHeader}>
                        <Text style={[styles.ventaNota, { color: colors.onSurface }]} numberOfLines={2} ellipsizeMode="tail">
                          {venta.nota || 'Sin nota'}
                        </Text>
                      </View>
                      <Text style={[styles.ventaTienda, { color: colors.outline }]}>
                        Tienda: {venta.usuario?.tienda?.nombre || 'N/A'}
                      </Text>
                      <Text style={[styles.ventaUsuario, { color: colors.outline }]}>
                        Usuario: {venta.usuario?.nombre_natural || 'N/A'}
                      </Text>
                      <View style={styles.cantidadRow}>
                        <Text style={[styles.ventaCantidad, { color: colors.primary }]}>
                          Total CUP: ${venta.cantidad_cobrada_efectivo_cup || 0}
                        </Text>
                        <Text style={[styles.ventaCantidad, { color: colors.primary }]}>
                          Total USD: ${venta.cantidad_cobrada_efectivo_usd || 0}
                        </Text>
                      </View>
                      <Text style={[styles.ventaFecha, { color: colors.outline }]}>
                        Fecha: {new Date(venta.fecha_hora).toLocaleDateString()}
                      </Text>
                    </View>
                    {canManageVentas && (
                      <View style={styles.ventaActions}>
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
                      <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]} numberOfLines={2}>
                          {venta.nota || 'Sin nota'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                          {venta.usuario?.tienda?.nombre || 'N/A'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                          {venta.usuario?.nombre_natural || 'N/A'}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                          ${venta.cantidad_cobrada_efectivo_cup || 0}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100), textAlign: 'center' }]}>
                          ${venta.cantidad_cobrada_efectivo_usd || 0}
                        </Text>
                        <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                          {new Date(venta.fecha_hora).toLocaleDateString()}
                        </Text>
                        {canManageVentas && (
                          <View style={[styles.tableCellText, { width: responsive.responsiveWidth(100), justifyContent: 'center' }]}>
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
                  disabled={pagination.currentPage === 1}
                >
                  <Ionicons name="chevron-back" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                </TouchableOpacity>
                <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                  Página {pagination.currentPage} de {pagination.totalPages}
                </Text>
                <TouchableOpacity
                  style={[styles.paginationButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => setPagination(prev => ({ ...prev, currentPage: Math.min(pagination.totalPages, prev.currentPage + 1) }))}
                  disabled={pagination.currentPage === pagination.totalPages}
                >
                  <Ionicons name="chevron-forward" size={responsive.responsiveWidth(20)} color={colors.onSurface} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
});

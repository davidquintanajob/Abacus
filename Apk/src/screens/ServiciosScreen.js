import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Modal } from 'react-native';
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
import { getServicios, getServicioByCodigo, deleteServicio } from '../services/servicioService';
import { getTiendas } from '../services/tiendaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { CameraView, Camera } from 'expo-camera';
import { storageService } from '../services/storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ServiciosContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [servicios, setServicios] = useState([]);
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
  const [filters, setFilters] = useState({ nombre: '', codigo: '', categoria: '', esvendible: '', id_tienda: '' });
  const [tiendas, setTiendas] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [isLoadingTiendas, setIsLoadingTiendas] = useState(false);
  const [hasLoadedAllTiendas, setHasLoadedAllTiendas] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const canEdit = isAdmin;

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


  // Single API call when all data is ready
  useEffect(() => {
    if (userTiendaReady && !hasDoneInitialFetch.current) {
      fetchServicios();
      hasDoneInitialFetch.current = true;
    }
  }, [userTiendaReady]);

  // Fetch on pagination changes after initial load
  useEffect(() => {
    if (hasDoneInitialFetch.current) {
      fetchServicios();
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
            const savedFilters = await AsyncStorage.getItem('servicios_filters');
            if (savedFilters) {
              const parsedFilters = JSON.parse(savedFilters);
              setFilters(parsedFilters);
              fetchServicios(parsedFilters.id_tienda);
            } else {
              // Restore user's tienda filter if it's empty and user has a tienda
              const shouldRestore = !filtersRef.current.id_tienda && userTiendaRef.current;
              if (shouldRestore) {
                setFilters(prev => ({ ...prev, id_tienda: userTiendaRef.current.toString() }));
                fetchServicios(userTiendaRef.current.toString());
              } else {
                fetchServicios();
              }
            }
          } catch (error) {
            console.error('Error restoring filters:', error);
            fetchServicios();
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
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.dependiente) ||
        (userRole === 'almacenero' && permissions?.almacenero) ||
        (userRole === 'económico' && permissions?.economico);

      let allTiendas = [];
      
      if (isOfflineMode) {
        // En modo offline, cargar tiendas de AsyncStorage
        allTiendas = await storageService.getTiendas();
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

  const fetchServicios = async (overrideIdTienda = null) => {
    try {
      setIsLoading(true);
      setError(null);

      // Modo offline: usar datos de AsyncStorage
      if (isOfflineMode) {
        const allServicios = await storageService.getServicios();
        
        if (filters.codigo) {
          // Buscar por código específico en el array de códigos
          // Excluir servicios que tienen un producto asociado (productos)
          const filtered = allServicios.filter(s => 
            !s.producto && !s.hasProducto &&
            s.codigos?.some(c => c.codigo_barras_ean?.toLowerCase() === filters.codigo.toLowerCase())
          );
          setServicios(filtered);
          setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: filtered.length });
        } else {
          // Aplicar filtros localmente
          const filteredServicios = await storageService.filterServiciosLocal(filters);
          
          // Paginación cliente
          const totalFilteredItems = filteredServicios.length;
          const totalFilteredPages = Math.ceil(totalFilteredItems / pagination.limit);
          const startIndex = (pagination.currentPage - 1) * pagination.limit;
          const endIndex = startIndex + pagination.limit;
          const paginatedServicios = filteredServicios.slice(startIndex, endIndex);
          
          setServicios(paginatedServicios);
          setPagination({
            currentPage: pagination.currentPage,
            limit: pagination.limit,
            totalPages: totalFilteredPages,
            totalItems: totalFilteredItems
          });
        }
        setIsLoading(false);
        setIsSearching(false);
        return;
      }

      // Modo online: usar API
      // Si hay código, usar el endpoint específico /servicio/codigo/:codigo
      if (filters.codigo) {
        try {
          const servicio = await getServicioByCodigo(filters.codigo);
          
          // Devolver como array con una sola posición para mantener la estructura
          setServicios([servicio]);
          setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 1 });
        } catch (error) {
          // Si no se encuentra el servicio, mostrar lista vacía
          setServicios([]);
          setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
        }
      } else {
        // Check if any filters are active (excluding id_tienda if it's just the user's default store)
        const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
          // Don't count id_tienda as an active filter if it's just the user's default store
          if (key === 'id_tienda' && value === user?.id_tienda?.toString()) {
            return false;
          }
          return value !== '' && value !== null && value !== undefined;
        });
        
        // Always use standard pagination from backend
        const fetchLimit = pagination.limit;
        const fetchPage = pagination.currentPage;
        
        // Use overrideIdTienda if provided (for immediate filter changes)
        const apiFilters = { ...filters };
        if (overrideIdTienda !== null) {
          apiFilters.id_tienda = overrideIdTienda;
        }
        
        const data = await getServicios(apiFilters, fetchPage, fetchLimit);
        let servicios = data.data || [];

        // Apply store visibility permissions
        const userRole = user?.rol?.toLowerCase();
        const canViewAllStores = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && permissions?.dependiente) ||
          (userRole === 'almacenero' && permissions?.almacenero) ||
          (userRole === 'económico' && permissions?.economico);

        // If user cannot view all stores, filter to show only services from their own store
        if (!canViewAllStores && user?.id_tienda) {
          servicios = servicios.filter(s => {
            // Check if the service belongs to the user's store via tiendas_servicio
            return s.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
          });
        }

        setServicios(servicios);
        setPagination(data.pagination || pagination);
      }
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
    fetchServicios();
  };

  const handleClearFilters = () => {
    // Check if user can view all stores
    const userRole = user?.rol?.toLowerCase();
    const canViewAllStores = 
      userRole === 'administrador' ||
      (userRole === 'dependiente' && permissions?.dependiente) ||
      (userRole === 'almacenero' && permissions?.almacenero) ||
      (userRole === 'económico' && permissions?.economico);

    // Preserve tienda filter only for users without permission
    const clearedFilters = { 
      nombre: '', 
      codigo: '', 
      categoria: '', 
      esvendible: '', 
      id_tienda: (!canViewAllStores && user?.id_tienda) ? user.id_tienda.toString() : '' 
    };
    
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    // Pass cleared filters directly to avoid stale state
    fetchServicios(clearedFilters.id_tienda);
  };

  const handleDelete = (servicio) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    Alert.alert(
      'Eliminar Servicio',
      `¿Estás seguro de que quieres eliminar el servicio "${servicio.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteServicio(servicio.id_servicio);
              showToast({ type: 'success', message: 'Servicio eliminado correctamente' });
              fetchServicios();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleServicioPress = (servicio) => {
    // Save current filters before navigating
    AsyncStorage.setItem('servicios_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    const mode = canEdit ? 'edit' : 'view';
    const isOferta = servicio.componentes && servicio.componentes.length > 0;
    navigation.navigate('ServicioForm', { servicio, mode, isOferta });
  };

  const handleEdit = (servicio) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    // Save current filters before navigating
    AsyncStorage.setItem('servicios_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('ServicioForm', { servicio, mode: 'edit' });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    
    // Save current filters before navigating
    AsyncStorage.setItem('servicios_filters', JSON.stringify(filters)).catch(err => {
      console.error('Error saving filters:', err);
    });
    
    navigation.navigate('ServicioForm', { mode: 'add', isOferta: false });
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
    setShowScannerModal(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    // Clear all fields except tienda before searching by code
    const userRole = user?.rol?.toLowerCase();
    const canViewAllStores = 
      userRole === 'administrador' ||
      (userRole === 'dependiente' && permissions?.dependiente) ||
      (userRole === 'almacenero' && permissions?.almacenero) ||
      (userRole === 'económico' && permissions?.economico);

    const clearedFilters = { 
      nombre: '', 
      codigo: data, 
      categoria: '', 
      esvendible: '', 
      id_tienda: (!canViewAllStores && user?.id_tienda) ? user.id_tienda.toString() : filters.id_tienda 
    };
    
    setFilters(clearedFilters);
    setShowScannerModal(false);
    showToast({ type: 'success', message: 'Código escaneado correctamente' });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchServicios();
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  // Check if user can view all stores
  const userRole = user?.rol?.toLowerCase();
  const canViewAllStores = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && permissions?.dependiente) ||
    (userRole === 'almacenero' && permissions?.almacenero) ||
    (userRole === 'económico' && permissions?.economico);

  // Get price for a service based on user permissions
  const getServicePrice = (servicio) => {
    if (!servicio.tiendas_servicio || servicio.tiendas_servicio.length === 0) {
      return 0;
    }

    // Filter tiendas_servicio based on user permissions
    let visibleTiendasServicio = servicio.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = servicio.tiendas_servicio.filter(ts => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      // Show price for specific store
      const tiendaServicio = visibleTiendasServicio.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.precio_cup || 0;
    } else {
      // Show price from first visible store
      return visibleTiendasServicio[0]?.precio_cup || 0;
    }
  };

  // Get price in USD for a service based on user permissions
  const getServicePriceUSD = (servicio) => {
    if (!servicio.tiendas_servicio || servicio.tiendas_servicio.length === 0) {
      return 0;
    }

    // Filter tiendas_servicio based on user permissions
    let visibleTiendasServicio = servicio.tiendas_servicio;
    if (!canViewAllStores && user?.id_tienda) {
      visibleTiendasServicio = servicio.tiendas_servicio.filter(ts => ts.id_tienda === user.id_tienda);
    }

    if (filters.id_tienda) {
      // Show price for specific store
      const tiendaServicio = visibleTiendasServicio.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
      return tiendaServicio?.precio_usd || 0;
    } else {
      // Show price from first visible store
      return visibleTiendasServicio[0]?.precio_usd || 0;
    }
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
        keyboardVerticalOffset={responsive.headerHeight + 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Servicios</Text>
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
            <Text style={[styles.label, { color: colors.outline }]}>Nombre</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholderTextColor={colors.outline}
              placeholder="Buscar por nombre..."
              value={filters.nombre}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre: text }))}
            />
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
                      setFilters(prev => ({ ...prev, id_tienda: '' }));
                      setShowTiendaDropdown(false);
                      setTiendaSearchText('');
                      setPagination(prev => ({ ...prev, currentPage: 1 }));
                      fetchServicios('');
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
                        fetchServicios(newIdTienda);
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
                <Text style={[styles.label, { color: colors.outline }]}>Código</Text>
                <View style={[styles.inputWithIcon, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                  <TextInput
                    style={[styles.inputWithIconText, { color: colors.onSurface }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Buscar por código de barras..."
                    value={filters.codigo}
                    onChangeText={(text) => setFilters(prev => ({ ...prev, codigo: text }))}
                  />
                  <TouchableOpacity
                    onPress={handleOpenScanner}
                    style={styles.cameraButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="camera-outline" 
                      size={responsive.responsiveWidth(20)} 
                      color={colors.primary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Categoría</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Buscar por categoría..."
                  value={filters.categoria}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, categoria: text }))}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
                <View style={styles.statusFilterSwitches}>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, esvendible: '' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.esvendible === '' ? '#9E9E9E' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.esvendible === '' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.esvendible === '' ? '#9E9E9E' : '#9E9E9E' }
                        ]}>
                          Todos
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, esvendible: 'true' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.esvendible === 'true' ? '#4CAF50' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.esvendible === 'true' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.esvendible === 'true' ? '#4CAF50' : '#9E9E9E' }
                        ]}>
                          Vendible
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, esvendible: 'false' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.esvendible === 'false' ? '#F44336' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.esvendible === 'false' ? responsive.responsiveWidth(40) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.esvendible === 'false' ? '#F44336' : '#9E9E9E' }
                        ]}>
                          No vendible
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
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

        {/* Add Buttons */}
        <View style={styles.addButtonsContainer}>
          {isAdmin && !isOfflineMode && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAdd}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.addButtonTextSmal, { color: '#fff' }]}>Agregar Servicio</Text>
            </TouchableOpacity>
          )}
          {isAdmin && !isOfflineMode && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('ServicioForm', { mode: 'add', isOferta: true })}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.addButtonTextSmall, { color: '#fff' }]}>Agregar Servicio (Oferta)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Servicios List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando servicios...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchServicios}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : servicios.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="pricetag-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron servicios
            </Text>
          </Card>
        ) : (
          <>
            {viewMode === 'card' ? (
              servicios.map((servicio) => {
                return (
                  <TouchableOpacity
                    key={servicio.id_servicio}
                    onPress={() => handleServicioPress(servicio)}
                    activeOpacity={0.7}
                  >
                    <Card style={[styles.servicioCard, { backgroundColor: colors.surface }]}>
                      {servicio.componentes && servicio.componentes.length > 0 && (
                        <View style={[styles.offerFlag, { backgroundColor: '#4CAF50' }]}>
                          <Ionicons name="pricetag-outline" size={responsive.responsiveWidth(14)} color="#fff" />
                        </View>
                      )}
                      {servicio.nota && (
                        <View style={[styles.noteFlag, { backgroundColor: '#2196F3' }]}>
                          <Ionicons name="document-text-outline" size={responsive.responsiveWidth(14)} color="#fff" />
                        </View>
                      )}
                      <View style={styles.servicioInfo}>
                        <View style={styles.servicioHeader}>
                          <Text style={[styles.servicioName, { color: colors.onSurface }]} numberOfLines={1} ellipsizeMode="tail">
                            {servicio.nombre.length > 15 ? servicio.nombre.substring(0, 15) + '...' : servicio.nombre}
                          </Text>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: servicio.esvendible ? '#E8F5E9' : '#FFEBEE' }
                          ]}>
                            <Text style={[styles.statusText, { color: servicio.esvendible ? '#2E7D32' : '#C62828' }]}>
                              {servicio.esvendible ? 'Vendible' : 'No vendible'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.servicioDetails, { color: colors.outline }]}>Categoría: {servicio.categoria}</Text>
                        {filters.id_tienda && (
                          <>
                            <Text style={[styles.servicioDetails, { color: colors.primary }]}>
                              Precio CUP: ${parseFloat(getServicePrice(servicio)).toFixed(2)}
                            </Text>
                            <Text style={[styles.servicioDetails, { color: colors.primary }]}>
                              Precio USD: ${parseFloat(getServicePriceUSD(servicio)).toFixed(2)}
                            </Text>
                          </>
                        )}
                      </View>
                      {canEdit && (
                        <View style={styles.servicioActions}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.editButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleEdit(servicio);
                            }}
                          >
                            <Image
                              source={require('../../assets/editar.png')}
                              style={styles.actionIcon}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.deleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDelete(servicio);
                            }}
                          >
                            <Image
                              source={require('../../assets/basura.png')}
                              style={styles.actionIcon}
                              resizeMode="contain"
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    </Card>
                  </TouchableOpacity>
                );
              })
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollView}>
                <View style={styles.tableContainer}>
                  <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Nombre</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Categoría</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(80) }]}>Estado</Text>
                    {filters.id_tienda && (
                      <>
                        <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Precio CUP</Text>
                        <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Precio USD</Text>
                      </>
                    )}
                    {canEdit && (
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                    )}
                  </View>
                  {servicios.map((servicio, index) => {
                    return (
                      <TouchableOpacity
                        key={servicio.id_servicio}
                        onPress={() => handleServicioPress(servicio)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                          <View style={[styles.tableCellWithFlags, { width: responsive.responsiveWidth(200) }]}>
                            <View style={styles.tableFlagsContainer}>
                              {servicio.componentes && servicio.componentes.length > 0 && (
                                <View style={[styles.tableOfferFlag, { backgroundColor: '#4CAF50' }]}>
                                  <Ionicons name="pricetag-outline" size={responsive.responsiveWidth(12)} color="#fff" />
                                </View>
                              )}
                              {servicio.nota && (
                                <View style={[styles.tableNoteFlag, { backgroundColor: '#2196F3' }]}>
                                  <Ionicons name="document-text-outline" size={responsive.responsiveWidth(12)} color="#fff" />
                                </View>
                              )}
                            </View>
                            <Text style={[styles.tableCellText, { color: colors.onSurface }]} numberOfLines={2}>
                              {servicio.nombre}
                            </Text>
                          </View>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                            {servicio.categoria || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: servicio.esvendible ? '#4CAF50' : '#F44336', width: responsive.responsiveWidth(80) }]}>
                            {servicio.esvendible ? 'Vendible' : 'No vendible'}
                          </Text>
                          {filters.id_tienda && (
                            <>
                              <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100) }]}>
                                ${parseFloat(getServicePrice(servicio)).toFixed(2)}
                              </Text>
                              <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(100) }]}>
                                ${parseFloat(getServicePriceUSD(servicio)).toFixed(2)}
                              </Text>
                            </>
                          )}
                          {canEdit && (
                            <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                              <View style={styles.tableActionsRow}>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleEdit(servicio);
                                  }}
                                >
                                  <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDelete(servicio);
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
                    Total de servicios: {pagination.totalItems}
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

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRoute="Servicios"
      />

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
    </SafeAreaView>
  );
};

export const ServiciosScreen = () => <ServiciosContent />;

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
  expandButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  filterTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  filterGroup: {
    marginBottom: responsive.responsiveMargin(16),
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
  addButtonsContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
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
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
    flexShrink: 1,
  },
  addButtonMultiLineText: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonTextSmall: {
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  errorText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  retryButton: {
    marginTop: responsive.responsiveMargin(16),
    paddingHorizontal: responsive.responsivePadding(24),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  emptyCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(40),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  servicioCard: {
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
  offerFlag: {
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
  servicioInfo: {
    flex: 1,
  },
  servicioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  servicioName: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  statusBadge: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(6),
    borderRadius: 9999,
  },
  statusText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
    color: '#fff',
  },
  servicioDetails: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  servicioActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  actionButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: responsive.responsiveWidth(22),
    height: responsive.responsiveHeight(22),
  },
  editButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: 'transparent',
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
  statusFilterSwitches: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  statusFilterItem: {
    flex: 1,
  },
  statusFilterSwitch: {
    height: responsive.responsiveHeight(36),
    borderRadius: 18,
    padding: 3,
    width: '100%',
  },
  statusFilterKnob: {
    width: responsive.responsiveWidth(55),
    height: responsive.responsiveHeight(30),
    borderRadius: 15,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusFilterText: {
    fontSize: responsive.responsiveFontSize(10),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(16),
    marginTop: responsive.responsiveMargin(16),
  },
  paginationButton: {
    width: responsive.responsiveWidth(40),
    height: responsive.responsiveHeight(40),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationInfo: {
    alignItems: 'center',
  },
  paginationText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  paginationSubtext: {
    fontSize: responsive.fontSizes.bodySmall,
    marginTop: responsive.responsiveMargin(2),
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
  tableOfferFlag: {
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

import React, { useState, useEffect } from 'react';
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
import { getServicios, getServicioByCodigo, deleteServicio } from '../services/servicioService';
import { getTiendas } from '../services/tiendaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { storageService } from '../services/storageService';

const ServiciosContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [servicios, setServicios] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre: '', codigo: '', categoria: '', esvendible: '', id_tienda: '' });
  const [tiendas, setTiendas] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showCategoriaDropdown, setShowCategoriaDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const canEdit = isAdmin;

  useEffect(() => {
    fetchTiendas();
  }, []);

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
      fetchServicios();
    }, [pagination.currentPage, filters])
  );

  const fetchTiendas = async () => {
    try {
      if (isOfflineMode) {
        // En modo offline, no cargar tiendas o usar datos cacheados si existieran
        setTiendas([]);
        return;
      }
      
      const data = await getTiendas({}, 1, 1000);
      const allTiendas = data.data || [];
      
      // Apply store visibility permissions
      const userRole = user?.rol?.toLowerCase();
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.dependiente) ||
        (userRole === 'almacenero' && permissions?.almacenero) ||
        (userRole === 'económico' && permissions?.economico);

      // If user cannot view all stores, filter to show only their own store
      if (!canViewAllStores && user?.id_tienda) {
        const userTienda = allTiendas.find(t => t.id_tienda === user.id_tienda);
        setTiendas(userTienda ? [userTienda] : []);
        // Auto-select the user's store in the filter
        setFilters(prev => ({ ...prev, id_tienda: user.id_tienda.toString() }));
      } else {
        setTiendas(allTiendas);
      }
    } catch (err) {
      console.error('Error fetching tiendas:', err);
      if (!isOfflineMode) {
        setTiendas([]);
      }
    }
  };

  const fetchServicios = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Modo offline: usar datos de AsyncStorage
      if (isOfflineMode) {
        const allServicios = await storageService.getServicios();
        
        if (filters.codigo) {
          // Buscar por código específico
          const filtered = allServicios.filter(s => 
            s.codigo?.toLowerCase() === filters.codigo.toLowerCase()
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
          
          // Apply store visibility permissions
          const userRole = user?.rol?.toLowerCase();
          const canViewAllStores = 
            userRole === 'administrador' ||
            (userRole === 'dependiente' && permissions?.dependiente) ||
            (userRole === 'almacenero' && permissions?.almacenero) ||
            (userRole === 'económico' && permissions?.economico);

          // If user cannot view all stores, check if service belongs to their store
          if (!canViewAllStores && user?.id_tienda) {
            const belongsToStore = servicio.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
            if (!belongsToStore) {
              setServicios([]);
              setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
              setIsLoading(false);
              setIsSearching(false);
              return;
            }
          }
          
          // Devolver como array con una sola posición para mantener la estructura
          setServicios([servicio]);
          setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 1 });
        } catch (error) {
          // Si no se encuentra el servicio, mostrar lista vacía
          setServicios([]);
          setPagination({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
        }
      } else {
        // Check if any filters are active
        const hasActiveFilters = Object.values(filters).some(value => value !== '' && value !== null && value !== undefined);
        
        // If filters are active, fetch all data to ensure accurate pagination
        // Otherwise, use paginated fetch from backend
        const fetchLimit = hasActiveFilters ? 10000 : pagination.limit;
        const fetchPage = hasActiveFilters ? 1 : pagination.currentPage;
        const data = await getServicios(filters, fetchPage, fetchLimit);
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

        // If filters are active, paginate client-side
        if (hasActiveFilters) {
          const totalFilteredItems = servicios.length;
          const totalFilteredPages = Math.ceil(totalFilteredItems / pagination.limit);
          const startIndex = (pagination.currentPage - 1) * pagination.limit;
          const endIndex = startIndex + pagination.limit;
          const paginatedServicios = servicios.slice(startIndex, endIndex);
          
          setServicios(paginatedServicios);
          setPagination({
            currentPage: pagination.currentPage,
            limit: pagination.limit,
            totalPages: totalFilteredPages,
            totalItems: totalFilteredItems
          });
        } else {
          // No filters active, use backend pagination
          setServicios(servicios);
          setPagination(data.pagination || pagination);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching servicios:', err);
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

    // Preserve tienda filter for users without permission
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
    
    const fetchWithClearedFilters = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if any filters are active after clearing
        const hasActiveFilters = Object.values(clearedFilters).some(value => value !== '' && value !== null && value !== undefined);
        
        // If filters are active, fetch all data to ensure accurate pagination
        // Otherwise, use paginated fetch from backend
        const fetchLimit = hasActiveFilters ? 10000 : pagination.limit;
        const data = await getServicios(clearedFilters, 1, fetchLimit);
        let servicios = data.data || [];

        // If user cannot view all stores, filter to show only services from their own store
        if (!canViewAllStores && user?.id_tienda) {
          servicios = servicios.filter(s => {
            // Check if the service belongs to the user's store via tiendas_servicio
            return s.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
          });
        }

        // If filters are active, paginate client-side
        if (hasActiveFilters) {
          const totalFilteredItems = servicios.length;
          const totalFilteredPages = Math.ceil(totalFilteredItems / pagination.limit);
          const startIndex = 0;
          const endIndex = pagination.limit;
          const paginatedServicios = servicios.slice(startIndex, endIndex);
          
          setServicios(paginatedServicios);
          setPagination({
            currentPage: 1,
            limit: pagination.limit,
            totalPages: totalFilteredPages,
            totalItems: totalFilteredItems
          });
        } else {
          // No filters active, use backend pagination
          setServicios(servicios);
          setPagination(data.pagination || pagination);
        }
      } catch (err) {
        setError(err.message);
        console.error('Error fetching servicios:', err);
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    };
    fetchWithClearedFilters();
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
    const mode = canEdit ? 'edit' : 'view';
    navigation.navigate('ServicioForm', { servicio, mode, isOfflineMode });
  };

  const handleEdit = (servicio) => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    navigation.navigate('ServicioForm', { servicio, mode: 'edit' });
  };

  const handleAdd = () => {
    if (isOfflineMode) {
      showToast({ type: 'warning', message: 'No disponible en modo offline' });
      return;
    }
    navigation.navigate('ServicioForm', { mode: 'add' });
  };

  const handleSettingsPress = () => {
    navigation.navigate('Settings');
  };

  const handleNotificationsPress = () => {
    console.log('Notificaciones');
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
    if (!permission) {
      const result = await requestPermission();
      if (!result.granted) {
        showToast({ type: 'error', message: 'Se requiere permiso de cámara para escanear códigos' });
        return;
      }
    } else if (!permission.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        showToast({ type: 'error', message: 'Se requiere permiso de cámara para escanear códigos' });
        return;
      }
    }
    
    setShowScannerModal(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    setFilters(prev => ({ ...prev, codigo: data }));
    setShowScannerModal(false);
    showToast({ type: 'success', message: 'Código escaneado correctamente' });
  };

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

  // Get unique categories from servicios
  const categorias = [...new Set(servicios.map(s => s.categoria))];

  // Check if user can view all stores
  const userRole = user?.rol?.toLowerCase();
  const canViewAllStores = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && permissions?.dependiente) ||
    (userRole === 'almacenero' && permissions?.almacenero) ||
    (userRole === 'económico' && permissions?.economico);

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
        onSettingsPress={handleSettingsPress}
        onNotificationsPress={handleNotificationsPress}
        onProfilePress={handleProfilePress}
        isDark={isDarkMode}
        title="Abacus"
        showLogo={true}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
                      fetchServicios();
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
                        setFilters(prev => ({ ...prev, id_tienda: tienda.id_tienda.toString() }));
                        setShowTiendaDropdown(false);
                        setTiendaSearchText('');
                        setPagination(prev => ({ ...prev, currentPage: 1 }));
                        fetchServicios();
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
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowCategoriaDropdown(!showCategoriaDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: filters.categoria ? colors.onSurface : colors.outline }]}>
                    {filters.categoria || 'Todas las categorías'}
                  </Text>
                  <Ionicons 
                    name={showCategoriaDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showCategoriaDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters(prev => ({ ...prev, categoria: '' }));
                        setShowCategoriaDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las categorías</Text>
                    </TouchableOpacity>
                    {categorias.map((categoria, index) => (
                      <TouchableOpacity
                        key={categoria}
                        style={[styles.dropdownItem, index === categorias.length - 1 && styles.dropdownItemLast]}
                        onPress={() => {
                          setFilters(prev => ({ ...prev, categoria }));
                          setShowCategoriaDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{categoria}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
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
            {servicios.map((servicio) => {
              // Find the tienda_servicio for the filtered tienda
              const tiendaServicio = filters.id_tienda 
                ? servicio.tiendas_servicio?.find(ts => ts.id_tienda === parseInt(filters.id_tienda))
                : null;
              
              // En modo offline y no admin, mostrar precios del primer servicio_tienda disponible
              const showOfflinePrices = isOfflineMode && !isAdmin;
              const offlineTiendaServicio = showOfflinePrices && servicio.tiendas_servicio?.length > 0
                ? servicio.tiendas_servicio[0]
                : null;

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
                      {showOfflinePrices && offlineTiendaServicio ? (
                        <>
                          <Text style={[styles.servicioDetails, { color: colors.outline }]}>
                            Precio CUP: ${parseFloat(offlineTiendaServicio.precio_cup).toFixed(2)}
                          </Text>
                          <Text style={[styles.servicioDetails, { color: colors.outline }]}>
                            Precio USD: ${parseFloat(offlineTiendaServicio.precio_usd).toFixed(2)}
                          </Text>
                        </>
                      ) : tiendaServicio && (
                        <>
                          <Text style={[styles.servicioDetails, { color: colors.outline }]}>
                            Precio CUP: ${parseFloat(tiendaServicio.precio_cup).toFixed(2)}
                          </Text>
                          <Text style={[styles.servicioDetails, { color: colors.outline }]}>
                            Precio USD: ${parseFloat(tiendaServicio.precio_usd).toFixed(2)}
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
            })}

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

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform } from 'react-native';
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
import { useViewMode } from '../context/ViewModeContext';
import { getUsuarios, deleteUsuario } from '../services/usuarioService';
import { getTiendas } from '../services/tiendaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const UsuariosContent = () => {
  const navigation = useNavigation();
  const { colors, isDark, toggleTheme } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { viewMode, toggleViewMode, isChangingView } = useViewMode();
  const { toast, showToast, hideToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre_natural: '', nombre_usuario: '', rol: '', activo: '', id_tienda: '' });
  const [tiendas, setTiendas] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showRolDropdown, setShowRolDropdown] = useState(false);
  const [tiendaSearchText, setTiendaSearchText] = useState('');

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isFirstFocus = useRef(true);

  useEffect(() => {
    fetchTiendas();
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      fetchUsuarios();
    }, [])
  );

  const fetchTiendas = async () => {
    try {
      const data = await getTiendas({}, 1, 1000);
      setTiendas(data.data || []);
    } catch (err) {
      // Error fetching tiendas
    }
  };

  const fetchUsuarios = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getUsuarios(filters, pagination.currentPage, pagination.limit);

      // Filter out current user from the list
      let filteredUsuarios = (data.data || []).filter(u => u.id_usuario !== user?.id_usuario);

      // Apply store visibility permissions
      const userRole = user?.rol?.toLowerCase();
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.dependiente) ||
        (userRole === 'almacenero' && permissions?.almacenero) ||
        (userRole === 'económico' && permissions?.economico);

      // If user cannot view all stores, filter to show only users from their own store
      if (!canViewAllStores && user?.id_tienda) {
        filteredUsuarios = filteredUsuarios.filter(u => u.id_tienda === user.id_tienda);
      }

      setUsuarios(filteredUsuarios);
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
    fetchUsuarios();
  };

  const handleClearFilters = () => {
    const clearedFilters = { nombre_natural: '', nombre_usuario: '', rol: '', activo: '', id_tienda: '' };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    // Pass cleared filters directly to fetchUsuarios
    const fetchWithClearedFilters = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getUsuarios(clearedFilters, 1, pagination.limit);
        
        // Filter out current user from the list
        let filteredUsuarios = (data.data || []).filter(u => u.id_usuario !== user?.id_usuario);

        // Apply store visibility permissions
        const userRole = user?.rol?.toLowerCase();
        const canViewAllStores = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && permissions?.dependiente) ||
          (userRole === 'almacenero' && permissions?.almacenero) ||
          (userRole === 'económico' && permissions?.economico);

        // If user cannot view all stores, filter to show only users from their own store
        if (!canViewAllStores && user?.id_tienda) {
          filteredUsuarios = filteredUsuarios.filter(u => u.id_tienda === user.id_tienda);
        }

        setUsuarios(filteredUsuarios);
        setPagination(data.pagination || pagination);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    };
    fetchWithClearedFilters();
  };

  const handleDelete = (usuario) => {
    Alert.alert(
      'Eliminar Usuario',
      `¿Estás seguro de que quieres eliminar al usuario "${usuario.nombre_natural}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUsuario(usuario.id_usuario);
              showToast({ type: 'success', message: 'Usuario eliminado correctamente' });
              fetchUsuarios();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const isAdmin = user?.rol === 'Administrador';

  const handleUsuarioPress = (usuario) => {
    const mode = isAdmin ? 'edit' : 'view';
    navigation.navigate('UsuarioForm', { usuario, mode });
  };

  const handleEdit = (usuario) => {
    navigation.navigate('UsuarioForm', { usuario, mode: 'edit' });
  };

  const handleAdd = () => {
    navigation.navigate('UsuarioForm', { mode: 'add' });
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

  const filteredTiendas = tiendas.filter(tienda =>
    tienda.nombre.toLowerCase().includes(tiendaSearchText.toLowerCase())
  );

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
        keyboardVerticalOffset={responsive.headerHeight}
        enabled={true}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Page Title */}
        <View style={styles.pageTitleContainer}>
          <Text style={[styles.pageTitle, { color: colors.onSurface }]}>Gestión de Usuarios</Text>
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
              value={filters.nombre_natural}
              onChangeText={(text) => setFilters(prev => ({ ...prev, nombre_natural: text }))}
            />
          </View>

          {showAdvancedFilters && (
            <>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Usuario</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Nombre de usuario..."
                  value={filters.nombre_usuario}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, nombre_usuario: text }))}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Rol</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowRolDropdown(!showRolDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: filters.rol ? colors.onSurface : colors.outline }]}>
                    {filters.rol || 'Todos los roles'}
                  </Text>
                  <Ionicons 
                    name={showRolDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showRolDropdown && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters(prev => ({ ...prev, rol: '' }));
                        setShowRolDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todos los roles</Text>
                    </TouchableOpacity>
                    {["Administrador", "Dependiente", "Almacenero", "Económico"].map((role, index) => (
                      <TouchableOpacity
                        key={role}
                        style={[styles.dropdownItem, index === 3 && styles.dropdownItemLast]}
                        onPress={() => {
                          setFilters(prev => ({ ...prev, rol: role }));
                          setShowRolDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{role}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tienda</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowTiendaDropdown(!showTiendaDropdown)}
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
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters(prev => ({ ...prev, id_tienda: '' }));
                        setShowTiendaDropdown(false);
                        setTiendaSearchText('');
                      }}
                    >
                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Todas las tiendas</Text>
                    </TouchableOpacity>
                    {filteredTiendas.length > 0 ? (
                      filteredTiendas.map((tienda, index) => (
                        <TouchableOpacity
                          key={tienda.id_tienda}
                          style={[styles.dropdownItem, index === filteredTiendas.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFilters(prev => ({ ...prev, id_tienda: tienda.id_tienda.toString() }));
                            setShowTiendaDropdown(false);
                            setTiendaSearchText('');
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

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
                <View style={styles.statusFilterSwitches}>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, activo: '' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.activo === '' ? '#9E9E9E' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.activo === '' ? responsive.responsiveWidth(26) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.activo === '' ? '#9E9E9E' : '#9E9E9E' }
                        ]}>
                          Todos
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, activo: 'true' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.activo === 'true' ? '#4CAF50' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.activo === 'true' ? responsive.responsiveWidth(26) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.activo === 'true' ? '#4CAF50' : '#9E9E9E' }
                        ]}>
                          Activo
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.statusFilterItem}
                    onPress={() => setFilters(prev => ({ ...prev, activo: 'false' }))}
                  >
                    <View style={[
                      styles.statusFilterSwitch,
                      { backgroundColor: filters.activo === 'false' ? '#F44336' : '#E0E0E0' }
                    ]}>
                      <View style={[
                        styles.statusFilterKnob,
                        { transform: [{ translateX: filters.activo === 'false' ? responsive.responsiveWidth(26) : 0 }] }
                      ]}>
                        <Text style={[
                          styles.statusFilterText,
                          { color: filters.activo === 'false' ? '#F44336' : '#9E9E9E' }
                        ]}>
                          Inactivo
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

        {/* Add Button - Only for Admin */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={handleAdd}
          >
            <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
            <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Usuario</Text>
          </TouchableOpacity>
        )}

        {/* Usuarios List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando usuarios...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchUsuarios}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : usuarios.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="people-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron usuarios
            </Text>
          </Card>
        ) : (
          <>
            {viewMode === 'card' ? (
              usuarios.map((usuario) => (
                <TouchableOpacity
                  key={usuario.id_usuario}
                  onPress={() => handleUsuarioPress(usuario)}
                  activeOpacity={0.7}
                >
                  <Card style={[styles.usuarioCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.usuarioInfo}>
                      <View style={styles.usuarioHeader}>
                        <Text style={[styles.usuarioName, { color: colors.onSurface }]} numberOfLines={1} ellipsizeMode="tail">
                          {usuario.nombre_natural.length > 15 ? usuario.nombre_natural.substring(0, 15) + '...' : usuario.nombre_natural}
                        </Text>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: usuario.activo ? '#E8F5E9' : '#FFEBEE' }
                        ]}>
                          <Text style={[styles.statusText, { color: usuario.activo ? '#2E7D32' : '#C62828' }]}>
                            {usuario.activo ? 'Activo' : 'Inactivo'}
                          </Text>
                        </View>
                      </View>
                      {usuario.tienda && (
                        <Text style={[styles.usuarioDetails, { color: colors.outline }]}>Tienda: {usuario.tienda.nombre}</Text>
                      )}
                      {usuario.rol && (
                        <Text style={[styles.usuarioDetails, { color: colors.outline }]}>Rol: {usuario.rol}</Text>
                      )}
                    </View>
                    {isAdmin && (
                      <View style={styles.usuarioActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.editButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEdit(usuario);
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
                            handleDelete(usuario);
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
              ))
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollView}>
                <View style={styles.tableContainer}>
                  <View style={[styles.tableHeader, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(200) }]}>Nombre</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(150) }]}>Tienda</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(120) }]}>Rol</Text>
                    <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Estado</Text>
                    {isAdmin && (
                      <Text style={[styles.tableHeaderText, { color: '#fff', width: responsive.responsiveWidth(100) }]}>Acciones</Text>
                    )}
                  </View>
                  {usuarios.map((usuario, index) => {
                    return (
                      <TouchableOpacity
                        key={usuario.id_usuario}
                        onPress={() => handleUsuarioPress(usuario)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surface : colors.surfaceVariant }]}>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(200) }]} numberOfLines={2}>
                            {usuario.nombre_natural}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(150) }]}>
                            {usuario.tienda?.nombre || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: colors.onSurface, width: responsive.responsiveWidth(120) }]}>
                            {usuario.rol || 'N/A'}
                          </Text>
                          <Text style={[styles.tableCellText, { color: usuario.activo ? '#4CAF50' : '#F44336', width: responsive.responsiveWidth(100) }]}>
                            {usuario.activo ? 'Activo' : 'Inactivo'}
                          </Text>
                          {isAdmin && (
                            <View style={[styles.tableActionsCell, { width: responsive.responsiveWidth(100) }]}>
                              <View style={styles.tableActionsRow}>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleEdit(usuario);
                                  }}
                                >
                                  <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.tableActionButton, styles.tableDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDelete(usuario);
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
                <Text style={[styles.paginationText, { color: colors.onSurface }]}>
                  Página {pagination.currentPage} de {pagination.totalPages}
                </Text>
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
        currentRoute="Usuarios"
      />
    </SafeAreaView>
  );
};

export const UsuariosScreen = () => <UsuariosContent />;

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
  statusButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  statusButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(10),
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(14),
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
  usuarioCard: {
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
  usuarioInfo: {
    flex: 1,
  },
  usuarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  usuarioName: {
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
  usuarioDetails: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  usuarioActions: {
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
  statusFilterSwitches: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(24),
  },
  statusFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  statusFilterSwitch: {
    width: responsive.responsiveWidth(80),
    height: responsive.responsiveHeight(28),
    borderRadius: 14,
    padding: 2,
  },
  statusFilterKnob: {
    width: responsive.responsiveWidth(50),
    height: responsive.responsiveHeight(24),
    borderRadius: 12,
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
    fontSize: responsive.fontSizes.caption,
    fontWeight: '600',
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
    padding: responsive.responsivePadding(10),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    minHeight: responsive.responsiveHeight(0),
    justifyContent: 'center',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
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
  tiendaDropdown: {
    marginTop: responsive.responsiveMargin(8),
    maxHeight: responsive.responsiveHeight(40),
  },
  tableScrollView: {
    marginBottom: responsive.responsiveMargin(16),
  },
  tableContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
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
    // Style handled inline
  },
  tableDeleteButton: {
    // Style handled inline
  },
  tiendaChip: {
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(8),
    borderRadius: 20,
    borderWidth: 1,
    marginRight: responsive.responsiveMargin(8),
  },
  tiendaChipText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '500',
    fontFamily: 'Inter',
  },
});

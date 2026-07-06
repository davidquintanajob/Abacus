import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { getTiendas, deleteTienda } from '../services/tiendaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const TiendasContent = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [tiendas, setTiendas] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, limit: 10, totalPages: 1, totalItems: 0 });
  const [error, setError] = useState(null);

  // Filter states
  const [filters, setFilters] = useState({ nombre: '', tipo: '', activo: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  useFocusEffect(
    React.useCallback(() => {
      fetchTiendas();
    }, [pagination.currentPage])
  );

  const fetchTiendas = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getTiendas(filters, pagination.currentPage, pagination.limit);

      setTiendas(data.data || []);
      setPagination(data.pagination || pagination);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching tiendas:', err);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    fetchTiendas();
  };

  const handleClearFilters = () => {
    const clearedFilters = { nombre: '', tipo: '', activo: '' };
    setFilters(clearedFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setIsSearching(true);
    
    // Pass cleared filters directly to fetchTiendas
    const fetchWithClearedFilters = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getTiendas(clearedFilters, 1, pagination.limit);
        setTiendas(data.data || []);
        setPagination(data.pagination || pagination);
      } catch (err) {
        setError(err.message);
        console.error('Error fetching tiendas:', err);
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    };
    fetchWithClearedFilters();
  };

  const handleDelete = (tienda) => {
    Alert.alert(
      'Eliminar Tienda',
      `¿Estás seguro de que quieres eliminar la tienda "${tienda.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTienda(tienda.id_tienda);
              showToast({ type: 'success', message: 'Tienda eliminada correctamente' });
              fetchTiendas();
            } catch (err) {
              showToast({ type: 'error', message: err.message, code: err.code });
            }
          },
        },
      ]
    );
  };

  const handleEdit = (tienda) => {
    navigation.navigate('TiendaForm', { tienda, mode: 'edit' });
  };

  const handleAdd = () => {
    navigation.navigate('TiendaForm', { mode: 'add' });
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
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
        isDark={isDarkMode}
        title="Gestión de Tiendas"
      />

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Section */}
        <Card style={[styles.filterCard, { backgroundColor: colors.surface }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Filtros</Text>
            <TouchableOpacity onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Ionicons 
                name={showAdvancedFilters ? "chevron-up" : "chevron-down"} 
                size={responsive.responsiveWidth(20)} 
                color={colors.primary} 
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

          {showAdvancedFilters && (
            <>
              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tipo</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Tipo de tienda..."
                  value={filters.tipo}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, tipo: text }))}
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
                <View style={styles.statusButtons}>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      { backgroundColor: filters.activo === 'true' ? colors.primary : colors.background, borderColor: colors.outlineVariant }
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, activo: prev.activo === 'true' ? '' : 'true' }))}
                  >
                    <Text style={[styles.statusButtonText, { color: filters.activo === 'true' ? '#fff' : colors.onSurface }]}>
                      Activa
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.statusButton,
                      { backgroundColor: filters.activo === 'false' ? colors.error : colors.background, borderColor: colors.outlineVariant }
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, activo: prev.activo === 'false' ? '' : 'false' }))}
                  >
                    <Text style={[styles.statusButtonText, { color: filters.activo === 'false' ? '#fff' : colors.onSurface }]}>
                      Inactiva
                    </Text>
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

        {/* Add Button */}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={handleAdd}
        >
          <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
          <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Tienda</Text>
        </TouchableOpacity>

        {/* Tiendas List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.outline }]}>
              Cargando tiendas...
            </Text>
          </View>
        ) : error ? (
          <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={fetchTiendas}
            >
              <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
            </TouchableOpacity>
          </Card>
        ) : tiendas.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="storefront-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
            <Text style={[styles.emptyText, { color: colors.outline }]}>
              No se encontraron tiendas
            </Text>
          </Card>
        ) : (
          <>
            {tiendas.map((tienda) => (
              <Card key={tienda.id_tienda} style={[styles.tiendaCard, { backgroundColor: colors.surface }]}>
                <View style={styles.tiendaInfo}>
                  <View style={styles.tiendaHeader}>
                    <Text style={[styles.tiendaName, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: tienda.activo ? (isDarkMode ? colors.primaryContainer : '#E3F2FD') : (isDarkMode ? colors.errorContainer : '#FFEBEE') }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: tienda.activo ? (isDarkMode ? colors.primary : '#1976D2') : (isDarkMode ? colors.error : '#D32F2F') }
                      ]}>
                        {tienda.activo ? 'Activa' : 'Inactiva'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.tiendaType, { color: colors.outline }]}>Tipo: {tienda.tipo}</Text>
                </View>
                <View style={styles.tiendaActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                    onPress={() => handleEdit(tienda)}
                  >
                    <Image
                      source={require('../../assets/editar.png')}
                      style={styles.actionIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                    onPress={() => handleDelete(tienda)}
                  >
                    <Image
                      source={require('../../assets/basura.png')}
                      style={styles.actionIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}

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
    </SafeAreaView>
  );
};

export const TiendasScreen = () => <TiendasContent />;

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
  filterCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginTop: responsive.responsiveMargin(50),
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
  tiendaCard: {
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
  tiendaInfo: {
    flex: 1,
  },
  tiendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  tiendaName: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  statusBadge: {
    paddingHorizontal: responsive.responsivePadding(8),
    paddingVertical: responsive.responsivePadding(4),
    borderRadius: 9999,
  },
  statusText: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  tiendaType: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  tiendaActions: {
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

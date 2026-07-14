import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { getServicios, getServicioById, updateServicio } from '../services/servicioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const OfertasContent = () => {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [serviciosConOferta, setServiciosConOferta] = useState([]);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [servicioToDelete, setServicioToDelete] = useState(null);
  const [filterNombre, setFilterNombre] = useState('');
  const [expandedCards, setExpandedCards] = useState({});
  const [filterApplied, setFilterApplied] = useState(false);
  const [displayServicios, setDisplayServicios] = useState([]);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const canEdit = isAdmin;

  useFocusEffect(
    React.useCallback(() => {
      fetchServiciosConOferta();
    }, [])
  );

  const fetchServiciosConOferta = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all servicios (sin componentes inicialmente)
      const data = await getServicios({}, 1, 1000);
      const allServicios = data.data || [];

      console.log('Total servicios:', allServicios.length);

      // Apply store visibility permissions before processing
      const userRole = user?.rol?.toLowerCase();
      const canViewAllStores = 
        userRole === 'administrador' ||
        (userRole === 'dependiente' && permissions?.dependiente) ||
        (userRole === 'almacenero' && permissions?.almacenero) ||
        (userRole === 'económico' && permissions?.economico);

      // If user cannot view all stores, filter to show only services from their own store
      let filteredServicios = allServicios;
      if (!canViewAllStores && user?.id_tienda) {
        filteredServicios = allServicios.filter(s => {
          // Check if the service belongs to the user's store via tiendas_servicio
          return s.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
        });
      }

      // Obtener detalles completos de cada servicio para verificar componentes
      const serviciosConComponentes = [];
      
      for (const servicio of filteredServicios) {
        try {
          const servicioCompleto = await getServicioById(servicio.id_servicio);
          console.log('Servicio:', servicioCompleto.nombre);
          console.log('  - Componentes:', servicioCompleto.componentes?.length || 0);
          console.log('  - Ofertas que incluyen:', servicioCompleto.ofertas_que_incluyen?.length || 0);
          
          // Buscar servicios que tengan componentes (ofertas que crean)
          if (servicioCompleto.componentes && servicioCompleto.componentes.length > 0) {
            serviciosConComponentes.push(servicioCompleto);
          }
          // También buscar servicios que estén en ofertas_que_incluyen (son componentes de otras ofertas)
          else if (servicioCompleto.ofertas_que_incluyen && servicioCompleto.ofertas_que_incluyen.length > 0) {
            // Para estos, necesitamos obtener el servicio padre
            for (const oferta of servicioCompleto.ofertas_que_incluyen) {
              try {
                const servicioPadre = await getServicioById(oferta.id_servicio);
                // Verificar si ya está en la lista
                if (!serviciosConComponentes.find(s => s.id_servicio === servicioPadre.id_servicio)) {
                  serviciosConComponentes.push(servicioPadre);
                }
              } catch (err) {
                console.error('Error al obtener servicio padre:', err);
              }
            }
          }
        } catch (err) {
          console.error('Error al obtener detalles del servicio:', servicio.id_servicio, err);
        }
      }

      console.log('Servicios con componentes encontrados:', serviciosConComponentes.length);
      setServiciosConOferta(serviciosConComponentes);
      setDisplayServicios(serviciosConComponentes);
      // Reset expanded state
      setExpandedCards({});
    } catch (err) {
      setError(err.message);
      console.error('Error fetching servicios con oferta:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOferta = (servicio) => {
    navigation.navigate('OfertaForm', { 
      mode: 'edit',
      oferta: {
        id_oferta: servicio.id_servicio,
        id_servicio: servicio.id_servicio,
        servicio_nombre: servicio.nombre,
        componentes: servicio.componentes
      }
    });
  };

  const handleDeleteOferta = async () => {
    if (!servicioToDelete) return;

    try {
      // Remove the oferta by setting ofertaList to empty
      await updateServicio(servicioToDelete.id_servicio, { ofertaList: [] });
      showToast({ type: 'success', message: 'Oferta eliminada correctamente' });
      setShowDeleteModal(false);
      setServicioToDelete(null);
      fetchServiciosConOferta();
    } catch (err) {
      showToast({ type: 'error', message: err.message, code: err.code });
    }
  };

  const handleAddOferta = () => {
    navigation.navigate('OfertaForm', { mode: 'add' });
  };

  const toggleCardExpansion = (id) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleFilter = () => {
    setFilterApplied(true);
    const filtered = serviciosConOferta.filter(servicio =>
      servicio.nombre.toLowerCase().includes(filterNombre.toLowerCase())
    );
    setDisplayServicios(filtered);
  };

  const handleClearFilter = () => {
    setFilterNombre('');
    setFilterApplied(false);
    setDisplayServicios(serviciosConOferta);
  };

  const styles = createStyles(responsive);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
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
        title="Gestión de Ofertas"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
        keyboardVerticalOffset={responsive.headerHeight + 20}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Filter Card */}
          <Card style={[styles.filterCard, { backgroundColor: colors.surface }]}>
            <View style={styles.filterHeader}>
              <Text style={[styles.filterTitle, { color: colors.onSurface }]}>Filtros</Text>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Nombre</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                placeholderTextColor={colors.outline}
                placeholder="Buscar por nombre..."
                value={filterNombre}
                onChangeText={setFilterNombre}
              />
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity
                style={[styles.filterButton, styles.clearButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={handleClearFilter}
              >
                <Ionicons name="refresh-outline" size={responsive.responsiveWidth(18)} color={colors.onSurface} />
                <Text style={[styles.filterButtonText, { color: colors.onSurface }]}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, styles.searchButton, { backgroundColor: colors.primary }]}
                onPress={handleFilter}
              >
                <Ionicons name="search-outline" size={responsive.responsiveWidth(18)} color="#fff" />
                <Text style={[styles.filterButtonText, { color: '#fff' }]}>Buscar</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Add Offer Button */}
          {canEdit && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={handleAddOferta}
            >
              <Ionicons name="add-circle-outline" size={responsive.responsiveWidth(20)} color="#fff" />
              <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Oferta</Text>
            </TouchableOpacity>
          )}

          {/* List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando ofertas...
              </Text>
            </View>
          ) : error ? (
            <Card style={[styles.errorCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="alert-circle-outline" size={responsive.responsiveWidth(40)} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.onSurface }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={fetchServiciosConOferta}
              >
                <Text style={[styles.retryButtonText, { color: '#fff' }]}>Reintentar</Text>
              </TouchableOpacity>
            </Card>
          ) : serviciosConOferta.length === 0 ? (
            <Card style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
              <Ionicons name="pricetag-outline" size={responsive.responsiveWidth(60)} color={colors.outline} />
              <Text style={[styles.emptyText, { color: colors.outline }]}>
                No se encontraron ofertas
              </Text>
            </Card>
          ) : (
            displayServicios.map((servicio) => (
              <TouchableOpacity
                key={servicio.id_servicio}
                onPress={() => handleEditOferta(servicio)}
                activeOpacity={0.7}
              >
                <Card style={[styles.ofertaCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.ofertaInfo}>
                    <View style={styles.ofertaHeader}>
                      <Text style={[styles.ofertaNombre, { color: colors.onSurface }]} numberOfLines={1} ellipsizeMode="tail">
                        {servicio.nombre.length > 15 ? servicio.nombre.substring(0, 15) + '...' : servicio.nombre}
                      </Text>
                      <TouchableOpacity
                        style={[styles.expandCardButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleCardExpansion(servicio.id_servicio);
                        }}
                      >
                        <Ionicons 
                          name={expandedCards[servicio.id_servicio] ? "chevron-up" : "chevron-down"} 
                          size={responsive.responsiveWidth(20)} 
                          color={isDarkMode ? colors.primary : '#1976D2'} 
                        />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.ofertaCategoria, { color: colors.outline }]}>Categoría: {servicio.categoria}</Text>
                    <Text style={[styles.ofertaCategoria, { color: colors.outline }]}>
                      Componentes: {servicio.componentes?.length || 0}
                    </Text>
                  </View>
                  {canEdit && (
                    <View style={styles.ofertaActions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.editButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleEditOferta(servicio);
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
                          setServicioToDelete(servicio);
                          setShowDeleteModal(true);
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
                
                {expandedCards[servicio.id_servicio] && (
                  <Card style={[styles.componentesCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.componentesList}>
                      <Text style={[styles.componentesLabel, { color: colors.onSurface }]}>
                        Componentes ({servicio.componentes?.length || 0}):
                      </Text>
                      {servicio.componentes?.map((componente, index) => (
                        <View key={index} style={[styles.componenteItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                          <Text style={[styles.componenteNombre, { color: colors.onSurface }]}>
                            {componente.nombre}
                          </Text>
                          <Text style={[styles.componenteCantidad, { color: colors.outline }]}>
                            Cantidad: {componente.oferta?.cantidad || componente.cantidad || 1}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDeleteModal(false)}
          >
            <Card style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Ionicons 
                name="warning-outline" 
                size={responsive.responsiveWidth(48)} 
                color={colors.error} 
                style={styles.modalIcon}
              />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Eliminar Oferta
              </Text>
              <Text style={[styles.modalMessage, { color: colors.outline }]}>
                ¿Estás seguro de que deseas eliminar la oferta de "{servicioToDelete?.nombre}"? Esta acción no se puede deshacer.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => {
                    setShowDeleteModal(false);
                    setServicioToDelete(null);
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalDeleteButton, { backgroundColor: colors.error }]}
                  onPress={handleDeleteOferta}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export const OfertasScreen = () => <OfertasContent />;

const createStyles = (responsive) => StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
    paddingTop: responsive.responsivePadding(80),
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
  ofertaCard: {
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
  ofertaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  ofertaInfo: {
    flex: 1,
  },
  ofertaNombre: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginRight: responsive.responsiveMargin(8),
  },
  ofertaCategoria: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  expandCardButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  ofertaActions: {
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
  componentesCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  componentesList: {
    marginTop: responsive.responsiveMargin(8),
  },
  componentesLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  componenteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(10),
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(6),
  },
  componenteNombre: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    flex: 1,
  },
  componenteCantidad: {
    fontSize: responsive.fontSizes.bodySmall,
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
    width: '100%',
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  modalIcon: {
    alignSelf: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    textAlign: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  modalMessage: {
    fontSize: responsive.fontSizes.body,
    textAlign: 'center',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(24),
    lineHeight: responsive.fontSizes.body * 1.5,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    borderWidth: 1.5,
  },
  modalDeleteButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { updateServicio } from '../services/servicioService';
import { getServicios } from '../services/servicioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const OfertaFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user } = useAuth();
  const { toast, showToast, hideToast } = useToast();

  const { oferta, mode } = route.params || { mode: 'add' };

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [allServicios, setAllServicios] = useState([]);
  const [showServicioSelectorModal, setShowServicioSelectorModal] = useState(false);
  const [showComponenteSelectorModal, setShowComponenteSelectorModal] = useState(false);
  const [servicioSearchText, setServicioSearchText] = useState('');
  const [componenteSearchText, setComponenteSearchText] = useState('');
  const [isOfertaExpanded, setIsOfertaExpanded] = useState(false);
  
  const [formData, setFormData] = useState({
    id_servicio: oferta?.id_servicio || null,
    servicioNombre: oferta?.servicio_nombre || '',
    ofertaList: oferta?.componentes?.map(c => ({
      id_servicio_componente: c.id_servicio,
      cantidad: c.oferta?.cantidad || 1.0,
      nombre: c.nombre,
      categoria: c.categoria
    })) || [],
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  const isAdmin = user?.rol === 'Administrador';
  const canEdit = isAdmin;

  useEffect(() => {
    fetchAllServicios();
  }, []);

  useEffect(() => {
    if (isEditMode && oferta) {
      setFormData({
        id_servicio: oferta.id_servicio,
        servicioNombre: oferta.servicio_nombre,
        ofertaList: oferta.componentes?.map(c => ({
          id_servicio_componente: c.id_servicio,
          cantidad: c.oferta?.cantidad || c.cantidad || 1.0,
          nombre: c.nombre,
          categoria: c.categoria
        })) || [],
      });
    }
  }, [oferta, isEditMode]);

  const fetchAllServicios = async () => {
    try {
      // Obtener todos los servicios (vendibles y no vendibles)
      const dataVendibles = await getServicios({ esvendible: 'true' }, 1, 1000);
      const dataNoVendibles = await getServicios({ esvendible: 'false' }, 1, 1000);
      const allServicios = [...(dataVendibles.data || []), ...(dataNoVendibles.data || [])];
      setAllServicios(allServicios);
    } catch (err) {
      console.error('Error fetching servicios:', err);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!formData.id_servicio) {
      showToast({ type: 'warning', message: 'Debe seleccionar un servicio para la oferta' });
      return;
    }
    if (!formData.ofertaList || formData.ofertaList.length === 0) {
      showToast({ type: 'warning', message: 'Debe agregar al menos un servicio componente' });
      return;
    }

    try {
      setIsSaving(true);

      const dataToSend = {
        ofertaList: formData.ofertaList.map(item => ({
          id_servicio_componente: item.id_servicio_componente,
          cantidad: item.cantidad || 1.0,
        })),
      };

      // Update the servicio with the oferta list
      await updateServicio(formData.id_servicio, dataToSend);
      showToast({ type: 'success', message: 'Oferta creada correctamente' });
      
      navigation.goBack();
    } catch (err) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredServicios = allServicios.filter(s =>
    s.nombre.toLowerCase().includes(servicioSearchText.toLowerCase())
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const filteredComponentes = allServicios.filter(s =>
    s.nombre.toLowerCase().includes(componenteSearchText.toLowerCase()) &&
    s.id_servicio !== formData.id_servicio // Excluir el servicio seleccionado como oferta
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const handleSelectServicio = (servicioSeleccionado) => {
    setFormData(prev => ({
      ...prev,
      id_servicio: servicioSeleccionado.id_servicio,
      servicioNombre: servicioSeleccionado.nombre,
    }));
    setShowServicioSelectorModal(false);
    setServicioSearchText('');
  };

  const handleAddServicioComponente = (servicioSeleccionado) => {
    const existe = formData.ofertaList.find(
      item => item.id_servicio_componente === servicioSeleccionado.id_servicio
    );
    if (existe) {
      showToast({ type: 'warning', message: 'Este servicio ya está agregado como componente' });
      return;
    }
    setFormData(prev => ({
      ...prev,
      ofertaList: [
        ...prev.ofertaList,
        {
          id_servicio_componente: servicioSeleccionado.id_servicio,
          cantidad: 1.0,
          nombre: servicioSeleccionado.nombre,
          categoria: servicioSeleccionado.categoria
        }
      ]
    }));
    setShowComponenteSelectorModal(false);
    setComponenteSearchText('');
    // Expandir automáticamente después de agregar un servicio
    setIsOfertaExpanded(true);
  };

  const handleRemoveServicioComponente = (index) => {
    setFormData(prev => ({
      ...prev,
      ofertaList: prev.ofertaList.filter((_, i) => i !== index)
    }));
  };

  const handleCantidadChange = (index, value) => {
    const cantidad = parseFloat(value) || 0;
    if (cantidad < 0) {
      showToast({ type: 'warning', message: 'La cantidad no puede ser negativa' });
      return;
    }
    setFormData(prev => {
      const updatedList = prev.ofertaList.map((item, i) => {
        if (i === index) {
          return { ...item, cantidad };
        }
        return item;
      });
      return { ...prev, ofertaList: updatedList };
    });
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
        title={isViewMode ? 'Información de la Oferta' : isEditMode ? 'Editar Oferta' : 'Agregar Oferta'}
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
          keyboardShouldPersistTaps="handled"
        >
        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          {/* Servicio Selection */}
          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.outline }]}>Servicio *</Text>
            {canEdit ? (
              <TouchableOpacity
                style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                onPress={() => setShowServicioSelectorModal(true)}
              >
                <Text style={[formData.id_servicio ? styles.inputText : styles.placeholder, { color: formData.id_servicio ? colors.onSurface : colors.outline }]}>
                  {formData.servicioNombre || 'Seleccionar servicio'}
                </Text>
                <Ionicons 
                  name="chevron-down" 
                  size={responsive.responsiveWidth(20)} 
                  color={colors.outline} 
                />
              </TouchableOpacity>
            ) : (
              <View style={[styles.input, styles.inputDisabled, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}>
                <Text style={[formData.id_servicio ? styles.inputText : styles.placeholder, { color: formData.id_servicio ? colors.onSurface : colors.outline }]}>
                  {formData.servicioNombre || 'Seleccionar servicio'}
                </Text>
              </View>
            )}
          </View>

          {/* Servicios Componentes (Oferta) Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Servicios (Oferta)</Text>
              <View style={styles.sectionActions}>
                {canEdit && (
                  <TouchableOpacity
                    style={[styles.addButtonSmall, { backgroundColor: colors.primary }]}
                    onPress={() => setShowComponenteSelectorModal(true)}
                    disabled={!formData.id_servicio}
                  >
                    <Ionicons name="add" size={responsive.responsiveWidth(18)} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.expandButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD', borderColor: colors.primary }]}
                  onPress={() => setIsOfertaExpanded(!isOfertaExpanded)}
                >
                  <Ionicons 
                    name={isOfertaExpanded ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(18)} 
                    color={isDarkMode ? colors.primary : '#1976D2'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            {isOfertaExpanded && (
              <>
                {!formData.id_servicio ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    Primero seleccione un servicio para la oferta
                  </Text>
                ) : formData.ofertaList.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.outline }]}>
                    No hay servicios componentes agregados
                  </Text>
                ) : (
                  formData.ofertaList.map((componente, index) => (
                    <View key={index} style={[styles.componenteItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <View style={styles.componenteInfo}>
                        <Text style={[styles.componenteNombre, { color: colors.onSurface }]}>
                          {componente.nombre}
                        </Text>
                        <Text style={[styles.componenteCategoria, { color: colors.outline }]}>
                          {componente.categoria}
                        </Text>
                      </View>
                      <View style={styles.componenteCantidadRow}>
                        <Text style={[styles.componenteLabel, { color: colors.outline }]}>Cantidad:</Text>
                        {canEdit ? (
                          <TextInput
                            style={[styles.componenteCantidadInput, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                            value={componente.cantidad?.toString() || '1'}
                            onChangeText={(text) => handleCantidadChange(index, text)}
                            keyboardType="decimal-pad"
                          />
                        ) : (
                          <View style={[styles.componenteCantidadInput, styles.inputDisabled, { backgroundColor: colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}>
                            <Text style={{ color: colors.onSurface }}>{componente.cantidad?.toString() || '1'}</Text>
                          </View>
                        )}
                      </View>
                      {canEdit && (
                        <TouchableOpacity
                          style={[styles.deleteButtonSmall, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                          onPress={() => handleRemoveServicioComponente(index)}
                        >
                          <Ionicons name="close" size={responsive.responsiveWidth(18)} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </>
            )}
          </View>

          {canEdit && (
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.buttonText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Card>

        {isViewMode && canEdit && (
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.setParams({ mode: 'edit' })}
          >
            <Ionicons name="create-outline" size={responsive.responsiveWidth(18)} color="#fff" />
            <Text style={[styles.editButtonText, { color: '#fff' }]}>Editar Oferta</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Servicio Selector Modal */}
      {showServicioSelectorModal && (
        <Modal
          visible={showServicioSelectorModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowServicioSelectorModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowServicioSelectorModal(false)}
          >
            <Card style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Seleccionar Servicio</Text>
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
              <ScrollView style={styles.dropdownScroll}>
                {filteredServicios.length > 0 ? (
                  filteredServicios.map((servicio) => (
                    <TouchableOpacity
                      key={servicio.id_servicio}
                      style={styles.dropdownItem}
                      onPress={() => handleSelectServicio(servicio)}
                    >
                      <View>
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{servicio.nombre}</Text>
                        <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>{servicio.categoria}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron servicios</Text>
                )}
              </ScrollView>
            </Card>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Componente Selector Modal */}
      {showComponenteSelectorModal && (
        <Modal
          visible={showComponenteSelectorModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowComponenteSelectorModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowComponenteSelectorModal(false)}
          >
            <Card style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Seleccionar Servicio Componente</Text>
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
                  value={componenteSearchText}
                  onChangeText={setComponenteSearchText}
                />
              </View>
              <ScrollView style={styles.dropdownScroll}>
                {filteredComponentes.length > 0 ? (
                  filteredComponentes.map((servicio) => (
                    <TouchableOpacity
                      key={servicio.id_servicio}
                      style={styles.dropdownItem}
                      onPress={() => handleAddServicioComponente(servicio)}
                    >
                      <View>
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{servicio.nombre}</Text>
                        <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>{servicio.categoria}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron servicios</Text>
                )}
              </ScrollView>
            </Card>
          </TouchableOpacity>
        </Modal>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const OfertaFormScreen = () => <OfertaFormContent />;

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
  },
  formCard: {
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
  formGroup: {
    marginBottom: responsive.responsiveMargin(20),
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  placeholder: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  section: {
    marginTop: responsive.responsiveMargin(24),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  sectionActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  addButtonSmall: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  emptyText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  componenteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(8),
  },
  componenteInfo: {
    flex: 1,
  },
  componenteNombre: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  componenteCategoria: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  componenteCantidadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
  },
  componenteLabel: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  componenteCantidadInput: {
    width: responsive.responsiveWidth(80),
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(8),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    textAlign: 'center',
  },
  deleteButtonSmall: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: responsive.responsiveMargin(8),
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(24),
  },
  button: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(14),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  editButton: {
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
  editButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsive.responsivePadding(20),
  },
  dropdownModal: {
    width: '100%',
    maxHeight: responsive.responsiveHeight(500),
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(16),
  },
  dropdownSearchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    marginBottom: responsive.responsiveMargin(12),
  },
  searchIcon: {
    marginRight: responsive.responsiveMargin(8),
  },
  dropdownSearchInputText: {
    flex: 1,
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    paddingVertical: responsive.responsivePadding(8),
  },
  dropdownScroll: {
    maxHeight: responsive.responsiveHeight(300),
  },
  dropdownItem: {
    paddingVertical: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  dropdownItemSubtext: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
  },
});

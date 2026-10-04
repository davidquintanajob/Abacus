import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { createCliente, updateCliente, getClienteById } from '../services/clienteService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const ClienteFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { user, deudaManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { cliente, mode } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCliente, setIsFetchingCliente] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    nota: '',
    direccion: '',
    telefono: '',
    localizacion_coordenadas_gps: '',
    tipo_cliente: '',
    descuento: '',
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const userRole = user?.rol?.toLowerCase();
  const canManageClientes = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && deudaManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && deudaManagePermissions?.almacenero) ||
    (userRole === 'económico' && deudaManagePermissions?.economico);

  useEffect(() => {
    const fetchCompleteCliente = async () => {
      if (cliente?.id_cliente) {
        try {
          setIsFetchingCliente(true);
          let completeCliente;
          if (isOfflineMode) {
            completeCliente = cliente;
          } else {
            completeCliente = await getClienteById(cliente.id_cliente);
          }
          
          setFormData({
            nombre: completeCliente.nombre || '',
            nota: completeCliente.nota || '',
            direccion: completeCliente.direccion || '',
            telefono: completeCliente.telefono || '',
            localizacion_coordenadas_gps: completeCliente.localizacion_coordenadas_gps || '',
            tipo_cliente: completeCliente.tipo_cliente || '',
            descuento: completeCliente.descuento || '',
          });
        } catch (err) {
          console.error('[fetchCompleteCliente] Error:', err);
          showToast({ type: 'error', message: 'Error al cargar datos del cliente' });
        } finally {
          setIsFetchingCliente(false);
        }
      }
    };

    fetchCompleteCliente();
  }, [cliente?.id_cliente, isOfflineMode]);

  const handleSave = async () => {
    // Validaciones
    if (!formData.nombre || formData.nombre.trim() === '') {
      showToast({ type: 'warning', message: 'El nombre es obligatorio' });
      return;
    }
    if (formData.nombre.length < 1 || formData.nombre.length > 150) {
      showToast({ type: 'warning', message: 'El nombre debe tener entre 1 y 150 caracteres' });
      return;
    }
    if (formData.nota && formData.nota.length > 255) {
      showToast({ type: 'warning', message: 'La nota no puede exceder 255 caracteres' });
      return;
    }
    if (formData.direccion && formData.direccion.length > 255) {
      showToast({ type: 'warning', message: 'La dirección no puede exceder 255 caracteres' });
      return;
    }
    if (formData.telefono && formData.telefono.length > 30) {
      showToast({ type: 'warning', message: 'El teléfono no puede exceder 30 caracteres' });
      return;
    }
    if (formData.localizacion_coordenadas_gps && formData.localizacion_coordenadas_gps.length > 100) {
      showToast({ type: 'warning', message: 'La localización GPS no puede exceder 100 caracteres' });
      return;
    }
    if (formData.tipo_cliente && formData.tipo_cliente.length > 50) {
      showToast({ type: 'warning', message: 'El tipo de cliente no puede exceder 50 caracteres' });
      return;
    }
    if (formData.descuento && formData.descuento.length > 50) {
      showToast({ type: 'warning', message: 'El descuento no puede exceder 50 caracteres' });
      return;
    }

    try {
      setIsSaving(true);

      const clienteData = {
        nombre: formData.nombre.trim(),
        nota: formData.nota || null,
        direccion: formData.direccion || null,
        telefono: formData.telefono || null,
        localizacion_coordenadas_gps: formData.localizacion_coordenadas_gps || null,
        tipo_cliente: formData.tipo_cliente || null,
        descuento: formData.descuento || null,
      };

      if (isEditMode && cliente?.id_cliente) {
        await updateCliente(cliente.id_cliente, clienteData);
        showToast({ type: 'success', message: 'Cliente actualizado correctamente' });
      } else {
        await createCliente(clienteData);
        showToast({ type: 'success', message: 'Cliente creado correctamente' });
      }

      navigation.goBack();
    } catch (err) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar Cliente',
      '¿Estás seguro de que quieres eliminar este cliente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Implementar delete cuando se agregue al servicio
              showToast({ type: 'success', message: 'Cliente eliminado correctamente' });
              navigation.goBack();
            } catch (err) {
              showToast({ type: 'error', message: err.message });
            }
          },
        },
      ]
    );
  };

  const styles = createStyles(responsive);

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          title={isEditMode ? 'Editar Cliente' : isAddMode ? 'Nuevo Cliente' : 'Ver Cliente'}
          onMenuPress={() => {}}
          onThemePress={() => {}}
          onSettingsPress={undefined}
          onNotificationsPress={undefined}
          onProfilePress={() => navigation.navigate('UserProfile')}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          isDark={isDarkMode}
          showLogo={true}
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
          {isFetchingCliente ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando datos del cliente...
              </Text>
            </View>
          ) : (
            <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
              {/* Nombre */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nombre *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Nombre del cliente"
                  value={formData.nombre}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, nombre: text }))}
                  editable={!isReadOnly}
                />
              </View>

              {/* Teléfono */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Teléfono</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Número de teléfono"
                  value={formData.telefono}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, telefono: text }))}
                  keyboardType="phone-pad"
                  editable={!isReadOnly}
                />
              </View>

              {/* Tipo de Cliente */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Tipo de Cliente</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Tipo de cliente (ej: VIP, Regular, etc.)"
                  value={formData.tipo_cliente}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, tipo_cliente: text }))}
                  editable={!isReadOnly}
                />
              </View>

              {/* Dirección */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Dirección</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Dirección del cliente"
                  value={formData.direccion}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, direccion: text }))}
                  editable={!isReadOnly}
                />
              </View>

              {/* Localización GPS */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Localización GPS</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Coordenadas GPS"
                  value={formData.localizacion_coordenadas_gps}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, localizacion_coordenadas_gps: text }))}
                  editable={!isReadOnly}
                />
              </View>

              {/* Descuento */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Descuento</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Descuento aplicable"
                  value={formData.descuento}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, descuento: text }))}
                  editable={!isReadOnly}
                />
              </View>

              {/* Nota */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Notas adicionales"
                  value={formData.nota}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, nota: text }))}
                  multiline
                  numberOfLines={4}
                  editable={!isReadOnly}
                />
              </View>

              {/* Action Buttons */}
              {!isReadOnly && canManageClientes && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                    onPress={() => navigation.goBack()}
                    disabled={isSaving}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                        {isEditMode ? 'Actualizar' : 'Guardar'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {isViewMode && canManageClientes && (
                <TouchableOpacity
                  style={[styles.deleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE', borderColor: colors.error }]}
                  onPress={handleDelete}
                >
                  <Ionicons name="trash-outline" size={responsive.responsiveWidth(20)} color={colors.error} />
                  <Text style={[styles.deleteButtonText, { color: colors.error }]}>Eliminar Cliente</Text>
                </TouchableOpacity>
              )}
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        code={toast.code}
        duration={toast.duration}
        onHide={hideToast}
        toastKey={toast.key}
      />
    </SafeAreaView>
  </>
  );
};

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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  formGroup: {
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
  textArea: {
    height: responsive.responsiveHeight(100),
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(24),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
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
  actionButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    marginTop: responsive.responsiveMargin(16),
  },
  deleteButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default ClienteFormScreen;

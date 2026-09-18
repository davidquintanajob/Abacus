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
import { createCuenta, updateCuenta, getCuentaById } from '../services/cuentaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';

const CuentaFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { cuenta, mode } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingCuenta, setIsFetchingCuenta] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    tipo_cuenta: '',
    num_cuenta: '',
    nota: '',
  });

  const [showTipoCuentaDropdown, setShowTipoCuentaDropdown] = useState(false);

  const tiposCuenta = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  useEffect(() => {
    const fetchCompleteCuenta = async () => {
      if (cuenta?.id_cuenta) {
        try {
          setIsFetchingCuenta(true);
          
          let completeCuenta;
          if (isOfflineMode) {
            completeCuenta = cuenta;
            showToast({ 
              type: 'info', 
              message: 'Cargando datos locales. Conéctese al servidor para cargar datos actualizados.',
              duration: 4000 
            });
          } else {
            completeCuenta = await getCuentaById(cuenta.id_cuenta);
          }
          
          setFormData({
            nombre: completeCuenta.nombre || '',
            tipo_cuenta: completeCuenta.tipo_cuenta || '',
            num_cuenta: completeCuenta.num_cuenta || '',
            nota: completeCuenta.nota || '',
          });
        } catch (error) {
          showToast({ type: 'error', message: error.message });
        } finally {
          setIsFetchingCuenta(false);
        }
      }
    };

    fetchCompleteCuenta();
  }, [cuenta, isOfflineMode]);

  const handleSave = async () => {
    if (!formData.nombre || formData.nombre.trim() === '') {
      showToast({ type: 'warning', message: 'Debe ingresar un nombre' });
      return;
    }
    if (!formData.tipo_cuenta) {
      showToast({ type: 'warning', message: 'Debe seleccionar un tipo de cuenta' });
      return;
    }

    try {
      setIsSaving(true);

      const cuentaData = {
        nombre: formData.nombre.trim(),
        tipo_cuenta: formData.tipo_cuenta,
        num_cuenta: formData.num_cuenta || null,
        nota: formData.nota.trim() || null,
      };

      if (isEditMode) {
        await updateCuenta(cuenta.id_cuenta, cuentaData);
        showToast({ type: 'success', message: 'Cuenta actualizada correctamente' });
      } else {
        await createCuenta(cuentaData);
        showToast({ type: 'success', message: 'Cuenta creada correctamente' });
      }

      navigation.goBack();
    } catch (error) {
      showToast({ type: 'error', message: error.message, code: error.code });
    } finally {
      setIsSaving(false);
    }
  };

  const getTipoCuentaColor = (tipo) => {
    switch (tipo) {
      case 'Efectivo CUP':
        return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50', icon: 'cash-outline' };
      case 'Transferencia CUP':
        return { color: '#2196F3', bgColor: isDarkMode ? 'rgba(33, 150, 243, 0.2)' : '#E3F2FD', borderColor: '#2196F3', icon: 'swap-horizontal-outline' };
      case 'Efectivo USD':
        return { color: '#FF9800', bgColor: isDarkMode ? 'rgba(255, 152, 0, 0.2)' : '#FFF3E0', borderColor: '#FF9800', icon: 'cash-outline' };
      case 'Transferencia USD':
        return { color: '#9C27B0', bgColor: isDarkMode ? 'rgba(156, 39, 176, 0.2)' : '#F3E5F5', borderColor: '#9C27B0', icon: 'swap-horizontal-outline' };
      default:
        return { color: '#757575', bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : '#F5F5F5', borderColor: '#757575', icon: 'help-outline' };
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
        title={isEditMode ? 'Editar Cuenta' : isAddMode ? 'Nueva Cuenta' : 'Ver Cuenta'}
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
          {isFetchingCuenta ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando datos...
              </Text>
            </View>
          ) : (
            <>
              <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
                {/* Nombre */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Nombre *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Nombre de la cuenta..."
                    value={formData.nombre}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, nombre: text }))}
                    editable={!isReadOnly}
                  />
                </View>

                {/* Tipo de Cuenta */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tipo de Cuenta *</Text>
                  {!isReadOnly ? (
                    <>
                      <TouchableOpacity
                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                        onPress={() => setShowTipoCuentaDropdown(!showTipoCuentaDropdown)}
                      >
                        <Text style={[styles.inputText, { color: formData.tipo_cuenta ? colors.onSurface : colors.outline }]}>
                          {formData.tipo_cuenta || 'Seleccionar...'}
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
                            {tiposCuenta.map((tipo, index) => {
                              return (
                                <TouchableOpacity
                                  key={tipo}
                                  style={[styles.dropdownItem, index === tiposCuenta.length - 1 && styles.dropdownItemLast]}
                                  onPress={() => {
                                    setFormData(prev => ({ ...prev, tipo_cuenta: tipo }));
                                    setShowTipoCuentaDropdown(false);
                                  }}
                                >
                                  <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tipo}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={[styles.readOnlyInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.readOnlyText, { color: colors.onSurface }]}>
                        {formData.tipo_cuenta || 'N/A'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Número de Cuenta */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Número de Cuenta</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Número de cuenta (opcional)..."
                    value={formData.num_cuenta}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, num_cuenta: text }))}
                    editable={!isReadOnly}
                  />
                </View>

                {/* Nota */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
                  <TextInput
                    style={[styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Notas adicionales..."
                    value={formData.nota}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, nota: text }))}
                    multiline
                    numberOfLines={4}
                    editable={!isReadOnly}
                  />
                </View>

                {/* Botones */}
                {!isReadOnly && (
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
                        <Text style={[styles.buttonText, { color: '#fff' }]}>
                          {isEditMode ? 'Actualizar' : 'Crear'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: responsive.responsivePadding(16),
    paddingTop: responsive.responsivePadding(80),
    paddingBottom: responsive.responsivePadding(100),
  },
  loadingContainer: {
    alignItems: 'center',
    padding: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(12),
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'Inter',
  },
  formCard: {
    padding: responsive.responsivePadding(16),
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
  },
  readOnlyText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    minHeight: responsive.responsiveHeight(100),
    textAlignVertical: 'top',
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
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
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
});

export default CuentaFormContent;

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
import { useOffline } from '../context/OfflineContext';
import { createOperacion, updateOperacion, getOperacionById } from '../services/operacionService';
import { getCuentas } from '../services/cuentaService';
import { configService } from '../services/configService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OperacionFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user, permissions, operacionAccessLevels, operacionManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { operacion, mode, canViewAllOperaciones: canViewAllOperacionesParam } = route.params || { mode: 'add' };

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || isViewMode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingOperacion, setIsFetchingOperacion] = useState(false);
  const [cuentas, setCuentas] = useState([]);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentaSearchText, setCuentaSearchText] = useState('');
  const [config, setConfig] = useState({});
  const [exchangeRate, setExchangeRate] = useState(null);
  
  const [formData, setFormData] = useState({
    id_cuenta: null,
    id_usuario: null,
    cantidad_operacion: '',
    tipo_operacion: 'Ingreso',
    fecha_hora: new Date().toISOString(),
    motivo: '',
    cambio_moneda: '',
    cuenta: null,
    usuario: null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTipoOperacionDropdown, setShowTipoOperacionDropdown] = useState(false);

  const tiposOperacion = ['Ingreso', 'Retiro'];

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';

  const userRole = user?.rol?.toLowerCase();
  const canManageOperaciones = 
    userRole === 'administrador' ||
    (userRole === 'dependiente' && operacionManagePermissions?.dependiente) ||
    (userRole === 'almacenero' && operacionManagePermissions?.almacenero) ||
    (userRole === 'económico' && operacionManagePermissions?.economico);

  useEffect(() => {
    fetchCuentas();
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchCompleteOperacion = async () => {
      if (operacion?.id_operacion) {
        try {
          setIsFetchingOperacion(true);
          
          let completeOperacion;
          if (isOfflineMode) {
            completeOperacion = operacion;
            showToast({ 
              type: 'info', 
              message: 'Cargando datos locales. Conéctese al servidor para cargar datos actualizados.',
              duration: 4000 
            });
          } else {
            completeOperacion = await getOperacionById(operacion.id_operacion);
          }
          
          setFormData({
            id_cuenta: completeOperacion.id_cuenta,
            id_usuario: completeOperacion.id_usuario,
            cantidad_operacion: completeOperacion.cantidad_operacion?.toString() || '',
            tipo_operacion: completeOperacion.tipo_operacion,
            fecha_hora: completeOperacion.fecha_hora,
            motivo: completeOperacion.motivo || '',
            cambio_moneda: completeOperacion.cambio_moneda?.toString() || '',
            cuenta: completeOperacion.cuenta,
            usuario: completeOperacion.usuario,
          });
          
          if (completeOperacion.cuenta) {
            setCuentaSearchText(completeOperacion.cuenta.nombre);
          }
        } catch (err) {
          console.error('[fetchCompleteOperacion] Error:', err);
        } finally {
          setIsFetchingOperacion(false);
        }
      }
    };

    fetchCompleteOperacion();
  }, [operacion?.id_operacion, isOfflineMode]);

  const fetchCuentas = async () => {
    try {
      if (isOfflineMode) {
        setCuentas([]);
        return;
      }
      
      const data = await getCuentas({}, 1, 1000);
      setCuentas(data.data || []);
    } catch (err) {
      setCuentas([]);
    }
  };

  const fetchConfig = async () => {
    try {
      const data = await configService.getConfig();
      setConfig(data);
      if (data.cupToUsdRate) {
        setExchangeRate(data.cupToUsdRate);
        if (isAddMode) {
          setFormData(prev => ({ ...prev, cambio_moneda: data.cupToUsdRate.toString() }));
        }
      }
    } catch (err) {
      // Error fetching config, try AsyncStorage directly
      try {
        const CONFIG_KEY = '@abacus_config';
        const jsonValue = await AsyncStorage.getItem(CONFIG_KEY);
        if (jsonValue !== null) {
          const localConfig = JSON.parse(jsonValue);
          if (localConfig.cupToUsdRate) {
            setExchangeRate(localConfig.cupToUsdRate);
            if (isAddMode) {
              setFormData(prev => ({ ...prev, cambio_moneda: localConfig.cupToUsdRate.toString() }));
            }
          }
        }
      } catch (storageError) {
        // Error reading from AsyncStorage
      }
    }
  };

  const handleCantidadChange = (text) => {
    setFormData(prev => ({ ...prev, cantidad_operacion: text }));
  };

  const handleSave = async () => {
    if (!formData.cuenta) {
      showToast({ type: 'warning', message: 'Debe seleccionar una cuenta' });
      return;
    }
    if (!formData.cantidad_operacion || parseFloat(formData.cantidad_operacion) < 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor o igual a 0' });
      return;
    }
    if (!formData.tipo_operacion) {
      showToast({ type: 'warning', message: 'Debe seleccionar un tipo de operación' });
      return;
    }
    if (!formData.motivo || formData.motivo.trim() === '') {
      showToast({ type: 'warning', message: 'Debe ingresar un motivo' });
      return;
    }
    if (!formData.cambio_moneda || parseFloat(formData.cambio_moneda) <= 0) {
      showToast({ type: 'warning', message: 'El cambio de moneda debe ser mayor que 0' });
      return;
    }

    // Validation for edit mode: non-admin users cannot edit others' operations
    if (isEditMode && !isAdmin && formData.usuario?.id_usuario !== user?.id_usuario) {
      showToast({ type: 'error', message: 'No tiene permisos para modificar operaciones de otros usuarios' });
      return;
    }

    try {
      setIsSaving(true);

      const operacionData = {
        id_cuenta: formData.id_cuenta,
        cantidad_operacion: parseFloat(formData.cantidad_operacion),
        tipo_operacion: formData.tipo_operacion,
        fecha_hora: formData.fecha_hora,
        motivo: formData.motivo.trim(),
        cambio_moneda: parseFloat(formData.cambio_moneda),
      };

      // Always use the logged-in user for id_usuario
      // If admin is editing another user's operation, the operation becomes the admin's
      operacionData.id_usuario = user.id_usuario;

      if (isEditMode) {
        await updateOperacion(operacion.id_operacion, operacionData);
        showToast({ type: 'success', message: 'Operación actualizada correctamente' });
      } else {
        await createOperacion(operacionData);
        showToast({ type: 'success', message: 'Operación creada correctamente' });
      }

      navigation.goBack();
    } catch (error) {
      showToast({ type: 'error', message: error.message, code: error.code });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFechaChange = (event, selectedDate) => {
    if (event.type === 'set' && selectedDate) {
      // Set the time to current time when only date is selected
      const now = new Date();
      selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      setFormData(prev => ({ ...prev, fecha_hora: selectedDate.toISOString() }));
    }
    setShowDatePicker(false);
  };

  const filteredCuentas = cuentas.filter(cuenta =>
    cuenta.nombre.toLowerCase().includes(cuentaSearchText.toLowerCase())
  );

  const getOperacionTypeColor = (tipo) => {
    switch (tipo) {
      case 'Ingreso':
        return { color: '#4CAF50', bgColor: isDarkMode ? 'rgba(76, 175, 80, 0.2)' : '#E8F5E9', borderColor: '#4CAF50' };
      case 'Retiro':
        return { color: '#F44336', bgColor: isDarkMode ? 'rgba(244, 67, 54, 0.2)' : '#FFEBEE', borderColor: '#F44336' };
      default:
        return { color: '#757575', bgColor: isDarkMode ? 'rgba(117, 117, 117, 0.2)' : '#F5F5F5', borderColor: '#757575' };
    }
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '0.00';
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${integerPart}.${parts[1]}`;
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
        title={isEditMode ? 'Editar Operación' : isAddMode ? 'Nueva Operación' : 'Ver Operación'}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isFetchingOperacion ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>
                Cargando datos...
              </Text>
            </View>
          ) : (
            <>
              <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
                {/* Cuenta - Full Row */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cuenta *</Text>
                  {!isReadOnly ? (
                    <>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        placeholderTextColor={colors.outline}
                        placeholder="Buscar cuenta..."
                        value={cuentaSearchText}
                        onChangeText={setCuentaSearchText}
                        onFocus={() => setShowCuentaDropdown(true)}
                        editable={!isReadOnly}
                      />
                      {showCuentaDropdown && (
                        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                            {filteredCuentas.map((cuenta) => (
                              <TouchableOpacity
                                key={cuenta.id_cuenta}
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    id_cuenta: cuenta.id_cuenta,
                                    cuenta: cuenta 
                                  }));
                                  setCuentaSearchText(cuenta.nombre);
                                  setShowCuentaDropdown(false);
                                }}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>
                                  {cuenta.nombre}
                                </Text>
                                <Text style={[styles.dropdownItemSubtext, { color: colors.outline }]}>
                                  {cuenta.tipo_cuenta} • Fondo: {formatNumber(cuenta.fondo)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={[styles.readOnlyInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.readOnlyText, { color: colors.onSurface }]}>
                        {formData.cuenta?.nombre || 'N/A'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Tipo de Operación y Fecha */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Tipo de Operación *</Text>
                    {!isReadOnly ? (
                      <>
                        <TouchableOpacity
                          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                          onPress={() => setShowTipoOperacionDropdown(!showTipoOperacionDropdown)}
                        >
                          <Text style={[styles.inputText, { color: colors.onSurface }]}>
                            {formData.tipo_operacion}
                          </Text>
                          <Ionicons 
                            name={showTipoOperacionDropdown ? "chevron-up" : "chevron-down"} 
                            size={20} 
                            color={colors.primary} 
                          />
                        </TouchableOpacity>
                        {showTipoOperacionDropdown && (
                          <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                              {tiposOperacion.map((tipo) => (
                                <TouchableOpacity
                                  key={tipo}
                                  style={styles.dropdownItem}
                                  onPress={() => {
                                    setFormData(prev => ({ ...prev, tipo_operacion: tipo }));
                                    setShowTipoOperacionDropdown(false);
                                  }}
                                >
                                  <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tipo}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={[styles.readOnlyInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                        <Text style={[styles.readOnlyText, { color: colors.onSurface }]}>
                          {formData.tipo_operacion}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Fecha *</Text>
                    {!isReadOnly ? (
                      <TouchableOpacity
                        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={[styles.inputText, { color: colors.onSurface }]}>
                          {new Date(formData.fecha_hora).toLocaleDateString()}
                        </Text>
                        <Ionicons name="calendar" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.readOnlyInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                        <Text style={[styles.readOnlyText, { color: colors.onSurface }]}>
                          {new Date(formData.fecha_hora).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                    {showDatePicker && (
                      <DateTimePicker
                        value={new Date(formData.fecha_hora)}
                        mode="date"
                        display="default"
                        onChange={handleFechaChange}
                      />
                    )}
                  </View>
                </View>

                {/* Cantidad y Cambio de Moneda */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Cantidad *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      placeholderTextColor={colors.outline}
                      placeholder="0.00"
                      value={formData.cantidad_operacion}
                      onChangeText={handleCantidadChange}
                      keyboardType="decimal-pad"
                      editable={!isReadOnly}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Cambio de Moneda</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      placeholderTextColor={colors.outline}
                      placeholder="1.00"
                      value={formData.cambio_moneda}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, cambio_moneda: text }))}
                      keyboardType="decimal-pad"
                      editable={false}
                    />
                  </View>
                </View>

                {/* Motivo */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Motivo *</Text>
                  <TextInput
                    style={[styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Descripción del motivo..."
                    value={formData.motivo}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, motivo: text }))}
                    multiline
                    numberOfLines={4}
                    editable={!isReadOnly}
                  />
                </View>


                {/* Info de Cuenta */}
                {formData.cuenta && (
                  <View style={[styles.cuentaInfo, { backgroundColor: isDarkMode ? colors.primaryContainer : '#F5F5F5', borderColor: colors.primary }]}>
                    <Text style={[styles.cuentaInfoTitle, { color: isDarkMode ? colors.onSurface : '#212121' }]}>Información de la Cuenta</Text>
                    <View style={styles.cuentaInfoRow}>
                      <Text style={[styles.cuentaInfoLabel, { color: isDarkMode ? colors.outline : '#616161' }]}>Tipo:</Text>
                      <Text style={[styles.cuentaInfoValue, { color: isDarkMode ? colors.onSurface : '#212121' }]}>{formData.cuenta.tipo_cuenta}</Text>
                    </View>
                    <View style={styles.cuentaInfoRow}>
                      <Text style={[styles.cuentaInfoLabel, { color: isDarkMode ? colors.outline : '#616161' }]}>Fondo Actual:</Text>
                      <Text style={[styles.cuentaInfoValue, { color: colors.primary }]}>
                        {formatNumber(formData.cuenta.fondo)}
                      </Text>
                    </View>
                    <View style={styles.cuentaInfoRow}>
                      <Text style={[styles.cuentaInfoLabel, { color: isDarkMode ? colors.outline : '#616161' }]}>Tasa de Cambio:</Text>
                      <Text style={[styles.cuentaInfoValue, { color: isDarkMode ? colors.onSurface : '#212121' }]}>
                        {exchangeRate ? formatNumber(exchangeRate) : 'N/A'}
                      </Text>
                    </View>
                    {formData.cantidad_operacion && formData.tipo_operacion && (
                      <View style={styles.cuentaInfoRow}>
                        <Text style={[styles.cuentaInfoLabel, { color: isDarkMode ? colors.outline : '#616161' }]}>
                          Fondo después de {formData.tipo_operacion.toLowerCase()}:
                        </Text>
                        <Text style={[styles.cuentaInfoValue, { color: formData.tipo_operacion === 'Retiro' ? '#F44336' : '#4CAF50' }]}>
                          {(() => {
                            const currentFund = parseFloat(formData.cuenta.fondo || 0);
                            const cantidad = parseFloat(formData.cantidad_operacion) || 0;
                            let newFund = currentFund;
                            if (formData.tipo_operacion === 'Ingreso') {
                              newFund = currentFund + cantidad;
                            } else if (formData.tipo_operacion === 'Retiro') {
                              newFund = currentFund - cantidad;
                            }
                            return formatNumber(newFund);
                          })()}
                        </Text>
                      </View>
                    )}
                    {formData.cuenta.num_cuenta && (
                      <View style={styles.cuentaInfoRow}>
                        <Text style={[styles.cuentaInfoLabel, { color: isDarkMode ? colors.outline : '#616161' }]}>Número:</Text>
                        <Text style={[styles.cuentaInfoValue, { color: isDarkMode ? colors.onSurface : '#212121' }]}>{formData.cuenta.num_cuenta}</Text>
                      </View>
                    )}
                  </View>
                )}

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
    paddingTop: responsive.responsivePadding(64),
    paddingBottom: responsive.responsivePadding(100),
  },
  loadingContainer: {
    alignItems: 'center',
    padding: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(12),
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'JetBrains Mono',
  },
  formCard: {
    padding: responsive.responsivePadding(16),
  },
  formGroup: {
    marginBottom: responsive.responsiveMargin(16),
  },
  formRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  label: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
    marginBottom: 8,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(10),
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'JetBrains Mono',
    minHeight: responsive.responsivePadding(44),
  },
  inputText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'JetBrains Mono',
  },
  readOnlyInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(10),
    minHeight: responsive.responsivePadding(44),
  },
  readOnlyText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'JetBrains Mono',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(10),
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'JetBrains Mono',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'JetBrains Mono',
    marginTop: 4,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    marginTop: 4,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  dropdownItemText: {
    fontSize: responsive.responsiveFontSize(14),
    fontFamily: 'JetBrains Mono',
    fontWeight: '500',
  },
  dropdownItemSubtext: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'JetBrains Mono',
    marginTop: 2,
  },
  cuentaInfo: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    marginTop: responsive.responsiveMargin(16),
  },
  cuentaInfoTitle: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(8),
  },
  cuentaInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsive.responsiveMargin(4),
  },
  cuentaInfoLabel: {
    fontSize: responsive.responsiveFontSize(12),
    fontFamily: 'JetBrains Mono',
  },
  cuentaInfoValue: {
    fontSize: responsive.responsiveFontSize(12),
    fontWeight: '500',
    fontFamily: 'JetBrains Mono',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(24),
  },
  button: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    borderColor: 'transparent',
  },
  saveButton: {
    borderColor: 'transparent',
  },
  buttonText: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '600',
    fontFamily: 'JetBrains Mono',
  },
});

export default OperacionFormContent;

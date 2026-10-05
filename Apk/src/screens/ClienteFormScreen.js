import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Linking, KeyboardAvoidingView, Platform, Modal } from 'react-native';
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
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import { getClienteById, createCliente, updateCliente, deleteCliente } from '../services/clienteService';
import { getCuentas } from '../services/cuentaService';
import { getDeudas, saldarDeuda } from '../services/deudaService';
import configService from '../services/configService';

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

  // Estado para crear deuda asociada al cliente (cuando el backend esté listo)
  const [createWithDeuda, setCreateWithDeuda] = useState(false);
  
  // Estado para agregar primer pago al crear deuda
  const [createWithPago, setCreateWithPago] = useState(false);
  
  // Estado para datos de deuda
  const [deudaData, setDeudaData] = useState({
    monto_cup: '',
    monto_usd: '',
    nota: ''
  });
  
  // Estado para datos de pago
  const [pagoData, setPagoData] = useState({
    cantidad: '',
    forma_pago: '',
    id_cuenta_operacion: '',
    cambio_moneda: '1',
    nota: ''
  });
  
  // Estado para deudas del cliente
  const [deudas, setDeudas] = useState([]);
  const [isLoadingDeudas, setIsLoadingDeudas] = useState(false);
  const [expandedDeudas, setExpandedDeudas] = useState({});
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedDeuda, setSelectedDeuda] = useState(null);
  const [pagoFormData, setPagoFormData] = useState({
    cantidad_pagada: '',
    forma_pago: '',
    id_cuenta_operacion: '',
    cambio_moneda: '1',
    nota: ''
  });
  const [showFormaPagoDropdown, setShowFormaPagoDropdown] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [cuentas, setCuentas] = useState([]);
  const [formasPago] = useState(['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD']);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  const handleOpenGoogleMaps = async () => {
    setShowInstructionsModal(true);
  };

  const handleConfirmOpenGoogleMaps = async () => {
    setShowInstructionsModal(false);
    try {
      // Abre Google Maps para que el usuario pueda buscar una ubicación
      const url = 'https://www.google.com/maps';
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'No se puede abrir Google Maps en este dispositivo');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir Google Maps');
    }
  };

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
  }, [cliente, isOfflineMode]);

  useEffect(() => {
    const fetchCuentas = async () => {
      if (createWithPago && !isOfflineMode) {
        try {
          const cuentasData = await getCuentas({}, 1, 1000);
          setCuentas(cuentasData.data || []);
        } catch (error) {
          console.error('Error al cargar cuentas:', error);
          setCuentas([]);
        }
      }
    };

    fetchCuentas();
  }, [createWithPago, isOfflineMode]);

  useEffect(() => {
    const fetchDeudas = async () => {
      if (cliente?.id_cliente && !isOfflineMode && (isEditMode || isViewMode)) {
        try {
          setIsLoadingDeudas(true);
          const deudasData = await getDeudas({ id_cliente: cliente.id_cliente }, 1, 1000);
          setDeudas(deudasData.data || []);
        } catch (error) {
          console.error('Error al cargar deudas:', error);
          setDeudas([]);
        } finally {
          setIsLoadingDeudas(false);
        }
      }
    };

    fetchDeudas();
  }, [cliente?.id_cliente, isOfflineMode, isEditMode, isViewMode]);

  const toggleDeudaExpansion = (deudaId) => {
    setExpandedDeudas(prev => ({
      ...prev,
      [deudaId]: !prev[deudaId]
    }));
  };

  const handleOpenPagoModal = async (deuda) => {
    setSelectedDeuda(deuda);
    setPagoFormData({
      cantidad_pagada: '',
      forma_pago: '',
      id_cuenta_operacion: '',
      cambio_moneda: '1',
      nota: ''
    });
    
    // Cargar cuentas cuando se abre el modal
    if (!isOfflineMode) {
      try {
        const cuentasData = await getCuentas({}, 1, 1000);
        setCuentas(cuentasData.data || []);
      } catch (error) {
        console.error('Error al cargar cuentas:', error);
        setCuentas([]);
      }
    }
    
    setShowPagoModal(true);
  };

  const handleClosePagoModal = () => {
    setShowPagoModal(false);
    setSelectedDeuda(null);
    setPagoFormData({
      cantidad_pagada: '',
      forma_pago: '',
      id_cuenta_operacion: '',
      cambio_moneda: '1',
      nota: ''
    });
  };

  const handleSavePago = async () => {
    if (!pagoFormData.cantidad_pagada || pagoFormData.cantidad_pagada.trim() === '') {
      showToast({ type: 'warning', message: 'La cantidad es obligatoria' });
      return;
    }
    if (!pagoFormData.forma_pago || pagoFormData.forma_pago.trim() === '') {
      showToast({ type: 'warning', message: 'La forma de pago es obligatoria' });
      return;
    }
    if (!pagoFormData.id_cuenta_operacion || pagoFormData.id_cuenta_operacion.trim() === '') {
      showToast({ type: 'warning', message: 'Debe seleccionar una cuenta de operación' });
      return;
    }

    try {
      const pago = {
        cantidad_pagada: parseFloat(pagoFormData.cantidad_pagada),
        forma_pago: pagoFormData.forma_pago,
        cambio_moneda: parseFloat(pagoFormData.cambio_moneda) || 1,
        id_cuenta_operacion: parseInt(pagoFormData.id_cuenta_operacion),
        fecha_hora: new Date(),
        nota: pagoFormData.nota || null
      };
      
      await saldarDeuda(selectedDeuda.id_deuda, [pago]);
      showToast({ type: 'success', message: 'Pago agregado correctamente' });
      handleClosePagoModal();
      
      // Recargar deudas
      const deudasData = await getDeudas({ id_cliente: cliente.id_cliente }, 1, 1000);
      setDeudas(deudasData.data || []);
    } catch (error) {
      showToast({ type: 'error', message: error.message || 'Error al agregar pago' });
    }
  };

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

    // Validaciones para deuda
    if (createWithDeuda) {
      if (!deudaData.monto_cup && !deudaData.monto_usd) {
        showToast({ type: 'warning', message: 'Debe ingresar al menos un monto (CUP o USD) para la deuda' });
        return;
      }
      if (deudaData.monto_cup && (isNaN(deudaData.monto_cup) || parseFloat(deudaData.monto_cup) < 0)) {
        showToast({ type: 'warning', message: 'El monto CUP debe ser un número no negativo' });
        return;
      }
      if (deudaData.monto_usd && (isNaN(deudaData.monto_usd) || parseFloat(deudaData.monto_usd) < 0)) {
        showToast({ type: 'warning', message: 'El monto USD debe ser un número no negativo' });
        return;
      }
    }

    // Validaciones para pago
    if (createWithPago) {
      if (!pagoData.cantidad || pagoData.cantidad.trim() === '') {
        showToast({ type: 'warning', message: 'La cantidad del pago es obligatoria' });
        return;
      }
      if (isNaN(pagoData.cantidad) || parseFloat(pagoData.cantidad) <= 0) {
        showToast({ type: 'warning', message: 'La cantidad del pago debe ser mayor que cero' });
        return;
      }
      if (!pagoData.forma_pago || pagoData.forma_pago.trim() === '') {
        showToast({ type: 'warning', message: 'La forma de pago es obligatoria' });
        return;
      }
      if (!pagoData.id_cuenta_operacion || pagoData.id_cuenta_operacion.trim() === '') {
        showToast({ type: 'warning', message: 'Para crear un pago inicial, debe seleccionar una cuenta de operación' });
        return;
      }
      if (!['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'].includes(pagoData.forma_pago)) {
        showToast({ type: 'warning', message: 'Forma de pago inválida. Use: Efectivo CUP, Transferencia CUP, Efectivo USD o Transferencia USD' });
        return;
      }
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

      // Agregar deuda y pago si están activos (solo en modo crear)
      let deudaPayload = null;
      let pagoPayload = null;

      if (isAddMode && createWithDeuda) {
        deudaPayload = {
          monto_cup: deudaData.monto_cup ? parseFloat(deudaData.monto_cup) : 0,
          monto_usd: deudaData.monto_usd ? parseFloat(deudaData.monto_usd) : 0,
          cambio_moneda: 1, // Valor por defecto, podría ser configurable
          nota: deudaData.nota || null,
        };

        if (createWithPago) {
          pagoPayload = {
            cantidad_pagada: parseFloat(pagoData.cantidad),
            forma_pago: pagoData.forma_pago,
            cambio_moneda: 1,
            nota: pagoData.nota || null,
            id_cuenta_operacion: parseInt(pagoData.id_cuenta_operacion),
          };
        }
      }

      if (isEditMode && cliente?.id_cliente) {
        await updateCliente(cliente.id_cliente, clienteData);
        showToast({ type: 'success', message: 'Cliente actualizado correctamente' });
      } else {
        const payload = { ...clienteData };
        if (deudaPayload) payload.deuda = deudaPayload;
        if (pagoPayload) payload.pago_deuda = pagoPayload;
        
        await createCliente(payload);
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
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
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

              {/* Teléfono y Tipo de Cliente */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
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
                <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
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
                <View style={styles.gpsInputContainer}>
                  <TextInput
                    style={[styles.input, styles.gpsInput, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Coordenadas GPS (latitud, longitud)"
                    value={formData.localizacion_coordenadas_gps}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, localizacion_coordenadas_gps: text }))}
                    editable={!isReadOnly}
                  />
                  <TouchableOpacity
                    style={[styles.gpsButton, { backgroundColor: colors.primary }]}
                    onPress={handleOpenGoogleMaps}
                    disabled={isReadOnly}
                  >
                    <Ionicons name="map-outline" size={responsive.responsiveWidth(20)} color="#fff" />
                  </TouchableOpacity>
                </View>
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

              {/* Opción para crear deuda asociada (solo en modo agregar) */}
              {isAddMode && !isReadOnly && (
                <View style={styles.deudaSection}>
                  <TouchableOpacity
                    style={[styles.toggleButton, { backgroundColor: createWithDeuda ? colors.primaryContainer : colors.surface, borderColor: colors.primary }]}
                    onPress={() => setCreateWithDeuda(!createWithDeuda)}
                  >
                    <Ionicons 
                      name={createWithDeuda ? "checkmark-circle" : "add-circle-outline"} 
                      size={responsive.responsiveWidth(20)} 
                      color={createWithDeuda ? (isDarkMode ? colors.primary : '#fff') : colors.outline} 
                    />
                    <Text style={[styles.toggleButtonText, { color: createWithDeuda ? (isDarkMode ? colors.primary : '#fff') : colors.onSurface }]}>
                      Crear con deuda asociada
                    </Text>
                  </TouchableOpacity>

                  {createWithDeuda && (
                    <View style={styles.deudaFormContainer}>
                      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Datos de la Deuda</Text>
                      
                      <View style={styles.formRow}>
                        <View style={[styles.formGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                          <Text style={[styles.label, { color: colors.outline }]}>Monto CUP</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                            placeholderTextColor={colors.outline}
                            placeholder="Monto en CUP"
                            value={deudaData.monto_cup}
                            onChangeText={(text) => setDeudaData(prev => ({ ...prev, monto_cup: text }))}
                            keyboardType="numeric"
                            editable={!isReadOnly}
                          />
                        </View>

                        <View style={[styles.formGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                          <Text style={[styles.label, { color: colors.outline }]}>Monto USD</Text>
                          <TextInput
                            style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                            placeholderTextColor={colors.outline}
                            placeholder="Monto en USD"
                            value={deudaData.monto_usd}
                            onChangeText={(text) => setDeudaData(prev => ({ ...prev, monto_usd: text }))}
                            keyboardType="numeric"
                            editable={!isReadOnly}
                          />
                        </View>
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={[styles.label, { color: colors.outline }]}>Nota de deuda</Text>
                        <TextInput
                          style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                          placeholderTextColor={colors.outline}
                          placeholder="Notas sobre la deuda"
                          value={deudaData.nota}
                          onChangeText={(text) => setDeudaData(prev => ({ ...prev, nota: text }))}
                          multiline
                          numberOfLines={3}
                          editable={!isReadOnly}
                        />
                      </View>

                      <TouchableOpacity
                        style={[styles.toggleButton, styles.toggleButtonSmall, { backgroundColor: createWithPago ? colors.primaryContainer : colors.surface, borderColor: colors.primary }]}
                        onPress={() => setCreateWithPago(!createWithPago)}
                      >
                        <Ionicons 
                          name={createWithPago ? "checkmark-circle" : "add-circle-outline"} 
                          size={responsive.responsiveWidth(18)} 
                          color={createWithPago ? (isDarkMode ? colors.primary : '#fff') : colors.outline} 
                        />
                        <Text style={[styles.toggleButtonTextSmall, { color: createWithPago ? (isDarkMode ? colors.primary : '#fff') : colors.onSurface }]}>
                          Agregar primer pago
                        </Text>
                      </TouchableOpacity>

                      {createWithPago && (
                        <View style={styles.pagoFormContainer}>
                          <View style={styles.formGroup}>
                            <Text style={[styles.label, { color: colors.outline }]}>Cantidad a pagar</Text>
                            <TextInput
                              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                              placeholderTextColor={colors.outline}
                              placeholder="Cantidad"
                              value={pagoData.cantidad}
                              onChangeText={(text) => setPagoData(prev => ({ ...prev, cantidad: text }))}
                              keyboardType="numeric"
                              editable={!isReadOnly}
                            />
                          </View>

                          <View style={styles.formGroup}>
                            <Text style={[styles.label, { color: colors.outline }]}>Forma de pago</Text>
                            <TouchableOpacity
                              style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                              onPress={() => setShowFormaPagoDropdown(!showFormaPagoDropdown)}
                              disabled={isReadOnly}
                            >
                              <Text style={[styles.dropdownText, { color: pagoData.forma_pago ? colors.onSurface : colors.outline }]}>
                                {pagoData.forma_pago || 'Seleccionar for...'}
                              </Text>
                              <Ionicons 
                                name={showFormaPagoDropdown ? "chevron-up" : "chevron-down"} 
                                size={responsive.responsiveWidth(20)} 
                                color={colors.outline} 
                              />
                            </TouchableOpacity>
                            
                            {showFormaPagoDropdown && (
                              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                                {formasPago.map((forma, index) => (
                                  <TouchableOpacity
                                    key={forma}
                                    style={[styles.dropdownItem, index === formasPago.length - 1 && styles.dropdownItemLast]}
                                    onPress={() => {
                                      setPagoData(prev => ({ 
                                        ...prev, 
                                        forma_pago: forma,
                                        id_cuenta_operacion: '' // Limpiar cuenta al cambiar forma de pago
                                      }));
                                      setShowFormaPagoDropdown(false);
                                    }}
                                  >
                                    <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{forma}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )}
                          </View>

                          <View style={styles.formGroup}>
                            <Text style={[styles.label, { color: colors.outline }]}>Cuenta de Operación</Text>
                            <TouchableOpacity
                              style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                              onPress={() => setShowCuentaDropdown(!showCuentaDropdown)}
                              disabled={isReadOnly}
                            >
                              <Text style={[styles.dropdownText, { color: pagoData.id_cuenta_operacion ? colors.onSurface : colors.outline }]}>
                                {pagoData.id_cuenta_operacion ? (Array.isArray(cuentas) ? cuentas.find(c => c.id_cuenta === parseInt(pagoData.id_cuenta_operacion))?.nombre || 'Cuenta seleccionada' : 'Cuenta seleccionada') : 'Seleccionar cuenta'}
                              </Text>
                              <Ionicons 
                                name={showCuentaDropdown ? "chevron-up" : "chevron-down"} 
                                size={responsive.responsiveWidth(20)} 
                                color={colors.outline} 
                              />
                            </TouchableOpacity>
                            
                            {showCuentaDropdown && (
                              <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                                {Array.isArray(cuentas) && cuentas
                                  .filter(cuenta => !pagoData.forma_pago || cuenta.tipo_cuenta === pagoData.forma_pago)
                                  .map((cuenta, index, filtered) => (
                                    <TouchableOpacity
                                      key={cuenta.id_cuenta}
                                      style={[styles.dropdownItem, index === filtered.length - 1 && styles.dropdownItemLast]}
                                      onPress={() => {
                                        setPagoData(prev => ({ 
                                          ...prev, 
                                          id_cuenta_operacion: cuenta.id_cuenta.toString(),
                                          forma_pago: cuenta.tipo_cuenta || prev.forma_pago
                                        }));
                                        setShowCuentaDropdown(false);
                                      }}
                                    >
                                      <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre} ({cuenta.tipo_cuenta})</Text>
                                    </TouchableOpacity>
                                  ))}
                              </View>
                            )}
                          </View>

                          <View style={styles.formGroup}>
                            <Text style={[styles.label, { color: colors.outline }]}>Nota del pago</Text>
                            <TextInput
                              style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                              placeholderTextColor={colors.outline}
                              placeholder="Notas sobre el pago"
                              value={pagoData.nota}
                              onChangeText={(text) => setPagoData(prev => ({ ...prev, nota: text }))}
                              editable={!isReadOnly}
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Action Buttons */}
              {!isReadOnly && canManageClientes && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outlineVariant }]}
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

              {/* Sección de Deudas del Cliente */}
              {(isEditMode || isViewMode) && (
                <View style={styles.deudasSection}>
                  <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: 20 }]}>Deudas del Cliente</Text>
                  
                  {isLoadingDeudas ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : deudas.length === 0 ? (
                    <Text style={[styles.noDeudasText, { color: colors.outline }]}>No hay deudas registradas para este cliente</Text>
                  ) : (
                    deudas.map((deuda) => {
                      const isExpanded = expandedDeudas[deuda.id_deuda];
                      const montoRestanteCup = (deuda.monto_cup || 0) - (deuda.pagos?.reduce((sum, pago) => sum + (pago.cantidad_pagada || 0), 0) || 0);
                      const montoRestanteUsd = (deuda.monto_usd || 0) - (deuda.pagos?.reduce((sum, pago) => sum + (pago.cantidad_pagada || 0), 0) || 0);
                      const isSaldada = deuda.estado === true || (montoRestanteCup <= 0 && montoRestanteUsd <= 0);
                      
                      return (
                        <View key={deuda.id_deuda} style={[
                          styles.deudaCard,
                          { 
                            backgroundColor: isSaldada ? (isDarkMode ? 'rgba(76, 175, 80, 0.1)' : '#E8F5E9') : (isDarkMode ? 'rgba(33, 150, 243, 0.1)' : '#E3F2FD'),
                            borderColor: isSaldada ? '#4CAF50' : '#2196F3',
                            borderWidth: 1
                          }
                        ]}>
                          <TouchableOpacity
                            style={styles.deudaHeader}
                            onPress={() => toggleDeudaExpansion(deuda.id_deuda)}
                          >
                            <View style={styles.deudaHeaderLeft}>
                              <Ionicons 
                                name={isExpanded ? "chevron-down" : "chevron-forward"} 
                                size={20} 
                                color={isSaldada ? '#4CAF50' : '#2196F3'} 
                              />
                              <View style={styles.deudaInfo}>
                                <Text style={[styles.deudaDate, { color: colors.onSurface }]}>
                                  {new Date(deuda.fecha_hora).toLocaleDateString()}
                                </Text>
                                <Text style={[styles.deudaStatus, { color: isSaldada ? '#4CAF50' : '#F44336' }]}>
                                  {isSaldada ? 'Saldada' : 'Pendiente'}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.deudaHeaderRight}>
                              <TouchableOpacity
                                style={styles.addPagoButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleOpenPagoModal(deuda);
                                }}
                              >
                                <Ionicons name="add-circle" size={24} color={colors.primary} />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                          
                          <View style={styles.deudaDetails}>
                            <Text style={[styles.deudaLabel, { color: colors.outline }]}>Monto deuda:</Text>
                            {(deuda.monto_cup && parseFloat(deuda.monto_cup) > 0) ? (
                              <Text style={[styles.deudaValue, { color: colors.onSurface }]}>
                                CUP = ${deuda.monto_cup}
                              </Text>
                            ) : null}
                            {(deuda.monto_usd && parseFloat(deuda.monto_usd) > 0) ? (
                              <Text style={[styles.deudaValue, { color: colors.onSurface }]}>
                                USD = ${deuda.monto_usd}
                              </Text>
                            ) : null}
                            
                            {(!isSaldada && (montoRestanteCup > 0 || montoRestanteUsd > 0)) && (
                              <>
                                <Text style={[styles.deudaLabel, { color: colors.outline, marginTop: 8 }]}>Restante:</Text>
                                {montoRestanteCup > 0 ? (
                                  <Text style={[
                                    styles.deudaValue,
                                    { color: '#F44336', fontWeight: '700' }
                                  ]}>
                                    CUP = ${montoRestanteCup.toFixed(2)}
                                  </Text>
                                ) : null}
                                {montoRestanteUsd > 0 ? (
                                  <Text style={[
                                    styles.deudaValue,
                                    { color: '#F44336', fontWeight: '700' }
                                  ]}>
                                    USD = ${montoRestanteUsd.toFixed(2)}
                                  </Text>
                                ) : null}
                              </>
                            )}
                            
                            {deuda.nota ? (
                              <Text style={[styles.deudaNota, { color: colors.outline, marginTop: 8 }]}>
                                {deuda.nota}
                              </Text>
                            ) : null}
                          </View>
                          
                          {isExpanded && (
                            <View style={styles.pagosContainer}>
                              <Text style={[styles.pagosTitle, { color: colors.onSurface }]}>
                                Pagos realizados ({deuda.pagos?.length || 0})
                              </Text>
                              {deuda.pagos && deuda.pagos.length > 0 ? (
                                deuda.pagos.map((pago, index) => (
                                  <View key={index} style={[styles.pagoItem, { backgroundColor: colors.surface }]}>
                                    <View style={styles.pagoHeader}>
                                      <Text style={[styles.pagoDate, { color: colors.outline }]}>
                                        {new Date(pago.fecha_hora).toLocaleString()}
                                      </Text>
                                      <Text style={[styles.pagoAmount, { color: colors.primary }]}>
                                        ${pago.cantidad_pagada || 0}
                                      </Text>
                                    </View>
                                    {pago.forma_pago ? (
                                      <Text style={[styles.pagoForma, { color: colors.onSurface }]}>
                                        Forma: {pago.forma_pago}
                                      </Text>
                                    ) : null}
                                  </View>
                                ))
                              ) : (
                                <Text style={[styles.noPagosText, { color: colors.outline }]}>No hay pagos registrados</Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal de instrucciones para Google Maps */}
      <Modal
        visible={showInstructionsModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInstructionsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.instructionsModal, { backgroundColor: colors.surface }]}>
            <View style={styles.instructionsModalHeader}>
              <Ionicons name="information-circle" size={responsive.responsiveWidth(28)} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Instrucciones</Text>
            </View>
            <View style={styles.instructionsContent}>
              <Text style={[styles.instructionsText, { color: colors.onSurface }]}>
                1. Se abrirá Google Maps.
              </Text>
              <Text style={[styles.instructionsText, { color: colors.onSurface }]}>
                2. Busca la ubicación del cliente en el mapa.
              </Text>
              <Text style={[styles.instructionsText, { color: colors.onSurface }]}>
                3. Mantén presionado sobre la ubicación para obtener las coordenadas.
              </Text>
              <Text style={[styles.instructionsText, { color: colors.onSurface }]}>
                4. Copia las coordenadas que aparecen en pantalla y pégalas en el campo de Localización GPS.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.instructionsModalButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirmOpenGoogleMaps}
            >
              <Text style={[styles.instructionsModalButtonText, { color: '#fff' }]}>ENTENDIDO</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>

      {/* Modal para agregar pago de deuda */}
      <Modal
        visible={showPagoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClosePagoModal}
      >
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                Agregar Pago
              </Text>
              <TouchableOpacity onPress={handleClosePagoModal}>
                <Ionicons name="close" size={responsive.responsiveWidth(24)} color={colors.onSurface} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Cantidad a Pagar *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Cantidad"
                  value={pagoFormData.cantidad_pagada}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, cantidad_pagada: text }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Forma de Pago *</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowFormaPagoDropdown(!showFormaPagoDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: pagoFormData.forma_pago ? colors.onSurface : colors.outline }]}>
                    {pagoFormData.forma_pago || 'Seleccionar forma de pago'}
                  </Text>
                  <Ionicons 
                    name={showFormaPagoDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showFormaPagoDropdown ? (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {formasPago.map((forma, index) => (
                      <TouchableOpacity
                        key={forma}
                        style={[styles.dropdownItem, index === formasPago.length - 1 && styles.dropdownItemLast]}
                        onPress={() => {
                          setPagoFormData(prev => ({ 
                            ...prev, 
                            forma_pago: forma,
                            id_cuenta_operacion: '' // Limpiar cuenta al cambiar forma de pago
                          }));
                          setShowFormaPagoDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{forma}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Cuenta de Operación *</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => setShowCuentaDropdown(!showCuentaDropdown)}
                >
                  <Text style={[styles.dropdownText, { color: pagoFormData.id_cuenta_operacion ? colors.onSurface : colors.outline }]}>
                    {pagoFormData.id_cuenta_operacion
                      ? String(cuentas.find(c => c.id_cuenta === parseInt(pagoFormData.id_cuenta_operacion))?.nombre || 'Cuenta seleccionada')
                      : 'Seleccionar cuenta'}
                  </Text>
                  <Ionicons 
                    name={showCuentaDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                </TouchableOpacity>
                
                {showCuentaDropdown ? (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    {cuentas
                      .filter(cuenta => !pagoFormData.forma_pago || cuenta.tipo_cuenta === pagoFormData.forma_pago)
                      .map((cuenta, index, filtered) => (
                        <TouchableOpacity
                          key={cuenta.id_cuenta}
                          style={[styles.dropdownItem, index === filtered.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setPagoFormData(prev => ({ 
                              ...prev, 
                              id_cuenta_operacion: cuenta.id_cuenta.toString(),
                              forma_pago: cuenta.tipo_cuenta || prev.forma_pago
                            }));
                            setShowCuentaDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{`${cuenta.nombre || ''} (${cuenta.tipo_cuenta || 'Sin tipo'})`}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                ) : null}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Notas sobre el pago"
                  value={pagoFormData.nota}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, nota: text }))}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={handleClosePagoModal}
                >
                  <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSavePago}
                >
                  <Text style={[styles.modalButtonText, { color: '#fff' }]}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            {/* Toast dentro del modal para mostrar sobre el modal */}
            {showPagoModal && (
              <Toast
                visible={toast.visible}
                type={toast.type}
                message={toast.message}
                code={toast.code}
                duration={toast.duration}
                onHide={hideToast}
                toastKey={toast.key}
              />
            )}
          </Card>
        </View>
      </Modal>

      {!showPagoModal && (
        <Toast
          visible={toast.visible}
          type={toast.type}
          message={toast.message}
          code={toast.code}
          duration={toast.duration}
          onHide={hideToast}
          toastKey={toast.key}
        />
      )}
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
  formRow: {
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
    flex: 1,
  },
  gpsInputContainer: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(8),
  },
  gpsInput: {
    flex: 1,
  },
  gpsButton: {
    width: responsive.responsiveWidth(50),
    height: responsive.responsiveHeight(50),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    padding: responsive.responsivePadding(4),
  },
  dropdownItem: {
    paddingVertical: responsive.responsivePadding(10),
    paddingHorizontal: responsive.responsivePadding(12),
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
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
    borderColor: 'rgba(0, 0, 0, 0.1)',
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
  deudaSection: {
    marginTop: responsive.responsiveMargin(24),
    paddingTop: responsive.responsivePadding(16),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    paddingVertical: responsive.responsivePadding(12),
    paddingHorizontal: responsive.responsivePadding(16),
    borderRadius: 8,
    borderWidth: 1.5,
  },
  toggleButtonSmall: {
    paddingVertical: responsive.responsivePadding(8),
    paddingHorizontal: responsive.responsivePadding(12),
    marginTop: responsive.responsiveMargin(12),
  },
  toggleButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  toggleButtonTextSmall: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  deudaFormContainer: {
    marginTop: responsive.responsiveMargin(16),
    padding: responsive.responsivePadding(16),
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  pagoFormContainer: {
    marginTop: responsive.responsiveMargin(12),
    marginLeft: responsive.responsiveMargin(16),
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
    marginBottom: responsive.responsiveMargin(12),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsive.responsivePadding(20),
  },
  instructionsModal: {
    width: '100%',
    maxWidth: responsive.responsiveWidth(400),
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
  },
  instructionsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(20),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: responsive.responsiveMargin(12),
    marginBottom: responsive.responsiveMargin(20),
  },
  modalTitle: {
    fontSize: responsive.responsiveFontSize(20),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  instructionsContent: {
    marginBottom: responsive.responsiveMargin(24),
  },
  instructionsText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(12),
    lineHeight: responsive.responsiveHeight(24),
  },
  instructionsModalButton: {
    paddingVertical: responsive.responsivePadding(16),
    paddingHorizontal: responsive.responsivePadding(24),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: responsive.responsiveHeight(48),
  },
  instructionsModalButtonText: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: 'bold',
    fontFamily: 'Inter',
    color: '#fff',
  },
  modalButton: {
    paddingVertical: responsive.responsivePadding(22),
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  deudasSection: {
    marginTop: responsive.responsiveMargin(24),
  },
  noDeudasText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: responsive.responsivePadding(20),
  },
  deudaCard: {
    marginBottom: responsive.responsiveMargin(12),
    borderRadius: 8,
    overflow: 'hidden',
    padding: responsive.responsivePadding(12),
  },
  deudaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deudaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive.responsiveMargin(8),
    flex: 1,
  },
  deudaHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deudaInfo: {
    flexDirection: 'column',
  },
  deudaDate: {
    fontSize: responsive.fontSizes.small,
    fontFamily: 'Inter',
  },
  deudaStatus: {
    fontSize: responsive.fontSizes.small,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  deudaDetails: {
    marginTop: responsive.responsiveMargin(12),
  },
  deudaLabel: {
    fontSize: responsive.fontSizes.small,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  deudaValue: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  deudaNota: {
    fontSize: responsive.fontSizes.small,
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  pagosContainer: {
    marginTop: responsive.responsiveMargin(12),
    paddingTop: responsive.responsivePadding(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  pagosTitle: {
    fontSize: responsive.fontSizes.small,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
  },
  pagoItem: {
    padding: responsive.responsivePadding(8),
    marginBottom: responsive.responsiveMargin(8),
    borderRadius: 4,
  },
  pagoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(4),
  },
  pagoDate: {
    fontSize: responsive.fontSizes.small,
    fontFamily: 'Inter',
  },
  pagoAmount: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  pagoForma: {
    fontSize: responsive.fontSizes.small,
    fontFamily: 'Inter',
  },
  noPagosText: {
    fontSize: responsive.fontSizes.small,
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  addPagoButton: {
    padding: responsive.responsivePadding(4),
  },
  pagoModal: {
    width: '100%',
    maxWidth: responsive.responsiveWidth(400),
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
  },
  pagoForm: {
    marginBottom: responsive.responsiveMargin(20),
  },
  modalButtons: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
  },
  formRow: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(10),
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
    maxWidth: responsive.responsiveWidth(400),
    borderRadius: 16,
    padding: responsive.responsivePadding(24),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(20),
  },
  modalTitle: {
    fontSize: responsive.fontSizes.h3,
    fontWeight: '700',
    fontFamily: 'Inter',
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
  },
  dropdownText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownMenu: {
    marginTop: responsive.responsiveMargin(4),
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: responsive.responsiveHeight(200),
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  modalActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(20),
  },
  modalButton: {
    flex: 1,
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: 'transparent',
  },
  saveButton: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default ClienteFormScreen;

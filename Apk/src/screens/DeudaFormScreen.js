import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useResponsive } from '../hooks/useResponsive';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { useToast } from '../hooks/useToast';
import { Header } from '../components/layout/Header';
import { Card } from '../components/common/Card';
import { Toast } from '../components/common/Toast';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createDeuda, saldarDeuda, updateDeuda, getDeudaById } from '../services/deudaService';
import { getClientes } from '../services/clienteService';
import { getCuentas } from '../services/cuentaService';
import configService from '../services/configService';

const DeudaFormScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { toast, showToast, hideToast } = useToast();
  const { isOfflineMode } = useOffline();
  const { user } = useAuth();

  const { deuda, mode, cliente } = route.params || { mode: 'add' };

  const isAddMode = mode === 'add';
  const isEditMode = mode === 'edit';
  const isPagoMode = mode === 'pago';

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  const [formData, setFormData] = useState({
    id_cliente: cliente?.id_cliente || '',
    monto_cup: '',
    monto_usd: '',
    nota: '',
    fecha_hora: new Date(),
    cambio_moneda: '1',
  });

  const [pagoFormData, setPagoFormData] = useState({
    cantidad_pagada: '',
    forma_pago: '',
    cambio_moneda: '1',
    id_cuenta_operacion: '',
    fecha: new Date(),
    hora: new Date(),
    nota: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [showFormaPagoDropdown, setShowFormaPagoDropdown] = useState(false);
  const [showCuentaDropdown, setShowCuentaDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPago, setEditingPago] = useState(null);
  const [pagosList, setPagosList] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [clienteSearchText, setClienteSearchText] = useState('');

  // Formas de pago disponibles
  const formasPago = ['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'];

  useEffect(() => {
    const fetchClientes = async () => {
      if ((isAddMode || isEditMode) && !isOfflineMode) {
        try {
          const data = await getClientes({}, 1, 1000);
          setClientes(data.data || []);
        } catch (error) {
          console.error('Error al cargar clientes:', error);
          setClientes([]);
        }
      }
    };

    const fetchCuentas = async () => {
      if (!isOfflineMode) {
        try {
          const cuentasData = await getCuentas({}, 1, 1000);
          let allCuentas = cuentasData.data || [];
          
          // Filtrar cuentas por tienda del usuario si tiene permisos de gestión
          if (user?.id_tienda) {
            try {
              const config = await configService.getConfig();
              const tiendaCuentasConfig = config.tiendaCuentasConfig || {};
              const tiendaConfig = tiendaCuentasConfig[user.id_tienda];
              
              if (tiendaConfig) {
                // Obtener todas las cuentas permitidas para esta tienda
                const cuentasPermitidas = [
                  ...(tiendaConfig.efectivo_cup || []),
                  ...(tiendaConfig.efectivo_usd || []),
                  ...(tiendaConfig.transferencia_cup || []),
                  ...(tiendaConfig.transferencia_usd || []),
                ];
                
                // Filtrar cuentas para mostrar solo las permitidas
                const cuentaIdsPermitidos = new Set(cuentasPermitidas.map(c => c.id_cuenta));
                allCuentas = allCuentas.filter(cuenta => cuentaIdsPermitidos.has(cuenta.id_cuenta));
              }
            } catch (error) {
              console.error('Error al cargar configuración de cuentas por tienda:', error);
              // Si falla, mostrar todas las cuentas (no filtrar)
            }
          }
          
          console.log('[DeudaForm] Cuentas cargadas:', allCuentas.length);
          setCuentas(allCuentas);
        } catch (error) {
          console.error('Error al cargar cuentas:', error);
          setCuentas([]);
        }
      }
    };

    fetchClientes();
    fetchCuentas();
  }, [isAddMode, isEditMode, isOfflineMode, user?.id_tienda]);

  const fetchDeudaPagos = async (deudaId) => {
    try {
      const deudaData = await getDeudaById(deudaId);
      console.log('[DeudaForm] Fetched deuda with pagos:', deudaData);
      setPagosList(deudaData.pagos || []);
    } catch (error) {
      console.error('[DeudaForm] Error fetching deuda pagos:', error);
    }
  };

  useEffect(() => {
    if (isEditMode && deuda) {
      console.log('[DeudaForm] Loading deuda in edit mode:', deuda);
      console.log('[DeudaForm] Deuda id_lista_venta:', deuda.id_lista_venta);
      console.log('[DeudaForm] Deuda pagos:', deuda.pagos);
      setFormData({
        id_cliente: deuda.id_cliente?.toString() || '',
        monto_cup: deuda.monto_cup?.toString() || '',
        monto_usd: deuda.monto_usd?.toString() || '',
        nota: deuda.nota || '',
        fecha_hora: deuda.fecha_hora ? new Date(deuda.fecha_hora) : new Date(),
        cambio_moneda: deuda.cambio_moneda?.toString() || '1',
      });
      
      // If pagos are not loaded, fetch them
      if (!deuda.pagos || deuda.pagos.length === 0) {
        console.log('[DeudaForm] Pagos not loaded, fetching them...');
        fetchDeudaPagos(deuda.id_deuda);
      } else {
        setPagosList(deuda.pagos || []);
      }
    }
  }, [isEditMode, deuda]);

  const handleDeletePago = (pagoId) => {
    Alert.alert(
      'Eliminar Pago',
      '¿Estás seguro de que quieres eliminar este pago?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setPagosList(prev => prev.filter(p => p.id_pago_deuda !== pagoId));
            showToast({ type: 'success', message: 'Pago eliminado (guarda los cambios para aplicar)' });
          },
        },
      ]
    );
  };

  const handleEditPago = (pago) => {
    setEditingPago(pago);
    setPagoFormData({
      cantidad_pagada: pago.cantidad_pagada?.toString() || '',
      forma_pago: pago.forma_pago || '',
      cambio_moneda: pago.cambio_moneda?.toString() || '1',
      id_cuenta_operacion: pago.id_cuenta_operacion?.toString() || '',
      fecha: pago.fecha_hora ? new Date(pago.fecha_hora) : new Date(),
      hora: pago.fecha_hora ? new Date(pago.fecha_hora) : new Date(),
      nota: pago.nota || '',
    });
    setShowPagoModal(true);
  };

  const handleSavePagoEdit = () => {
    // Validaciones
    if (!pagoFormData.cantidad_pagada || pagoFormData.cantidad_pagada.trim() === '') {
      showToast({ type: 'warning', message: 'La cantidad es obligatoria' });
      return;
    }
    if (isNaN(pagoFormData.cantidad_pagada) || parseFloat(pagoFormData.cantidad_pagada) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor que cero' });
      return;
    }
    if (!pagoFormData.forma_pago || pagoFormData.forma_pago.trim() === '') {
      showToast({ type: 'warning', message: 'La forma de pago es obligatoria' });
      return;
    }
    if (!['Efectivo CUP', 'Transferencia CUP', 'Efectivo USD', 'Transferencia USD'].includes(pagoFormData.forma_pago)) {
      showToast({ type: 'warning', message: 'Forma de pago inválida' });
      return;
    }
    if (!pagoFormData.id_cuenta_operacion || pagoFormData.id_cuenta_operacion.trim() === '') {
      showToast({ type: 'warning', message: 'Debe seleccionar una cuenta de operación' });
      return;
    }

    try {
      const updatedPagos = pagosList.map(pago => {
        if (pago.id_pago_deuda === editingPago.id_pago_deuda) {
          return {
            ...pago,
            cantidad_pagada: parseFloat(pagoFormData.cantidad_pagada),
            forma_pago: pagoFormData.forma_pago,
            cambio_moneda: parseFloat(pagoFormData.cambio_moneda) || 1,
            id_cuenta_operacion: parseInt(pagoFormData.id_cuenta_operacion),
            fecha_hora: pagoFormData.fecha,
            nota: pagoFormData.nota || pago.nota,
          };
        }
        return pago;
      });

      setPagosList(updatedPagos);
      setEditingPago(null);
      setShowPagoModal(false);
      showToast({ type: 'success', message: 'Pago actualizado (guarda los cambios para aplicar)' });
    } catch (err) {
      setShowPagoModal(false);
      showToast({ type: 'error', message: err.message || 'Error al actualizar pago' });
    }
  };

  const handleAddPago = async () => {
    try {
      if (!isOfflineMode && deuda?.id_deuda) {
        // Usar fecha y hora actual del dispositivo
        const fechaHora = new Date();

        const pago = {
          cantidad_pagada: parseFloat(pagoFormData.cantidad_pagada),
          forma_pago: pagoFormData.forma_pago,
          cambio_moneda: 1,
          id_cuenta_operacion: parseInt(pagoFormData.id_cuenta_operacion),
          fecha_hora: fechaHora,
          nota: pagoFormData.nota || null
        };

        await saldarDeuda(deuda.id_deuda, [pago]);
        showToast({ type: 'success', message: 'Pago registrado correctamente' });
        // Recargar pagos
        fetchDeudaPagos(deuda.id_deuda);
      } else {
        // En modo offline o sin deuda, agregar temporalmente a la lista
        const nuevoPago = {
          id_pago_deuda: Date.now(), // ID temporal
          cantidad_pagada: parseFloat(pagoFormData.cantidad_pagada),
          forma_pago: pagoFormData.forma_pago,
          cambio_moneda: 1,
          id_cuenta_operacion: parseInt(pagoFormData.id_cuenta_operacion),
          fecha_hora: new Date(),
          nota: pagoFormData.nota || null,
          temp: true // Marcador para pagos temporales
        };
        setPagosList(prev => [...prev, nuevoPago]);
        showToast({ type: 'success', message: 'Pago agregado temporalmente (guarda los cambios para aplicar)' });
      }
      setShowPagoModal(false);
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Error al agregar pago' });
    }
  };

  const handleSave = async () => {
    if (!formData.monto_cup && !formData.monto_usd) {
      showToast({ type: 'warning', message: 'Debe ingresar al menos un monto (CUP o USD)' });
      return;
    }
    if (formData.monto_cup && (isNaN(formData.monto_cup) || parseFloat(formData.monto_cup) < 0)) {
      showToast({ type: 'warning', message: 'El monto CUP debe ser un número no negativo' });
      return;
    }
    if (formData.monto_usd && (isNaN(formData.monto_usd) || parseFloat(formData.monto_usd) < 0)) {
      showToast({ type: 'warning', message: 'El monto USD debe ser un número no negativo' });
      return;
    }
    if (!cliente && !formData.id_cliente) {
      showToast({ type: 'warning', message: 'Debe seleccionar un cliente para la deuda' });
      return;
    }

    try {
      setIsSaving(true);
      const deudaData = {
        monto_cup: formData.monto_cup ? parseFloat(formData.monto_cup) : 0,
        monto_usd: formData.monto_usd ? parseFloat(formData.monto_usd) : 0,
        cambio_moneda: parseFloat(formData.cambio_moneda) || 1,
        id_cliente: cliente ? cliente.id_cliente : formData.id_cliente,
        fecha_hora: formData.fecha_hora,
        nota: formData.nota || null,
      };

      if (isEditMode) {
        await updateDeuda(deuda.id_deuda, deudaData);
        showToast({ type: 'success', message: 'Deuda actualizada correctamente' });
      } else {
        await createDeuda(deudaData);
        showToast({ type: 'success', message: 'Deuda creada correctamente' });
      }
      navigation.goBack();
    } catch (err) {
      showToast({ type: 'error', message: err.message, code: err.code });
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(responsive);

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header 
          title={isPagoMode ? 'Agregar Pago' : isEditMode ? 'Editar Deuda' : isAddMode ? 'Nueva Deuda' : 'Ver Deuda'}
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
        />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {cliente && (
          <Card style={[styles.clienteInfoCard, { backgroundColor: colors.surface }]}>
            <View style={styles.clienteInfoHeader}>
              <Text style={[styles.clienteInfoTitle, { color: colors.onSurface }]}>Cliente</Text>
              {isEditMode && deuda?.id_lista_venta && (
                <TouchableOpacity
                  style={[styles.navigateButton, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('VentaEdit', { venta: { id_lista_venta: deuda.id_lista_venta } })}
                >
                  <Ionicons name="arrow-forward" size={responsive.responsiveWidth(16)} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.clienteInfoName, { color: colors.primary }]}>
              {cliente.nombre}
            </Text>
            {cliente.telefono && (
              <Text style={[styles.clienteInfoText, { color: colors.outline }]}>
                Tel: {cliente.telefono}
              </Text>
            )}
          </Card>
        )}

        <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
          {isPagoMode ? (
            <>
              {/* Formulario para Pago de Deuda */}
              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Cantidad a Pagar *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="0.00"
                  value={pagoFormData.cantidad_pagada}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, cantidad_pagada: text }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Forma de Pago *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Ej: Efectivo CUP, Transferencia CUP"
                  value={pagoFormData.forma_pago}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, forma_pago: text }))}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Cuenta de Operación *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="ID de cuenta"
                  value={pagoFormData.id_cuenta_operacion}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, id_cuenta_operacion: text }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Cambio de Moneda</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="1.0"
                  value={pagoFormData.cambio_moneda}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, cambio_moneda: text }))}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Nota sobre el pago"
                  value={pagoFormData.nota}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, nota: text }))}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </>
          ) : (
            <>
              {/* Formulario para Deuda */}
              {!cliente && (
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Cliente</Text>
                  <View style={styles.inputWithButton}>
                    <TouchableOpacity
                      style={[styles.input, styles.inputWithButtonInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}
                      onPress={() => setShowClienteDropdown(!showClienteDropdown)}
                    >
                      <Text style={{ color: formData.id_cliente ? colors.onSurface : colors.outline, flex: 1 }}>
                        {formData.id_cliente ? (Array.isArray(clientes) ? clientes.find(c => c.id_cliente === parseInt(formData.id_cliente))?.nombre || 'Cliente seleccionado' : 'Cliente seleccionado') : 'Seleccionar cliente'}
                      </Text>
                      <Ionicons 
                        name={showClienteDropdown ? "chevron-up" : "chevron-down"} 
                        size={responsive.responsiveWidth(20)} 
                        color={colors.outline} 
                      />
                    </TouchableOpacity>
                    {!isEditMode && (
                      <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.primary }]}
                        onPress={() => {
                          navigation.navigate('ClienteForm', { mode: 'add', returnTo: 'DeudaForm' });
                        }}
                      >
                        <Ionicons name="add" size={responsive.responsiveWidth(20)} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {showClienteDropdown && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      <View style={[styles.searchInputContainer, { backgroundColor: colors.background }]}>
                        <Ionicons name="search" size={responsive.responsiveWidth(18)} color={colors.outline} />
                        <TextInput
                          style={[styles.searchInput, { color: colors.onSurface }]}
                          placeholder="Buscar cliente..."
                          placeholderTextColor={colors.outline}
                          value={clienteSearchText}
                          onChangeText={setClienteSearchText}
                        />
                      </View>
                      {Array.isArray(clientes) && clientes
                        .filter(cliente => cliente.nombre.toLowerCase().includes(clienteSearchText.toLowerCase()))
                        .map((clienteItem, index, filtered) => (
                        <TouchableOpacity
                          key={clienteItem.id_cliente}
                          style={[styles.dropdownItem, { borderBottomColor: colors.outlineVariant }, index === filtered.length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, id_cliente: clienteItem.id_cliente }));
                            setShowClienteDropdown(false);
                            setClienteSearchText('');
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{clienteItem.nombre}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Monto CUP</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Monto en CUP"
                    value={formData.monto_cup}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, monto_cup: text }))}
                    keyboardType="numeric"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: responsive.responsiveMargin(8) }]}>
                  <Text style={[styles.label, { color: colors.outline }]}>Monto USD</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Monto en USD"
                    value={formData.monto_usd}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, monto_usd: text }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="Notas sobre la deuda"
                  value={formData.nota}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, nota: text }))}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </>
          )}

          {/* Pagos Realizados (Solo en modo edición) */}
          {isEditMode && (
            <Card style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Pagos Realizados ({pagosList.length})</Text>
                {/* Solo mostrar botón de agregar si la deuda no está saldada */}
                {!(deuda?.monto_restante_cup === 0 && deuda?.monto_restante_usd === 0) && (
                  <TouchableOpacity
                    style={[styles.addPagoButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      setEditingPago(null);
                      setPagoFormData({
                        cantidad_pagada: '',
                        forma_pago: '',
                        cambio_moneda: '1',
                        id_cuenta_operacion: '',
                        nota: '',
                      });
                      setShowPagoModal(true);
                    }}
                  >
                    <Ionicons name="add" size={responsive.responsiveWidth(20)} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              {pagosList.length > 0 ? pagosList.map((pago) => (
                <View key={pago.id_pago_deuda} style={[styles.pagoItem, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                  <View style={styles.pagoHeader}>
                    <Text style={[styles.pagoFecha, { color: colors.outline }]}>
                      {new Date(pago.fecha_hora).toLocaleString()}
                    </Text>
                    <Text style={[styles.pagoCantidad, { color: colors.primary }]}>
                      ${pago.cantidad_pagada}
                    </Text>
                  </View>
                  <View style={styles.pagoDetails}>
                    <Text style={[styles.pagoForma, { color: colors.onSurface }]}>
                      Forma: {pago.forma_pago || 'No especificada'}
                    </Text>
                    {(pago.nota || pago.operacion?.motivo) && (
                      <Text style={[styles.pagoNota, { color: colors.outline }]}>
                        {pago.nota || pago.operacion?.motivo}
                      </Text>
                    )}
                  </View>
                  <View style={styles.pagoActions}>
                    <TouchableOpacity
                      style={[styles.pagoActionButton, styles.pagoEditButton, { backgroundColor: isDarkMode ? colors.primaryContainer : '#E3F2FD' }]}
                      onPress={() => handleEditPago(pago)}
                    >
                      <Ionicons name="create-outline" size={responsive.responsiveWidth(16)} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pagoActionButton, styles.pagoDeleteButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]}
                      onPress={() => handleDeletePago(pago.id_pago_deuda)}
                    >
                      <Ionicons name="trash-outline" size={responsive.responsiveWidth(16)} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              )) : (
                <Text style={[styles.emptyText, { color: colors.outline }]}>No hay pagos realizados</Text>
              )}
            </Card>
          )}

          {/* Action Buttons */}
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
                  {isPagoMode ? 'Guardar Pago' : 'Guardar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>

      {/* Modal para editar pago */}
      <Modal
        visible={showPagoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowPagoModal(false);
          setEditingPago(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
                {editingPago ? 'Editar Pago' : 'Agregar Pago'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowPagoModal(false);
                setEditingPago(null);
              }}>
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
                          setPagoFormData(prev => ({ ...prev, forma_pago: forma }));
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
                    {pagoFormData.id_cuenta_operacion ? cuentas.find(c => c.id_cuenta === parseInt(pagoFormData.id_cuenta_operacion))?.nombre || 'Cuenta seleccionada' : 'Seleccionar cuenta'}
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
                  placeholder="Nota sobre el pago"
                  value={pagoFormData.nota}
                  onChangeText={(text) => setPagoFormData(prev => ({ ...prev, nota: text }))}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                onPress={() => {
                  setShowPagoModal(false);
                  setEditingPago(null);
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.onSurface }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton, { backgroundColor: colors.primary }]}
                onPress={editingPago ? handleSavePagoEdit : handleAddPago}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>
                  {editingPago ? 'Guardar' : 'Agregar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  scrollContent: {
    padding: responsive.responsivePadding(16),
    paddingTop: responsive.responsivePadding(75),
  },
  clienteInfoCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  clienteInfoTitle: {
    fontSize: responsive.fontSizes.bodySmall,
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  clienteInfoName: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  clienteInfoText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
    marginTop: responsive.responsiveMargin(4),
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
  textArea: {
    height: responsive.responsiveHeight(100),
    textAlignVertical: 'top',
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
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: responsive.responsiveHeight(150),
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWithButtonInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addButton: {
    marginLeft: responsive.responsiveMargin(8),
    width: responsive.responsiveWidth(48),
    height: responsive.responsiveHeight(48),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: responsive.responsiveMargin(4),
    maxHeight: responsive.responsiveHeight(200),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsive.responsivePadding(12),
    paddingVertical: responsive.responsivePadding(8),
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    marginLeft: responsive.responsiveMargin(8),
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  dropdownItem: {
    padding: responsive.responsivePadding(12),
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: responsive.fontSizes.body,
    fontFamily: 'Inter',
  },
  cardTitle: {
    fontSize: responsive.fontSizes.bodyLarge,
    fontWeight: '600',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(12),
  },
  pagoItem: {
    padding: responsive.responsivePadding(12),
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: responsive.responsiveMargin(8),
  },
  pagoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  pagoFecha: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
  },
  pagoCantidad: {
    fontSize: responsive.fontSizes.body,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  pagoDetails: {
    marginTop: responsive.responsiveMargin(4),
  },
  pagoForma: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(4),
  },
  pagoNota: {
    fontSize: responsive.fontSizes.bodySmall,
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  pagoActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: responsive.responsiveMargin(8),
    gap: responsive.responsiveMargin(8),
  },
  pagoActionButton: {
    width: responsive.responsiveWidth(32),
    height: responsive.responsiveHeight(32),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagoEditButton: {
    marginRight: responsive.responsiveMargin(4),
  },
  pagoDeleteButton: {
    marginRight: responsive.responsiveMargin(4),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPagoButton: {
    width: responsive.responsiveWidth(28),
    height: responsive.responsiveHeight(28),
    borderRadius: responsive.responsiveWidth(14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: responsive.fontSizes.body,
    textAlign: 'center',
    paddingVertical: responsive.responsivePadding(16),
    fontFamily: 'Inter',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: responsive.responsivePadding(20),
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(16),
  },
  clienteInfoCard: {
    marginBottom: responsive.responsiveMargin(16),
  },
  clienteInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(8),
  },
  navigateButton: {
    padding: responsive.responsivePadding(8),
    borderRadius: responsive.responsiveWidth(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  clienteInfoTitle: {
    fontSize: responsive.fontSizes.h3,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalTitle: {
    fontSize: responsive.fontSizes.bodyLarge,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  modalActions: {
    flexDirection: 'row',
    gap: responsive.responsiveMargin(12),
    marginTop: responsive.responsiveMargin(16),
  },
  modalButton: {
    flex: 1,
    paddingVertical: responsive.responsivePadding(12),
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalSaveButton: {
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
});

export default DeudaFormScreen;

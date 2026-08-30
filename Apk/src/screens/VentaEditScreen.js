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
import { getVentaById, updateVenta } from '../services/ventaService';
import { getTiendas } from '../services/tiendaService';
import { getUsuarios } from '../services/usuarioService';
import { getServicios } from '../services/servicioService';
import { getCuentas } from '../services/cuentaService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import DateTimePicker from '@react-native-community/datetimepicker';

const VentaEditContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { token, user } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { venta, mode } = route.params || {};

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit' || !mode;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingVenta, setIsFetchingVenta] = useState(false);
  
  const [tiendas, setTiendas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  
  const [showTiendaDropdown, setShowTiendaDropdown] = useState(false);
  const [showUsuarioDropdown, setShowUsuarioDropdown] = useState(false);
  const [showServicioDropdown, setShowServicioDropdown] = useState(false);
  const [showCuentaEfectivoCupDropdown, setShowCuentaEfectivoCupDropdown] = useState(false);
  const [showCuentaEfectivoUsdDropdown, setShowCuentaEfectivoUsdDropdown] = useState(false);
  const [showCuentaTransferenciaCupDropdown, setShowCuentaTransferenciaCupDropdown] = useState(false);
  const [showCuentaTransferenciaUsdDropdown, setShowCuentaTransferenciaUsdDropdown] = useState(false);
  
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  
  const [formData, setFormData] = useState({
    fecha_hora: new Date().toISOString(),
    nota: '',
    cantidad_cobrada_efectivo_cup: '',
    cantidad_cobrada_efectivo_usd: '',
    cantidad_cobrada_transferencia_cup: '',
    cantidad_cobrada_transferencia_usd: '',
    id_cuenta_efectivo_cup: null,
    id_cuenta_efectivo_usd: null,
    id_cuenta_transferencia_cup: null,
    id_cuenta_transferencia_usd: null,
    id_usuario: user?.id_usuario || null,
    cambio_moneda: '',
    ventas: [],
  });

  const [ventaItems, setVentaItems] = useState([]);
  const [servicioSearchText, setServicioSearchText] = useState('');
  const [servicioSearchResults, setServicioSearchResults] = useState([]);
  const [isSearchingServicios, setIsSearchingServicios] = useState(false);

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isReadOnly = isViewMode || isOfflineMode;

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (venta?.id_lista_venta) {
      fetchVentaData();
    }
  }, [venta?.id_lista_venta]);

  const fetchInitialData = async () => {
    try {
      const [tiendasData, usuariosData, serviciosData, cuentasData] = await Promise.all([
        getTiendas({}, 1, 1000),
        getUsuarios({ activo: true }, 1, 1000),
        getServicios({}, 1, 1000),
        getCuentas({ activo: true }, 1, 1000),
      ]);
      
      setTiendas(tiendasData.data || []);
      setUsuarios(usuariosData.data || []);
      setServicios(serviciosData.data || []);
      setCuentas(cuentasData.data || []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      showToast({ type: 'error', message: 'Error al cargar datos iniciales' });
    }
  };

  const fetchVentaData = async () => {
    try {
      setIsFetchingVenta(true);
      const ventaData = await getVentaById(venta.id_lista_venta);
      
      setFormData({
        fecha_hora: ventaData.fecha_hora,
        nota: ventaData.nota || '',
        cantidad_cobrada_efectivo_cup: ventaData.cantidad_cobrada_efectivo_cup?.toString() || '',
        cantidad_cobrada_efectivo_usd: ventaData.cantidad_cobrada_efectivo_usd?.toString() || '',
        cantidad_cobrada_transferencia_cup: ventaData.cantidad_cobrada_transferencia_cup?.toString() || '',
        cantidad_cobrada_transferencia_usd: ventaData.cantidad_cobrada_transferencia_usd?.toString() || '',
        id_cuenta_efectivo_cup: ventaData.operaciones?.find(op => op.cuenta?.tipo_cuenta === 'Efectivo CUP')?.id_cuenta || null,
        id_cuenta_efectivo_usd: ventaData.operaciones?.find(op => op.cuenta?.tipo_cuenta === 'Efectivo USD')?.id_cuenta || null,
        id_cuenta_transferencia_cup: ventaData.operaciones?.find(op => op.cuenta?.tipo_cuenta === 'Transferencia CUP')?.id_cuenta || null,
        id_cuenta_transferencia_usd: ventaData.operaciones?.find(op => op.cuenta?.tipo_cuenta === 'Transferencia USD')?.id_cuenta || null,
        id_usuario: ventaData.operaciones?.[0]?.id_usuario || user?.id_usuario,
        cambio_moneda: ventaData.operaciones?.[0]?.cambio_moneda?.toString() || '',
      });

      const ventaItemsData = ventaData.ventas?.map(v => ({
        id: v.id_venta,
        id_servicio_tienda: v.id_servicio_tienda,
        servicio: v.servicioTienda?.servicio,
        cantidad: v.cantidad?.toString() || '',
        precio_cobrado_cup: v.precio_cobrado_cup?.toString() || '',
        precio_cobrado_usd: v.precio_cobrado_usd?.toString() || '',
      })) || [];

      setVentaItems(ventaItemsData);
    } catch (error) {
      console.error('Error fetching venta data:', error);
      showToast({ type: 'error', message: 'Error al cargar datos de la venta' });
    } finally {
      setIsFetchingVenta(false);
    }
  };

  const searchServicios = async (searchTerm) => {
    try {
      if (isOfflineMode || !searchTerm || searchTerm.length < 2) {
        setServicioSearchResults([]);
        return;
      }
      setIsSearchingServicios(true);
      const data = await getServicios({ nombre: searchTerm }, 1, 20);
      setServicioSearchResults(data.data || []);
    } catch (err) {
      setServicioSearchResults([]);
    } finally {
      setIsSearchingServicios(false);
    }
  };

  const handleAddVentaItem = () => {
    setVentaItems([...ventaItems, {
      id: Date.now(),
      id_servicio_tienda: null,
      servicio: null,
      cantidad: '',
      precio_cobrado_cup: '',
      precio_cobrado_usd: '',
    }]);
  };

  const handleRemoveVentaItem = (id) => {
    setVentaItems(ventaItems.filter(item => item.id !== id));
  };

  const handleUpdateVentaItem = (id, field, value) => {
    setVentaItems(ventaItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleServicioSelect = (itemId, servicio) => {
    handleUpdateVentaItem(itemId, 'servicio', servicio);
    handleUpdateVentaItem(itemId, 'id_servicio_tienda', null);
    setServicioSearchText('');
    setServicioSearchResults([]);
    setShowServicioDropdown(false);
  };

  const handleSave = async () => {
    // Validaciones
    if (!formData.fecha_hora) {
      showToast({ type: 'warning', message: 'La fecha y hora son obligatorias' });
      return;
    }
    
    if (!formData.id_usuario) {
      showToast({ type: 'warning', message: 'El usuario es obligatorio' });
      return;
    }
    
    if (!formData.cambio_moneda || parseFloat(formData.cambio_moneda) <= 0) {
      showToast({ type: 'warning', message: 'El cambio de moneda debe ser mayor que 0' });
      return;
    }

    const montos = [
      parseFloat(formData.cantidad_cobrada_efectivo_cup) || 0,
      parseFloat(formData.cantidad_cobrada_efectivo_usd) || 0,
      parseFloat(formData.cantidad_cobrada_transferencia_cup) || 0,
      parseFloat(formData.cantidad_cobrada_transferencia_usd) || 0,
    ];

    if (montos.some(m => m < 0)) {
      showToast({ type: 'warning', message: 'Los montos cobrados no pueden ser negativos' });
      return;
    }

    // Validar cuentas
    if (montos[0] > 0 && !formData.id_cuenta_efectivo_cup) {
      showToast({ type: 'warning', message: 'Se requiere cuenta para efectivo CUP' });
      return;
    }
    if (montos[1] > 0 && !formData.id_cuenta_efectivo_usd) {
      showToast({ type: 'warning', message: 'Se requiere cuenta para efectivo USD' });
      return;
    }
    if (montos[2] > 0 && !formData.id_cuenta_transferencia_cup) {
      showToast({ type: 'warning', message: 'Se requiere cuenta para transferencia CUP' });
      return;
    }
    if (montos[3] > 0 && !formData.id_cuenta_transferencia_usd) {
      showToast({ type: 'warning', message: 'Se requiere cuenta para transferencia USD' });
      return;
    }

    // Validar items de venta
    if (ventaItems.length === 0) {
      showToast({ type: 'warning', message: 'Debe agregar al menos una venta' });
      return;
    }

    for (let i = 0; i < ventaItems.length; i++) {
      const item = ventaItems[i];
      if (!item.id_servicio_tienda) {
        showToast({ type: 'warning', message: `La venta ${i + 1} requiere un servicio-tienda` });
        return;
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        showToast({ type: 'warning', message: `La cantidad de la venta ${i + 1} debe ser mayor que 0` });
        return;
      }
      if (item.precio_cobrado_cup === '' || parseFloat(item.precio_cobrado_cup) < 0) {
        showToast({ type: 'warning', message: `El precio CUP de la venta ${i + 1} no es válido` });
        return;
      }
      if (item.precio_cobrado_usd === '' || parseFloat(item.precio_cobrado_usd) < 0) {
        showToast({ type: 'warning', message: `El precio USD de la venta ${i + 1} no es válido` });
        return;
      }
    }

    try {
      setIsSaving(true);
      
      const ventaData = {
        fecha_hora: formData.fecha_hora,
        nota: formData.nota || null,
        cantidad_cobrada_efectivo_cup: parseFloat(formData.cantidad_cobrada_efectivo_cup) || 0,
        cantidad_cobrada_efectivo_usd: parseFloat(formData.cantidad_cobrada_efectivo_usd) || 0,
        cantidad_cobrada_transferencia_cup: parseFloat(formData.cantidad_cobrada_transferencia_cup) || 0,
        cantidad_cobrada_transferencia_usd: parseFloat(formData.cantidad_cobrada_transferencia_usd) || 0,
        id_cuenta_efectivo_cup: formData.id_cuenta_efectivo_cup,
        id_cuenta_efectivo_usd: formData.id_cuenta_efectivo_usd,
        id_cuenta_transferencia_cup: formData.id_cuenta_transferencia_cup,
        id_cuenta_transferencia_usd: formData.id_cuenta_transferencia_usd,
        id_usuario: formData.id_usuario,
        cambio_moneda: parseFloat(formData.cambio_moneda),
        ventas: ventaItems.map(item => ({
          id_servicio_tienda: item.id_servicio_tienda,
          cantidad: parseFloat(item.cantidad),
          precio_cobrado_cup: parseFloat(item.precio_cobrado_cup),
          precio_cobrado_usd: parseFloat(item.precio_cobrado_usd),
        })),
      };

      await updateVenta(venta.id_lista_venta, ventaData);
      showToast({ type: 'success', message: 'Venta actualizada correctamente' });
      navigation.goBack();
    } catch (error) {
      console.error('Error updating venta:', error);
      const errorMessage = error.response?.data?.errors?.[0] || error.message || 'Error al actualizar venta';
      showToast({ type: 'error', message: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFechaChange = (event, selectedDate) => {
    if (event.type === 'dismissed') {
      setShowFechaPicker(false);
      return;
    }
    if (selectedDate) {
      setShowFechaPicker(false);
      setFormData(prev => ({ ...prev, fecha_hora: selectedDate.toISOString() }));
    }
  };

  const formatNumber = (num) => {
    if (num === '' || num === null || num === undefined) return '';
    return parseFloat(num).toFixed(2);
  };

  const calculateTotalToReceive = () => {
    return ventaItems.reduce((total, item) => {
      const cantidad = parseFloat(item.cantidad) || 0;
      const precioCup = parseFloat(item.precio_cobrado_cup) || 0;
      return total + (cantidad * precioCup);
    }, 0);
  };

  const calculateTotalReceived = () => {
    const efectivoCup = parseFloat(formData.cantidad_cobrada_efectivo_cup) || 0;
    const efectivoUsd = parseFloat(formData.cantidad_cobrada_efectivo_usd) || 0;
    const transferenciaCup = parseFloat(formData.cantidad_cobrada_transferencia_cup) || 0;
    const transferenciaUsd = parseFloat(formData.cantidad_cobrada_transferencia_usd) || 0;
    const cambio = parseFloat(formData.cambio_moneda) || 1;
    
    return efectivoCup + transferenciaCup + (efectivoUsd * cambio) + (transferenciaUsd * cambio);
  };

  const getRemainingAmount = () => {
    return calculateTotalToReceive() - calculateTotalReceived();
  };

  const styles = createStyles(responsive);

  if (isFetchingVenta) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <Header 
          showBackButton={true}
          onBackPress={() => navigation.goBack()}
          isDark={isDarkMode}
          title={isViewMode ? 'Información de Venta' : 'Editar Venta'}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.outline }]}>
            Cargando datos...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
        title="Editar Venta"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
        keyboardVerticalOffset={20}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
            {/* Fecha */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Fecha *</Text>
              <TouchableOpacity
                style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                onPress={() => !isReadOnly && setShowFechaPicker(true)}
                disabled={isReadOnly}
              >
                <Text style={[styles.inputText, { color: colors.onSurface }]}>
                  {new Date(formData.fecha_hora).toLocaleDateString('es-ES')}
                </Text>
              </TouchableOpacity>
              {showFechaPicker && !isReadOnly && (
                <DateTimePicker
                  value={new Date(formData.fecha_hora)}
                  mode="date"
                  display="default"
                  onChange={handleFechaChange}
                />
              )}
            </View>

            {/* Nota */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
              <TextInput
                style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                placeholderTextColor={colors.outline}
                placeholder="Nota opcional..."
                value={formData.nota}
                onChangeText={(text) => setFormData(prev => ({ ...prev, nota: text }))}
                editable={!isReadOnly}
              />
            </View>

            {/* Usuario */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Usuario *</Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, borderColor: colors.outlineVariant }]}
                onPress={() => !isReadOnly && setShowUsuarioDropdown(!showUsuarioDropdown)}
                disabled={isReadOnly}
              >
                <Text style={[styles.dropdownText, { color: formData.id_usuario ? colors.onSurface : colors.outline }]}>
                  {usuarios.find(u => u.id_usuario === formData.id_usuario)?.nombre_natural || 'Seleccionar usuario...'}
                </Text>
                {!isReadOnly && (
                  <Ionicons 
                    name={showUsuarioDropdown ? "chevron-up" : "chevron-down"} 
                    size={responsive.responsiveWidth(20)} 
                    color={colors.outline} 
                  />
                )}
              </TouchableOpacity>
              
              {showUsuarioDropdown && !isReadOnly && (
                <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                    {usuarios.map((usuario, index) => (
                      <TouchableOpacity
                        key={usuario.id_usuario}
                        style={[styles.dropdownItem, index === usuarios.length - 1 && styles.dropdownItemLast]}
                        onPress={() => {
                          setFormData(prev => ({ ...prev, id_usuario: usuario.id_usuario }));
                          setShowUsuarioDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{usuario.nombre_natural}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Cambio de Moneda */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.outline }]}>Cambio de Moneda *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                placeholderTextColor={colors.outline}
                placeholder="Tasa de cambio..."
                value={formData.cambio_moneda}
                onChangeText={(text) => setFormData(prev => ({ ...prev, cambio_moneda: text }))}
                keyboardType="numeric"
                editable={!isReadOnly}
              />
            </View>

            {/* Formas de Cobro */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Formas de Cobro</Text>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Efectivo CUP</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="0.00"
                  value={formData.cantidad_cobrada_efectivo_cup}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, cantidad_cobrada_efectivo_cup: text }))}
                  keyboardType="numeric"
                  editable={!isReadOnly}
                />
              </View>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Cuenta</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => !isReadOnly && setShowCuentaEfectivoCupDropdown(!showCuentaEfectivoCupDropdown)}
                  disabled={isReadOnly}
                >
                  <Text style={[styles.dropdownText, { color: formData.id_cuenta_efectivo_cup ? colors.onSurface : colors.outline }]}>
                    {cuentas.find(c => c.id_cuenta === formData.id_cuenta_efectivo_cup)?.nombre || 'Seleccionar...'}
                  </Text>
                  {!isReadOnly && (
                    <Ionicons 
                      name={showCuentaEfectivoCupDropdown ? "chevron-up" : "chevron-down"} 
                      size={responsive.responsiveWidth(20)} 
                      color={colors.outline} 
                    />
                  )}
                </TouchableOpacity>
                
                {showCuentaEfectivoCupDropdown && !isReadOnly && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      {cuentas.filter(c => c.tipo_cuenta === 'Efectivo CUP').map((cuenta, index) => (
                        <TouchableOpacity
                          key={cuenta.id_cuenta}
                          style={[styles.dropdownItem, index === cuentas.filter(c => c.tipo_cuenta === 'Efectivo CUP').length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, id_cuenta_efectivo_cup: cuenta.id_cuenta }));
                            setShowCuentaEfectivoCupDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Efectivo USD</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="0.00"
                  value={formData.cantidad_cobrada_efectivo_usd}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, cantidad_cobrada_efectivo_usd: text }))}
                  keyboardType="numeric"
                  editable={!isReadOnly}
                />
              </View>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Cuenta</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => !isReadOnly && setShowCuentaEfectivoUsdDropdown(!showCuentaEfectivoUsdDropdown)}
                  disabled={isReadOnly}
                >
                  <Text style={[styles.dropdownText, { color: formData.id_cuenta_efectivo_usd ? colors.onSurface : colors.outline }]}>
                    {cuentas.find(c => c.id_cuenta === formData.id_cuenta_efectivo_usd)?.nombre || 'Seleccionar...'}
                  </Text>
                  {!isReadOnly && (
                    <Ionicons 
                      name={showCuentaEfectivoUsdDropdown ? "chevron-up" : "chevron-down"} 
                      size={responsive.responsiveWidth(20)} 
                      color={colors.outline} 
                    />
                  )}
                </TouchableOpacity>
                
                {showCuentaEfectivoUsdDropdown && !isReadOnly && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      {cuentas.filter(c => c.tipo_cuenta === 'Efectivo USD').map((cuenta, index) => (
                        <TouchableOpacity
                          key={cuenta.id_cuenta}
                          style={[styles.dropdownItem, index === cuentas.filter(c => c.tipo_cuenta === 'Efectivo USD').length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, id_cuenta_efectivo_usd: cuenta.id_cuenta }));
                            setShowCuentaEfectivoUsdDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Transferencia CUP</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="0.00"
                  value={formData.cantidad_cobrada_transferencia_cup}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, cantidad_cobrada_transferencia_cup: text }))}
                  keyboardType="numeric"
                  editable={!isReadOnly}
                />
              </View>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Cuenta</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => !isReadOnly && setShowCuentaTransferenciaCupDropdown(!showCuentaTransferenciaCupDropdown)}
                  disabled={isReadOnly}
                >
                  <Text style={[styles.dropdownText, { color: formData.id_cuenta_transferencia_cup ? colors.onSurface : colors.outline }]}>
                    {cuentas.find(c => c.id_cuenta === formData.id_cuenta_transferencia_cup)?.nombre || 'Seleccionar...'}
                  </Text>
                  {!isReadOnly && (
                    <Ionicons 
                      name={showCuentaTransferenciaCupDropdown ? "chevron-up" : "chevron-down"} 
                      size={responsive.responsiveWidth(20)} 
                      color={colors.outline} 
                    />
                  )}
                </TouchableOpacity>
                
                {showCuentaTransferenciaCupDropdown && !isReadOnly && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      {cuentas.filter(c => c.tipo_cuenta === 'Transferencia CUP').map((cuenta, index) => (
                        <TouchableOpacity
                          key={cuenta.id_cuenta}
                          style={[styles.dropdownItem, index === cuentas.filter(c => c.tipo_cuenta === 'Transferencia CUP').length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, id_cuenta_transferencia_cup: cuenta.id_cuenta }));
                            setShowCuentaTransferenciaCupDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Transferencia USD</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholderTextColor={colors.outline}
                  placeholder="0.00"
                  value={formData.cantidad_cobrada_transferencia_usd}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, cantidad_cobrada_transferencia_usd: text }))}
                  keyboardType="numeric"
                  editable={!isReadOnly}
                />
              </View>
              <View style={[styles.formColumn, styles.formGroup]}>
                <Text style={[styles.label, { color: colors.outline }]}>Cuenta</Text>
                <TouchableOpacity
                  style={[styles.dropdown, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.background, borderColor: colors.outlineVariant }]}
                  onPress={() => !isReadOnly && setShowCuentaTransferenciaUsdDropdown(!showCuentaTransferenciaUsdDropdown)}
                  disabled={isReadOnly}
                >
                  <Text style={[styles.dropdownText, { color: formData.id_cuenta_transferencia_usd ? colors.onSurface : colors.outline }]}>
                    {cuentas.find(c => c.id_cuenta === formData.id_cuenta_transferencia_usd)?.nombre || 'Seleccionar...'}
                  </Text>
                  {!isReadOnly && (
                    <Ionicons 
                      name={showCuentaTransferenciaUsdDropdown ? "chevron-up" : "chevron-down"} 
                      size={responsive.responsiveWidth(20)} 
                      color={colors.outline} 
                    />
                  )}
                </TouchableOpacity>
                
                {showCuentaTransferenciaUsdDropdown && !isReadOnly && (
                  <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                      {cuentas.filter(c => c.tipo_cuenta === 'Transferencia USD').map((cuenta, index) => (
                        <TouchableOpacity
                          key={cuenta.id_cuenta}
                          style={[styles.dropdownItem, index === cuentas.filter(c => c.tipo_cuenta === 'Transferencia USD').length - 1 && styles.dropdownItemLast]}
                          onPress={() => {
                            setFormData(prev => ({ ...prev, id_cuenta_transferencia_usd: cuenta.id_cuenta }));
                            setShowCuentaTransferenciaUsdDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{cuenta.nombre}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            {/* Ventas */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Ventas</Text>
              {!isReadOnly && (
                <TouchableOpacity
                  style={[styles.addButtonSmall, { backgroundColor: colors.primary }]}
                  onPress={handleAddVentaItem}
                >
                  <Ionicons name="add" size={responsive.responsiveWidth(18)} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            {ventaItems.map((item, index) => (
              <Card key={item.id} style={[styles.ventaItemCard, { backgroundColor: colors.background }]}>
                <View style={styles.ventaItemHeader}>
                  <Text style={[styles.ventaItemTitle, { color: colors.onSurface }]}>Venta {index + 1}</Text>
                  {!isReadOnly && (
                    <TouchableOpacity
                      onPress={() => handleRemoveVentaItem(item.id)}
                    >
                      <Ionicons name="close-circle" size={responsive.responsiveWidth(20)} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Servicio *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="Buscar servicio..."
                    value={item.servicio?.nombre || ''}
                    onChangeText={(text) => {
                      if (!isReadOnly) {
                        handleUpdateVentaItem(item.id, 'servicio', { nombre: text });
                        searchServicios(text);
                      }
                    }}
                    editable={!isReadOnly}
                  />
                  {servicioSearchResults.length > 0 && !isReadOnly && (
                    <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                        {servicioSearchResults.map((servicio, idx) => (
                          <TouchableOpacity
                            key={servicio.id_servicio}
                            style={[styles.dropdownItem, idx === servicioSearchResults.length - 1 && styles.dropdownItemLast]}
                            onPress={() => handleServicioSelect(item.id, servicio)}
                          >
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{servicio.nombre}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.formColumn, styles.formGroup]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Cantidad *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      placeholderTextColor={colors.outline}
                      placeholder="0"
                      value={item.cantidad}
                      onChangeText={(text) => handleUpdateVentaItem(item.id, 'cantidad', text)}
                      keyboardType="numeric"
                      editable={!isReadOnly}
                    />
                  </View>
                  <View style={[styles.formColumn, styles.formGroup]}>
                    <Text style={[styles.label, { color: colors.outline }]}>Precio CUP *</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                      placeholderTextColor={colors.outline}
                      placeholder="0.00"
                      value={item.precio_cobrado_cup}
                      onChangeText={(text) => handleUpdateVentaItem(item.id, 'precio_cobrado_cup', text)}
                      keyboardType="numeric"
                      editable={!isReadOnly}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Precio USD *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: isReadOnly ? colors.surfaceVariant : colors.surface, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                    placeholderTextColor={colors.outline}
                    placeholder="0.00"
                    value={item.precio_cobrado_usd}
                    onChangeText={(text) => handleUpdateVentaItem(item.id, 'precio_cobrado_usd', text)}
                    keyboardType="numeric"
                    editable={!isReadOnly}
                  />
                </View>
              </Card>
            ))}

            {/* Resumen de Montos */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Resumen de Montos</Text>
            </View>

            <View style={[styles.totalSection, { backgroundColor: colors.primary }]}>
              <Text style={[styles.totalLabel, { color: '#fff' }]}>Total a recibir:</Text>
              <Text style={[styles.totalAmount, { color: '#fff' }]}>
                ${calculateTotalToReceive().toFixed(2)} CUP
              </Text>
            </View>

            <View style={[styles.receivedSection, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.receivedLabel, { color: colors.onSurface }]}>Total recibido:</Text>
              <Text style={[styles.receivedAmount, { color: colors.onSurface }]}>
                ${calculateTotalReceived().toFixed(2)} CUP
              </Text>
            </View>

            <View style={[styles.remainingSection, { backgroundColor: getRemainingAmount() > 0.01 ? colors.errorContainer : getRemainingAmount() < -0.01 ? colors.successContainer : colors.primary }]}>
              <Text style={[styles.remainingLabel, { color: getRemainingAmount() > 0.01 ? colors.error : getRemainingAmount() < -0.01 ? colors.onSurface : '#fff' }]}>
                {getRemainingAmount() > 0.01 ? 'Falta por recibir:' : getRemainingAmount() < -0.01 ? 'Exceso recibido:' : 'Pago completo:'}
              </Text>
              <Text style={[styles.remainingAmount, { color: getRemainingAmount() > 0.01 ? colors.error : getRemainingAmount() < -0.01 ? colors.onSurface : '#fff' }]}>
                ${Math.abs(getRemainingAmount()).toFixed(2)} CUP
              </Text>
            </View>

            {/* Botones de acción */}
            {!isReadOnly && (
              <View style={styles.actionButtons}>
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
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.buttonText, { color: '#fff' }]}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {isReadOnly && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={[styles.buttonText, { color: colors.onSurface }]}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default function VentaEditScreen() {
  return <VentaEditContent />;
}

const createStyles = (responsive) => StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: responsive.responsivePadding(16),
  },
  scrollContent: {
    paddingBottom: responsive.responsivePadding(20),
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: responsive.responsivePadding(40),
  },
  loadingText: {
    marginTop: responsive.responsiveMargin(16),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  formCard: {
    borderRadius: 16,
    padding: responsive.responsivePadding(20),
    marginTop: responsive.responsiveMargin(55),
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
    gap: responsive.responsiveMargin(12),
  },
  formColumn: {
    flex: 1,
  },
  formColumn60: {
    flex: 0.6,
  },
  label: {
    fontSize: responsive.responsiveFontSize(14),
    fontWeight: '500',
    fontFamily: 'Inter',
    marginBottom: responsive.responsiveMargin(8),
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: responsive.responsivePadding(12),
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  inputText: {
    fontSize: responsive.responsiveFontSize(16),
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
    fontSize: responsive.responsiveFontSize(16),
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
    maxHeight: responsive.responsiveHeight(150),
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
    fontSize: responsive.responsiveFontSize(16),
    fontFamily: 'Inter',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: responsive.responsiveMargin(24),
    marginBottom: responsive.responsiveMargin(16),
  },
  sectionTitle: {
    fontSize: responsive.responsiveFontSize(18),
    fontWeight: '700',
    fontFamily: 'Hanken Grotesk',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(8),
    marginBottom: responsive.responsiveHeight(8),
  },
  totalLabel: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: responsive.responsiveWidth(18),
    fontWeight: '700',
  },
  receivedSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(8),
    marginBottom: responsive.responsiveHeight(8),
  },
  receivedLabel: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
  },
  receivedAmount: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '700',
  },
  remainingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsive.responsivePadding(16),
    borderRadius: responsive.responsiveWidth(8),
    marginBottom: responsive.responsiveHeight(16),
    overflow: 'hidden',
  },
  remainingLabel: {
    fontSize: responsive.responsiveWidth(14),
    fontWeight: '600',
  },
  remainingAmount: {
    fontSize: responsive.responsiveWidth(16),
    fontWeight: '700',
  },
  addButtonSmall: {
    width: responsive.responsiveWidth(36),
    height: responsive.responsiveHeight(36),
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ventaItemCard: {
    borderRadius: 12,
    padding: responsive.responsivePadding(16),
    marginBottom: responsive.responsiveMargin(12),
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  ventaItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsive.responsiveMargin(12),
  },
  ventaItemTitle: {
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Hanken Grotesk',
  },
  actionButtons: {
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
    fontSize: responsive.responsiveFontSize(16),
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  safeArea: {
    flex: 1,
  },
});

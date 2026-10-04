import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
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
import { createMovimiento, updateMovimiento, getMovimientoById } from '../services/movimientoService';
import { getTiendas } from '../services/tiendaService';
import { getServicios, getServicioById } from '../services/servicioService';
import { Toast } from '../components/common/Toast';
import { useToast } from '../hooks/useToast';
import configService from '../services/configService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MovimientoFormContent = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const responsive = useResponsive();
  const { user, movimientoAccessLevels, movimientoManagePermissions } = useAuth();
  const { isOfflineMode } = useOffline();
  const { toast, showToast, hideToast } = useToast();

  const { movimiento, mode } = route.params || { mode: 'add' };
  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';
  const isReadOnly = isOfflineMode || isViewMode;

  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingMovimiento, setIsFetchingMovimiento] = useState(false);
  const [tiendas, setTiendas] = useState([]);
  const [productosOrigen, setProductosOrigen] = useState([]);
  const [showTiendaOrigenDropdown, setShowTiendaOrigenDropdown] = useState(false);
  const [showTiendaDestinoDropdown, setShowTiendaDestinoDropdown] = useState(false);
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [productoSearchText, setProductoSearchText] = useState('');

  const predefinedMovimientoTypes = ['Transferencia', 'Ajuste', 'Devolucion'];
  const [customMovimientoTypes, setCustomMovimientoTypes] = useState([]);
  const [showTipoMovimientoDropdown, setShowTipoMovimientoDropdown] = useState(false);
  const [tipoMovimientoSearchText, setTipoMovimientoSearchText] = useState('');

  const [formData, setFormData] = useState({
    tipo_movimiento: 'Transferencia',
    estado: false,
    nota: '',
    id_tienda_origen: null,
    id_tienda_destino: null,
    tienda_origen: null,
    tienda_destino: null,
    movimientos: [],
  });

  const [movimientoItem, setMovimientoItem] = useState({
    cantidad: '',
    nota: '',
    id_servicio_tienda: null,
    servicio_tienda: null,
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';

  // Load custom movimiento types
  useEffect(() => {
    const loadCustomMovimientoTypes = async () => {
      try {
        // Load from config
        const config = await configService.getConfig();
        if (config.customMovimientoTypes) {
          setCustomMovimientoTypes(config.customMovimientoTypes);
        }
        
        // Load from AsyncStorage as backup
        const asyncStorageTypes = await AsyncStorage.getItem('customMovimientoTypes');
        if (asyncStorageTypes) {
          const parsedTypes = JSON.parse(asyncStorageTypes);
          setCustomMovimientoTypes(prev => {
            const combined = [...new Set([...prev, ...parsedTypes])];
            return combined;
          });
        }
      } catch (error) {
        console.error('Error loading custom movimiento types:', error);
      }
    };
    loadCustomMovimientoTypes();
  }, []);

  const saveCustomMovimientoType = async (newType) => {
    if (!newType || newType.trim() === '') return;
    
    // Check if already exists
    const allTypes = [...predefinedMovimientoTypes, ...customMovimientoTypes];
    if (allTypes.includes(newType.trim())) return;
    
    const updatedTypes = [...customMovimientoTypes, newType.trim()];
    setCustomMovimientoTypes(updatedTypes);
    
    try {
      // Save to AsyncStorage
      await AsyncStorage.setItem('customMovimientoTypes', JSON.stringify(updatedTypes));
      
      // Save to config
      const config = await configService.getConfig();
      const updatedConfig = {
        ...config,
        customMovimientoTypes: updatedTypes,
      };
      await configService.updateConfig(updatedConfig);
    } catch (error) {
      console.error('Error saving custom movimiento type:', error);
    }
  };

  useEffect(() => {
    const fetchCompleteMovimiento = async () => {
      if (movimiento?.id_movimiento_lista) {
        try {
          setIsFetchingMovimiento(true);
          const completeMovimiento = isOfflineMode ? movimiento : await getMovimientoById(movimiento.id_movimiento_lista);
          
          console.log('[MovimientoFormScreen] completeMovimiento raw data:', completeMovimiento);
          
          // Extraer tiendas de los movimientos si no están en el nivel raíz
          const tiendaOrigen = completeMovimiento.tienda_origen || 
                             completeMovimiento.movimientos?.[0]?.servicioTiendaOrigen?.tienda ||
                             completeMovimiento.movimientos?.[0]?.servicio_tienda_origen?.tienda;
          const tiendaDestino = completeMovimiento.tienda_destino || 
                              completeMovimiento.movimientos?.[0]?.servicioTiendaDestino?.tienda ||
                              completeMovimiento.movimientos?.[0]?.servicio_tienda_destino?.tienda;
          
          // Mapear movimientos con servicio_tienda completo
          const movimientosConServicio = await Promise.all(
            (completeMovimiento.movimientos || []).map(async (mov) => {
              // Obtener servicio_tienda origen completo
              const servicioOrigen = await getServicioById(mov.servicioTiendaOrigen?.servicio?.id_servicio || mov.id_servicio_tienda_origen);
              const tiendaServicioOrigen = servicioOrigen.tiendas_servicio?.find(ts => ts.id_tienda === completeMovimiento.id_tienda_origen);
              
              return {
                id_servicio_tienda: mov.id_servicio_tienda_origen,
                cantidad: mov.cantidad,
                nota: mov.nota || '',
                servicio_tienda: tiendaServicioOrigen || {
                  id_servicio_tienda: mov.id_servicio_tienda_origen,
                  servicio: servicioOrigen,
                  cantidad: mov.cantidad,
                },
              };
            })
          );

          setFormData({
            tipo_movimiento: completeMovimiento.tipo_movimiento || 'Transferencia',
            estado: completeMovimiento.estado ?? true,
            nota: completeMovimiento.nota || completeMovimiento.movimientos?.[0]?.nota || '',
            id_tienda_origen: completeMovimiento.id_tienda_origen || tiendaOrigen?.id_tienda,
            id_tienda_destino: completeMovimiento.id_tienda_destino || tiendaDestino?.id_tienda,
            tienda_origen: tiendaOrigen,
            tienda_destino: tiendaDestino,
            movimientos: movimientosConServicio,
          });

          console.log('[MovimientoFormScreen] Datos cargados para edición:', {
            tipo_movimiento: completeMovimiento.tipo_movimiento,
            estado: completeMovimiento.estado,
            notaFromRoot: completeMovimiento.nota,
            notaFromMovimientos: completeMovimiento.movimientos?.[0]?.nota,
            finalNota: completeMovimiento.nota || completeMovimiento.movimientos?.[0]?.nota || '',
            notaLength: (completeMovimiento.nota || completeMovimiento.movimientos?.[0]?.nota || '').length,
            notaType: typeof (completeMovimiento.nota || completeMovimiento.movimientos?.[0]?.nota || ''),
          });
        } catch (err) {
          console.error('[fetchCompleteMovimiento] Error:', err);
        } finally {
          setIsFetchingMovimiento(false);
        }
      }
    };
    fetchCompleteMovimiento();
  }, [movimiento?.id_movimiento_lista, isOfflineMode]);

  useEffect(() => {
    const fetchTiendas = async () => {
      try {
        if (isOfflineMode) return;
        const response = await getTiendas({ activo: true });
        let tiendasList = response.data || [];

        // Filter tiendas based on movement permissions
        const userRole = user?.rol?.toLowerCase();
        const isAdmin = userRole === 'administrador';
        const userTiendaId = user?.id_tienda;

        if (!isAdmin && movimientoAccessLevels && movimientoManagePermissions) {
          const accessLevel = 
            userRole === 'dependiente' ? movimientoAccessLevels.dependiente :
            userRole === 'almacenero' ? movimientoAccessLevels.almacenero :
            userRole === 'económico' ? movimientoAccessLevels.economico : 'none';

          const canManage = 
            userRole === 'dependiente' ? movimientoManagePermissions.dependiente :
            userRole === 'almacenero' ? movimientoManagePermissions.almacenero :
            userRole === 'económico' ? movimientoManagePermissions.economico : false;

          // If user has manage permission but only "mi_tienda" access, filter for origen
          if (canManage && accessLevel === 'mi_tienda' && userTiendaId) {
            // For origen dropdown, only show user's tienda
            // For destino dropdown, show all (they can send to any tienda)
            // We'll handle this in the render
          }
        }

        setTiendas(tiendasList);
      } catch (error) {
        setTiendas([]);
      }
    };
    fetchTiendas();
  }, [isOfflineMode, movimientoAccessLevels, movimientoManagePermissions, user]);

  // Helper function to filter tiendas based on permissions
  const getFilteredTiendas = (type) => {
    const userRole = user?.rol?.toLowerCase();
    const isAdmin = userRole === 'administrador';
    const userTiendaId = user?.id_tienda;

    let filteredTiendas = tiendas;

    if (isAdmin) {
      filteredTiendas = tiendas;
    } else if (!movimientoAccessLevels || !movimientoManagePermissions) {
      filteredTiendas = tiendas;
    } else {
      const accessLevel = 
        userRole === 'dependiente' ? movimientoAccessLevels.dependiente :
        userRole === 'almacenero' ? movimientoAccessLevels.almacenero :
        userRole === 'económico' ? movimientoAccessLevels.economico : 'none';

      const canManage = 
        userRole === 'dependiente' ? movimientoManagePermissions.dependiente :
        userRole === 'almacenero' ? movimientoManagePermissions.almacenero :
        userRole === 'económico' ? movimientoManagePermissions.economico : false;

      // If user has manage permission with "mi_tienda" access
      if (canManage && accessLevel === 'mi_tienda' && userTiendaId) {
        if (type === 'origen') {
          // Only show user's tienda for origen
          filteredTiendas = tiendas.filter(tienda => tienda.id_tienda === userTiendaId);
        } else if (type === 'destino') {
          // Show all tiendas for destino (they can send to any tienda)
          filteredTiendas = tiendas;
        }
      }
    }

    // Prevent selecting the same tienda as both origen and destino
    if (type === 'origen' && formData.id_tienda_destino) {
      filteredTiendas = filteredTiendas.filter(tienda => tienda.id_tienda !== formData.id_tienda_destino);
    } else if (type === 'destino' && formData.id_tienda_origen) {
      filteredTiendas = filteredTiendas.filter(tienda => tienda.id_tienda !== formData.id_tienda_origen);
    }

    return filteredTiendas;
  };

  useEffect(() => {
    const fetchProductosOrigen = async () => {
      try {
        if (isOfflineMode || !formData.id_tienda_origen) {
          setProductosOrigen([]);
          return;
        }
        const response = await getServicios({ 
          fetchProducto: true,
          conStock: true,
          id_tienda: formData.id_tienda_origen,
          limit: 1000 
        }, 1, 1000);
        const servicios = response.data || [];
        // Filtrar solo productos (servicio.producto !== null)
        const soloProductos = servicios.filter(servicio => servicio.producto !== null);
        // Convertir servicios a formato servicio_tienda
        const productosOrigen = soloProductos.map(servicio => {
          const tiendaServicio = servicio.tiendas_servicio?.find(ts => ts.id_tienda === formData.id_tienda_origen);
          return {
            id_servicio_tienda: tiendaServicio?.id_servicio_tienda || servicio.id_servicio,
            servicio: servicio,
            tienda: formData.tienda_origen,
            cantidad: tiendaServicio?.cantidad || 0,
            precio_cup: tiendaServicio?.precio_cup || 0,
            precio_usd: tiendaServicio?.precio_usd || 0,
          };
        });
        setProductosOrigen(productosOrigen);
      } catch (error) {
        setProductosOrigen([]);
      }
    };
    fetchProductosOrigen();
  }, [formData.id_tienda_origen, isOfflineMode]);


  const handleAddMovimientoItem = () => {
    if (!movimientoItem.cantidad || parseFloat(movimientoItem.cantidad) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor a 0' });
      return;
    }
    if (!movimientoItem.id_servicio_tienda) {
      showToast({ type: 'warning', message: 'Debe seleccionar un servicio' });
      return;
    }
    const newItem = {
      cantidad: parseFloat(movimientoItem.cantidad),
      nota: movimientoItem.nota,
      id_servicio_tienda: movimientoItem.id_servicio_tienda,
      servicio_tienda: movimientoItem.servicio_tienda,
    };
    setFormData(prev => ({ ...prev, movimientos: [...prev.movimientos, newItem] }));
    setMovimientoItem({ cantidad: '', nota: '', id_servicio_tienda: null, servicio_tienda: null });
  };

  const handleRemoveMovimientoItem = (index) => {
    setFormData(prev => ({ ...prev, movimientos: prev.movimientos.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    if (!formData.id_tienda_origen) {
      showToast({ type: 'warning', message: 'Debe seleccionar la tienda de origen' });
      return;
    }
    if (!formData.id_tienda_destino) {
      showToast({ type: 'warning', message: 'Debe seleccionar la tienda de destino' });
      return;
    }
    if (!formData.tipo_movimiento) {
      showToast({ type: 'warning', message: 'Debe seleccionar el tipo de movimiento' });
      return;
    }
    if (formData.movimientos.length === 0) {
      showToast({ type: 'warning', message: 'Debe agregar al menos un producto al movimiento' });
      return;
    }

    setIsSaving(true);
    try {
      // Para cada movimiento, encontrar el servicio_tienda en la tienda de destino
      const movimientosConDestino = await Promise.all(
        formData.movimientos.map(async (item) => {
          // Obtener el servicio completo usando el id_servicio del servicio_tienda
          const servicio = await getServicioById(item.servicio_tienda.servicio.id_servicio);
          // Buscar el servicio_tienda en la tienda de destino
          const tiendaServicioDestino = servicio.tiendas_servicio?.find(ts => ts.id_tienda === formData.id_tienda_destino);
          
          if (!tiendaServicioDestino) {
            throw new Error(`El producto "${servicio.nombre}" no existe en la tienda de destino`);
          }

          const idOrigen = parseInt(item.id_servicio_tienda);
          const idDestino = parseInt(tiendaServicioDestino.id_servicio_tienda);

          if (isNaN(idOrigen)) {
            throw new Error(`id_servicio_tienda_origen no es válido para el producto "${servicio.nombre}"`);
          }
          if (isNaN(idDestino)) {
            throw new Error(`id_servicio_tienda_destino no es válido para el producto "${servicio.nombre}"`);
          }

          return {
            id_servicio_tienda_origen: idOrigen,
            id_servicio_tienda_destino: idDestino,
            cantidad: item.cantidad,
            nota: item.nota,
          };
        })
      );

      const idUsuario = parseInt(user.id_usuario);
      
      if (isNaN(idUsuario)) {
        throw new Error('id_usuario no es válido');
      }

      const movimientoData = {
        tipo_movimiento: formData.tipo_movimiento,
        estado: formData.estado,
        nota: formData.nota || '',
        id_servicio_tienda_origen: movimientosConDestino[0].id_servicio_tienda_origen,
        id_servicio_tienda_destino: movimientosConDestino[0].id_servicio_tienda_destino,
        movimientos: movimientosConDestino,
        id_usuario: idUsuario,
      };

      console.log('[MovimientoFormScreen] Guardando movimiento:', {
        isEditMode,
        tipo_movimiento: formData.tipo_movimiento,
        estado: formData.estado,
        nota: formData.nota,
        notaLength: formData.nota?.length,
        notaType: typeof formData.nota,
        idUsuario,
      });

      if (isEditMode) {
        await updateMovimiento(movimiento.id_movimiento_lista, movimientoData);
        showToast({ type: 'success', message: 'Movimiento actualizado correctamente' });
      } else {
        await createMovimiento(movimientoData);
        showToast({ type: 'success', message: 'Movimiento creado correctamente' });
      }
      navigation.goBack();
    } catch (error) {
      showToast({ type: 'error', message: error.message || 'Error al guardar movimiento' });
    } finally {
      setIsSaving(false);
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
      <Toast visible={toast.visible} type={toast.type} message={toast.message} code={toast.code} duration={toast.duration} onHide={hideToast} toastKey={toast.key} />
      <Header showBackButton={true} onBackPress={() => navigation.goBack()} isDark={isDarkMode} title={isEditMode ? 'Editar Movimiento' : isAddMode ? 'Nuevo Movimiento' : 'Ver Movimiento'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={styles.content} keyboardVerticalOffset={Platform.OS === 'ios' ? responsive.headerHeight : responsive.headerHeight * 0.01} enabled={true}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {isFetchingMovimiento ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.outline }]}>Cargando datos...</Text>
            </View>
          ) : (
            <>
              <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tipo de Movimiento *</Text>
                  {isReadOnly ? (
                    <View style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.inputText, { color: colors.onSurface }]}>{formData.tipo_movimiento || 'N/A'}</Text>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]}
                        placeholderTextColor={colors.outline}
                        placeholder="Seleccionar o escribir tipo..."
 value={formData.tipo_movimiento}
                        onChangeText={(text) => {
                          setFormData(prev => ({ ...prev, tipo_movimiento: text }));
                          setTipoMovimientoSearchText(text);
                        }}
                        onFocus={() => !isReadOnly && setShowTipoMovimientoDropdown(true)}
                        onBlur={() => {
                          setShowTipoMovimientoDropdown(false);
                          // Save custom type if it doesn't exist in predefined or custom types
                          if (formData.tipo_movimiento && formData.tipo_movimiento.trim() !== '') {
                            const allTypes = [...predefinedMovimientoTypes, ...customMovimientoTypes];
                            if (!allTypes.includes(formData.tipo_movimiento.trim())) {
                              saveCustomMovimientoType(formData.tipo_movimiento);
                            }
                          }
                        }}
                      />
                      {showTipoMovimientoDropdown && (
                        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                          <ScrollView style={styles.dropdownScroll}>
                            {[...predefinedMovimientoTypes, ...customMovimientoTypes]
                              .filter(t => t.toLowerCase().includes(tipoMovimientoSearchText.toLowerCase()))
                              .map((type, index) => (
                                <TouchableOpacity
                                  key={type}
                                  style={[styles.dropdownItem, index === ([...predefinedMovimientoTypes, ...customMovimientoTypes].filter(t => t.toLowerCase().includes(tipoMovimientoSearchText.toLowerCase())).length - 1) && styles.dropdownItemLast]}
                                  onPress={() => {
                                    setFormData(prev => ({ ...prev, tipo_movimiento: type }));
                                    setShowTipoMovimientoDropdown(false);
                                    setTipoMovimientoSearchText('');
                                  }}
                                >
                                  <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{type}</Text>
                                </TouchableOpacity>
                              ))}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  )}
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Estado</Text>
                  <View style={styles.switchRow}>
                    <TouchableOpacity onPress={() => setFormData(prev => ({ ...prev, estado: !prev.estado }))}>
                      <View style={[styles.switchTrackSimple, { backgroundColor: formData.estado ? '#4CAF50' : colors.outlineVariant }]}>
                        <View style={[styles.switchThumbSimple, { transform: [{ translateX: formData.estado ? 20 : 0 }] }]} />
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.switchLabelSimple, { color: formData.estado ? '#4CAF50' : '#F44336', fontWeight: '600' }]}>{formData.estado ? 'Completado' : 'Pendiente'}</Text>
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tienda Origen *</Text>
                  {isReadOnly ? (
                    <View style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.inputText, { color: colors.onSurface }]}>{formData.tienda_origen?.nombre || 'N/A'}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]} onPress={() => setShowTiendaOrigenDropdown(!showTiendaOrigenDropdown)}>
                      <Text style={[styles.inputText, { color: colors.onSurface }]}>{formData.tienda_origen?.nombre || 'Seleccionar...'}</Text>
                      <Ionicons name={showTiendaOrigenDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  {showTiendaOrigenDropdown && (
                    <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      <ScrollView style={styles.dropdownScroll}>
                        {getFilteredTiendas('origen').map((tienda) => (
                          <TouchableOpacity key={tienda.id_tienda} style={styles.dropdownItem} onPress={() => { setFormData(prev => ({ ...prev, id_tienda_origen: tienda.id_tienda, tienda_origen: tienda })); setShowTiendaOrigenDropdown(false); }}>
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Tienda Destino *</Text>
                  {isReadOnly ? (
                    <View style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                      <Text style={[styles.inputText, { color: colors.onSurface }]}>{formData.tienda_destino?.nombre || 'N/A'}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]} onPress={() => setShowTiendaDestinoDropdown(!showTiendaDestinoDropdown)}>
                      <Text style={[styles.inputText, { color: colors.onSurface }]}>{formData.tienda_destino?.nombre || 'Seleccionar...'}</Text>
                      <Ionicons name={showTiendaDestinoDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  {showTiendaDestinoDropdown && (
                    <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                      <ScrollView style={styles.dropdownScroll}>
                        {getFilteredTiendas('destino').map((tienda) => (
                          <TouchableOpacity key={tienda.id_tienda} style={styles.dropdownItem} onPress={() => { setFormData(prev => ({ ...prev, id_tienda_destino: tienda.id_tienda, tienda_destino: tienda })); setShowTiendaDestinoDropdown(false); }}>
                            <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{tienda.nombre}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: colors.outline }]}>Nota</Text>
                  <TextInput style={[styles.textArea, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]} placeholderTextColor={colors.outline} placeholder="Descripción del movimiento..." value={formData.nota} onChangeText={(text) => setFormData(prev => ({ ...prev, nota: text }))} multiline numberOfLines={3} editable={!isReadOnly} />
                </View>
              </Card>
              <Card style={[styles.formCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Productos en Movimiento</Text>
                {!isReadOnly && (
                  <View style={styles.itemForm}>
                    <View style={styles.formRow}>
                      <View style={[styles.formGroup, { flex: 0.7 }]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Producto *</Text>
                        <TouchableOpacity style={[styles.input, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]} onPress={() => { if (!formData.id_tienda_origen) { showToast({ type: 'warning', message: 'Seleccione primero la tienda de origen' }); } else { setShowProductoDropdown(!showProductoDropdown); } }}>
                          <Text style={[styles.inputText, { color: colors.onSurface }]}>{movimientoItem.servicio_tienda?.servicio?.nombre || 'Seleccionar...'}</Text>
                          <Ionicons name={showProductoDropdown ? "chevron-up" : "chevron-down"} size={20} color={colors.primary} />
                        </TouchableOpacity>
                        {showProductoDropdown && (
                          <View style={[styles.dropdownMenu, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]}>
                            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                              <View style={[styles.dropdownSearchInput, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                                <Ionicons name="search-outline" size={responsive.responsiveWidth(18)} color={colors.outline} style={styles.searchIcon} />
                                <TextInput style={[styles.dropdownSearchInputText, { color: colors.onSurface }]} placeholderTextColor={colors.outline} placeholder="Buscar producto..." value={productoSearchText} onChangeText={setProductoSearchText} />
                              </View>
                              <TouchableOpacity
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setMovimientoItem(prev => ({ ...prev, id_servicio_tienda: null, servicio_tienda: null }));
                                  setShowProductoDropdown(false);
                                  setProductoSearchText('');
                                }}
                              >
                                <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>Ninguno</Text>
                              </TouchableOpacity>
                              {productosOrigen.filter(p => p.servicio?.nombre?.toLowerCase().includes(productoSearchText.toLowerCase())).length > 0 ? (
                                productosOrigen.filter(p => p.servicio?.nombre?.toLowerCase().includes(productoSearchText.toLowerCase())).map((producto, index) => (
                                  <TouchableOpacity
                                    key={producto.id_servicio_tienda}
                                    style={[styles.dropdownItem, index === productosOrigen.filter(p => p.servicio?.nombre?.toLowerCase().includes(productoSearchText.toLowerCase())).length - 1 && styles.dropdownItemLast]}
                                    onPress={() => { setMovimientoItem(prev => ({ ...prev, id_servicio_tienda: producto.id_servicio_tienda, servicio_tienda: producto })); setShowProductoDropdown(false); setProductoSearchText(''); }}
                                  >
                                    <Text style={[styles.dropdownItemText, { color: colors.onSurface }]}>{producto.servicio?.nombre}</Text>
                                  </TouchableOpacity>
                                ))
                              ) : (
                                <View style={styles.dropdownItem}>
                                  <Text style={[styles.dropdownItemText, { color: colors.outline }]}>No se encontraron productos</Text>
                                </View>
                              )}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                      <View style={[styles.formGroup, { flex: 0.3 }]}>
                        <Text style={[styles.label, { color: colors.outline }]}>Cantidad *</Text>
                        <TextInput style={[styles.input, { backgroundColor: colors.background, color: colors.onSurface, borderColor: colors.outlineVariant }]} placeholderTextColor={colors.outline} placeholder="0.00" value={movimientoItem.cantidad} onChangeText={(text) => setMovimientoItem(prev => ({ ...prev, cantidad: text }))} keyboardType="decimal-pad" />
                      </View>
                    </View>
                    {movimientoItem.servicio_tienda && (
                      <View style={[styles.stockInfoPanel, { backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.1)' : '#E8F5E9', borderColor: '#4CAF50' }]}>
                        <View style={styles.stockInfoRow}>
                          <Text style={[styles.stockInfoText, { color: colors.onSurface }]}>
                            Stock actual: <Text style={[styles.stockInfoValue, { color: '#4CAF50' }]}>{formatNumber(movimientoItem.servicio_tienda.cantidad)}</Text>
                          </Text>
                        </View>
                        <View style={styles.stockInfoRowLast}>
                          <Text style={[styles.stockInfoText, { color: colors.onSurface }]}>
                            Stock después del movimiento: <Text style={[styles.stockInfoValue, { color: movimientoItem.cantidad && parseFloat(movimientoItem.cantidad) > movimientoItem.servicio_tienda.cantidad ? '#F44336' : '#4CAF50' }]}>
                              {movimientoItem.cantidad ? formatNumber(Math.max(0, movimientoItem.servicio_tienda.cantidad - parseFloat(movimientoItem.cantidad))) : formatNumber(movimientoItem.servicio_tienda.cantidad)}
                            </Text>
                          </Text>
                        </View>
                      </View>
                    )}
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleAddMovimientoItem}>
                      <Ionicons name="add" size={20} color="#fff" />
                      <Text style={[styles.addButtonText, { color: '#fff' }]}>Agregar Producto</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {formData.movimientos.length > 0 && (
                  <View style={styles.itemsList}>
                    {formData.movimientos.map((item, index) => (
                      <View key={index} style={[styles.itemCard, { backgroundColor: colors.background, borderColor: colors.outlineVariant }]}>
                        <View style={styles.itemInfo}>
                          <Text style={[styles.itemServicio, { color: colors.onSurface }]}>{item.servicio_tienda?.servicio?.nombre || 'N/A'}</Text>
                          <Text style={[styles.itemCantidad, { color: colors.primary }]}>Cantidad: {formatNumber(item.cantidad)}</Text>
                        </View>
                        {!isReadOnly && (
                          <TouchableOpacity style={[styles.removeButton, { backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }]} onPress={() => handleRemoveMovimientoItem(index)}>
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
              {!isReadOnly && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }]} onPress={() => navigation.goBack()}>
                    <Text style={[styles.cancelButtonText, { color: colors.onSurface }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={isSaving}>
                    {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.saveButtonText, { color: '#fff' }]}>Guardar</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export const MovimientoFormScreen = () => <MovimientoFormContent />;

const createStyles = (responsive) => StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, marginTop: responsive.headerHeight },
  scrollContent: { padding: responsive.responsivePadding(16) },
  loadingContainer: { alignItems: 'center', padding: responsive.responsivePadding(40) },
  loadingText: { marginTop: responsive.responsiveMargin(16), fontSize: responsive.fontSizes.body, fontFamily: 'Inter' },
  formCard: { borderRadius: 16, padding: responsive.responsivePadding(20), marginBottom: responsive.responsiveMargin(16), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  formGroup: { marginBottom: responsive.responsiveMargin(16) },
  formRow: { flexDirection: 'row', gap: responsive.responsiveMargin(12) },
  label: { fontSize: responsive.fontSizes.bodySmall, fontWeight: '500', fontFamily: 'Inter', marginBottom: responsive.responsiveMargin(8) },
  input: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: responsive.responsivePadding(12), fontSize: responsive.fontSizes.body, fontFamily: 'Inter' },
  inputText: { fontSize: responsive.fontSizes.body, fontFamily: 'Inter' },
  textArea: { borderWidth: 1, borderRadius: 8, padding: responsive.responsivePadding(12), fontSize: responsive.fontSizes.body, fontFamily: 'Inter', textAlignVertical: 'top' },
  dropdown: { borderWidth: 1, borderRadius: 8, marginTop: responsive.responsiveMargin(8), maxHeight: responsive.responsiveHeight(200) },
  dropdownMenu: { borderWidth: 1, borderRadius: 8, marginTop: responsive.responsiveMargin(8), maxHeight: responsive.responsiveHeight(200), overflow: 'hidden' },
  dropdownScroll: { maxHeight: responsive.responsiveHeight(200) },
  dropdownItem: { padding: responsive.responsivePadding(12), borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.05)' },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownItemText: { fontSize: responsive.fontSizes.body, fontFamily: 'Inter' },
  dropdownItemSubtext: { fontSize: responsive.fontSizes.bodySmall, fontFamily: 'Inter', marginTop: responsive.responsiveMargin(4) },
  dropdownSearchInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: responsive.responsivePadding(10), paddingVertical: responsive.responsivePadding(8), marginBottom: responsive.responsiveMargin(4) },
  searchIcon: { marginRight: responsive.responsiveMargin(4) },
  dropdownSearchInputText: { flex: 1, fontSize: responsive.fontSizes.body, fontFamily: 'Inter', marginLeft: responsive.responsiveMargin(8), paddingVertical: 0 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: responsive.responsiveMargin(8) },
  chip: { paddingHorizontal: responsive.responsivePadding(16), paddingVertical: responsive.responsivePadding(8), borderRadius: 20, borderWidth: 1, borderColor: '#E0E0E0' },
  chipText: { fontSize: responsive.fontSizes.bodySmall, fontFamily: 'Inter' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: responsive.responsiveMargin(12) },
  switchTrackSimple: { width: responsive.responsiveWidth(48), height: responsive.responsiveHeight(28), borderRadius: 14, padding: 2 },
  switchThumbSimple: { width: responsive.responsiveWidth(24), height: responsive.responsiveHeight(24), borderRadius: 12, backgroundColor: '#fff' },
  switchLabelSimple: { fontSize: responsive.fontSizes.body, fontFamily: 'Inter' },
  sectionTitle: { fontSize: responsive.responsiveFontSize(18), fontWeight: '700', fontFamily: 'Hanken Grotesk', marginBottom: responsive.responsiveMargin(16) },
  itemForm: { marginBottom: responsive.responsiveMargin(16) },
  stockInfoPanel: { padding: responsive.responsivePadding(12), borderRadius: 8, borderWidth: 1, marginTop: responsive.responsiveMargin(8) },
  stockInfoRow: { marginBottom: responsive.responsiveMargin(4) },
  stockInfoRowLast: { marginBottom: 0 },
  stockInfoText: { fontSize: responsive.fontSizes.bodySmall, fontFamily: 'Inter' },
  stockInfoValue: { fontWeight: '600', fontFamily: 'Inter' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: responsive.responsivePadding(12), borderRadius: 8, gap: responsive.responsiveMargin(8), marginTop: responsive.responsiveMargin(8) },
  addButtonText: { fontSize: responsive.fontSizes.body, fontWeight: '500', fontFamily: 'Inter' },
  itemsList: { gap: responsive.responsiveMargin(12) },
  itemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: responsive.responsivePadding(16), borderRadius: 8, borderWidth: 1 },
  itemInfo: { flex: 1 },
  itemServicio: { fontSize: responsive.fontSizes.body, fontWeight: '600', fontFamily: 'Inter', marginBottom: responsive.responsiveMargin(4) },
  itemCantidad: { fontSize: responsive.fontSizes.bodySmall, fontFamily: 'Inter', marginBottom: responsive.responsiveMargin(4) },
  itemNota: { fontSize: responsive.fontSizes.bodySmall, fontFamily: 'Inter' },
  removeButton: { width: responsive.responsiveWidth(40), height: responsive.responsiveHeight(40), borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionButtons: { flexDirection: 'row', gap: responsive.responsiveMargin(12), marginTop: responsive.responsiveMargin(16) },
  cancelButton: { flex: 1, paddingVertical: responsive.responsivePadding(14), borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  cancelButtonText: { fontSize: responsive.fontSizes.body, fontWeight: '500', fontFamily: 'Inter' },
  saveButton: { flex: 1, paddingVertical: responsive.responsivePadding(14), borderRadius: 8, alignItems: 'center' },
  saveButtonText: { fontSize: responsive.fontSizes.body, fontWeight: '500', fontFamily: 'Inter' },
});

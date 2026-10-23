'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTheme } from '../../../../context/ThemeContext';
import { useAuth } from '../../../../context/AuthContext';
import { useToast } from '../../../../hooks/useToast';
import { useResponsive } from '../../../../hooks/useResponsive';
import { Header } from '../../../../components/layout/Header';
import { Toast } from '../../../../components/common/Toast';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Search, RefreshCw } from 'lucide-react';
import { getTiendas } from '../../../../services/tiendaService';
import { getServicios, getServicioById } from '../../../../services/servicioService';
import { getMovimientoById, updateMovimiento } from '../../../../services/movimientoService';
import { configService } from '../../../../services/configService';

export default function MovimientoEditPage() {
  const router = useRouter();
  const params = useParams();
  const { colors, isDark } = useTheme();
  const { user, movimientoAccessLevels, movimientoManagePermissions } = useAuth();
  const { showToast } = useToast();
  const { isDesktop, isMobile, isTablet } = useResponsive();

  const movimientoId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingMovimiento, setIsFetchingMovimiento] = useState(false);
  const [tiendas, setTiendas] = useState<any[]>([]);
  const [productosOrigen, setProductosOrigen] = useState<any[]>([]);
  const [showTiendaOrigenDropdown, setShowTiendaOrigenDropdown] = useState(false);
  const [showTiendaDestinoDropdown, setShowTiendaDestinoDropdown] = useState(false);
  const [showServicioDropdown, setShowServicioDropdown] = useState(false);
  const [showTipoMovimientoDropdown, setShowTipoMovimientoDropdown] = useState(false);
  const [servicioSearchText, setServicioSearchText] = useState('');
  const [tiendaOrigenSearchText, setTiendaOrigenSearchText] = useState('');
  const [tiendaDestinoSearchText, setTiendaDestinoSearchText] = useState('');
  const [tipoMovimientoSearchText, setTipoMovimientoSearchText] = useState('');

  const predefinedMovimientoTypes = ['Transferencia', 'Ajuste', 'Devolucion'];
  const [customMovimientoTypes, setCustomMovimientoTypes] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    tipo_movimiento: 'Transferencia',
    estado: false,
    nota: '',
    id_tienda_origen: '',
    id_tienda_destino: '',
    tienda_origen: null,
    tienda_destino: null,
    movimientos: [],
  });

  const [movimientoItem, setMovimientoItem] = useState({
    id_servicio: '',
    cantidad: '',
    nota: '',
    servicio_tienda: null,
  });

  const isDarkMode = typeof isDark === 'boolean' ? isDark : isDark === 'true';
  const isAdmin = user?.rol === 'Administrador';
  const userRole = user?.rol?.toLowerCase();
  const userTiendaId = user?.id_tienda;

  // Verificar nivel de acceso a movimientos
  const movimientoAccessLevel = 
    userRole === 'dependiente' ? movimientoAccessLevels?.dependiente :
    userRole === 'almacenero' ? movimientoAccessLevels?.almacenero :
    userRole === 'económico' ? movimientoAccessLevels?.economico : 'all_stores';

  const canManageAllTiendas = isAdmin || movimientoAccessLevel === 'all_stores';
  const canManageOwnTienda = movimientoAccessLevel === 'own_store';
  const shouldHideTiendaOrigen = canManageOwnTienda && !canManageAllTiendas;

  // Load custom movimiento types
  useEffect(() => {
    const loadCustomMovimientoTypes = async () => {
      try {
        const config = await configService.getConfig();
        if (config.customMovimientoTypes) {
          setCustomMovimientoTypes(config.customMovimientoTypes);
        }
      } catch (error) {
        console.error('Error loading custom movimiento types:', error);
      }
    };
    loadCustomMovimientoTypes();
  }, []);

  // Fetch tiendas
  useEffect(() => {
    const fetchTiendas = async () => {
      try {
        const response = await getTiendas({ activo: true });
        setTiendas(response.data || []);
      } catch (error) {
        setTiendas([]);
      }
    };
    fetchTiendas();
  }, []);

  // Fetch movimiento data
  useEffect(() => {
    const fetchCompleteMovimiento = async () => {
      if (movimientoId) {
        try {
          setIsFetchingMovimiento(true);
          const completeMovimiento = await getMovimientoById(movimientoId);
          
          let movimientosArray;
          if (Array.isArray(completeMovimiento.movimientos)) {
            movimientosArray = completeMovimiento.movimientos;
          } else if (completeMovimiento.movimientos && typeof completeMovimiento.movimientos === 'object') {
            movimientosArray = [completeMovimiento.movimientos];
          } else {
            movimientosArray = [];
          }
          
          const tiendaOrigen = movimientosArray[0]?.servicioTiendaOrigen?.tienda ||
                             completeMovimiento.tienda_origen;
          const tiendaDestino = movimientosArray[0]?.servicioTiendaDestino?.tienda ||
                              completeMovimiento.tienda_destino;
          
          const movimientosPromises = movimientosArray.map(async (mov: any) => {
            let servicioId = mov.servicioTiendaOrigen?.servicio?.id_servicio || 
                           mov.servicio?.id_servicio || 
                           mov.id_servicio;
            
            if (!servicioId && mov.id_servicio_tienda_origen) {
              try {
                const servicioTienda = await getServicioById(mov.id_servicio_tienda_origen);
                servicioId = servicioTienda?.servicio?.id_servicio;
              } catch (err) {
                console.error('Error fetching servicio_tienda:', err);
              }
            }
            
            if (!servicioId) {
              console.error('Servicio ID not found in movimiento:', mov);
              return null;
            }
            const servicio = await getServicioById(servicioId);
            
            const tiendaServicioOrigen = servicio.tiendas_servicio?.find(
              (ts: any) => ts.id_tienda === completeMovimiento.id_tienda_origen
            );
            
            return {
              id_servicio: servicioId,
              cantidad: mov.cantidad,
              nota: mov.nota || '',
              servicio_tienda: tiendaServicioOrigen || {
                id_servicio_tienda: null,
                servicio: servicio,
                cantidad: mov.cantidad,
              },
            };
          });
          
          const movimientosConServicio = await Promise.all(movimientosPromises);
          const movimientosFiltrados = movimientosConServicio.filter(m => m !== null);

          setFormData({
            tipo_movimiento: completeMovimiento.tipo_movimiento || 'Transferencia',
            estado: completeMovimiento.estado ?? true,
            nota: completeMovimiento.nota || '',
            id_tienda_origen: completeMovimiento.id_tienda_origen?.toString() || tiendaOrigen?.id_tienda?.toString(),
            id_tienda_destino: completeMovimiento.id_tienda_destino?.toString() || tiendaDestino?.id_tienda?.toString(),
            tienda_origen: tiendaOrigen,
            tienda_destino: tiendaDestino,
            movimientos: movimientosFiltrados,
          });
        } catch (err: any) {
          console.error('Error fetching movimiento:', err);
          showToast({ type: 'error', message: 'Error al cargar movimiento' });
        } finally {
          setIsFetchingMovimiento(false);
        }
      }
    };
    fetchCompleteMovimiento();
  }, [movimientoId]);

  // Fetch productos cuando cambia tienda origen
  useEffect(() => {
    const fetchProductosOrigen = async () => {
      try {
        if (!formData.id_tienda_origen) {
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
        const soloProductos = servicios.filter((servicio: any) => servicio.producto !== null);
        const productosOrigen = soloProductos.map((servicio: any) => {
          const tiendaServicio = servicio.tiendas_servicio?.find((ts: any) => ts.id_tienda === parseInt(formData.id_tienda_origen));
          return {
            id_servicio_tienda: tiendaServicio?.id_servicio_tienda || servicio.id_servicio,
            servicio: servicio,
            cantidad: tiendaServicio?.cantidad || 0,
          };
        });
        setProductosOrigen(productosOrigen);
      } catch (error) {
        setProductosOrigen([]);
      }
    };
    fetchProductosOrigen();
  }, [formData.id_tienda_origen]);

  // Helper function to filter tiendas
  const getFilteredTiendas = (type: 'origen' | 'destino') => {
    let filteredTiendas = tiendas;

    if (isAdmin) {
      filteredTiendas = tiendas;
    } else if (canManageOwnTienda && !canManageAllTiendas) {
      if (type === 'origen') {
        filteredTiendas = tiendas.filter(tienda => tienda.id_tienda === userTiendaId);
      } else if (type === 'destino') {
        filteredTiendas = tiendas;
      }
    }

    // Prevent selecting the same tienda as both origen and destino
    if (type === 'origen' && formData.id_tienda_destino) {
      filteredTiendas = filteredTiendas.filter(tienda => tienda.id_tienda !== parseInt(formData.id_tienda_destino));
    } else if (type === 'destino' && formData.id_tienda_origen) {
      filteredTiendas = filteredTiendas.filter(tienda => tienda.id_tienda !== parseInt(formData.id_tienda_origen));
    }

    return filteredTiendas;
  };

  const handleAddMovimientoItem = () => {
    if (!movimientoItem.cantidad || parseFloat(movimientoItem.cantidad) <= 0) {
      showToast({ type: 'warning', message: 'La cantidad debe ser mayor a 0' });
      return;
    }
    if (!movimientoItem.id_servicio) {
      showToast({ type: 'warning', message: 'Debe seleccionar un servicio' });
      return;
    }
    
    const productoSeleccionado = productosOrigen.find(p => p.id_servicio_tienda === movimientoItem.id_servicio);
    if (productoSeleccionado) {
      const stockActual = productoSeleccionado.cantidad || 0;
      const cantidadSolicitada = parseFloat(movimientoItem.cantidad);
      
      if (cantidadSolicitada > stockActual) {
        showToast({ 
          type: 'error', 
          message: `El stock actual es ${stockActual}. No puede solicitar ${cantidadSolicitada}` 
        });
        return;
      }
    }
    
    const newItem = {
      cantidad: parseFloat(movimientoItem.cantidad),
      nota: movimientoItem.nota,
      id_servicio: parseInt(movimientoItem.id_servicio),
      servicio_tienda: movimientoItem.servicio_tienda,
    };
    setFormData(prev => ({ ...prev, movimientos: [...prev.movimientos, newItem] }));
    setMovimientoItem({ cantidad: '', nota: '', id_servicio: '', servicio_tienda: null });
  };

  const handleRemoveMovimientoItem = (index: number) => {
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

    setIsSubmitting(true);
    try {
      const movimientosItems = formData.movimientos.map((item: any) => {
        const idServicio = parseInt(item.servicio_tienda?.servicio?.id_servicio || item.id_servicio);
        if (isNaN(idServicio)) {
          throw new Error(`id_servicio no es válido`);
        }
        return {
          id_servicio: idServicio,
          cantidad: item.cantidad,
          nota: item.nota || '',
        };
      });

      const idUsuario = parseInt(user.id_usuario);
      if (isNaN(idUsuario)) {
        throw new Error('id_usuario no es válido');
      }

      const movimientoData = {
        tipo_movimiento: formData.tipo_movimiento,
        estado: formData.estado,
        nota: formData.nota || '',
        id_tienda_origen: parseInt(formData.id_tienda_origen),
        id_tienda_destino: parseInt(formData.id_tienda_destino),
        movimientos: movimientosItems,
        id_usuario: idUsuario,
      };

      await updateMovimiento(movimientoId, movimientoData);
      showToast({ type: 'success', message: 'Movimiento actualizado correctamente' });
      router.push('/movimientos');
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Error al actualizar movimiento' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatNumber = (value: any) => {
    if (value === null || value === undefined || value === '') return '0.00';
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00';
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${integerPart}.${parts[1]}`;
  };

  if (isFetchingMovimiento) {
    return (
      <div 
        className="min-h-screen"
        style={{ backgroundColor: colors.background }}
      >
        <Header 
          showBackButton={true}
          onBackPress={() => router.push('/movimientos')}
          isDark={isDarkMode}
          title="Editar Movimiento"
          showLogo={false}
          hideUserIcon={true}
        />
        <div 
          style={{ 
            marginTop: '80px',
            marginRight: 'auto',
            marginBottom: '0',
            marginLeft: 'auto',
            paddingTop: isMobile ? '20px' : isTablet ? '32px' : '20px',
            paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
            paddingBottom: '40px',
            paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
            maxWidth: isDesktop ? '900px' : '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div className="flex flex-col items-center">
            <RefreshCw size={40} className="animate-spin" style={{ color: colors.primary, marginBottom: 16 }} />
            <p style={{ color: colors.outline }}>Cargando datos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: colors.background }}
    >
      <Header 
        showBackButton={true}
        onBackPress={() => router.push('/movimientos')}
        isDark={isDarkMode}
        title="Editar Movimiento"
        showLogo={false}
        hideUserIcon={true}
      />

      <div style={{ 
        marginTop: '80px',
        marginRight: 'auto',
        marginBottom: '0',
        marginLeft: 'auto',
        paddingTop: isMobile ? '20px' : isTablet ? '32px' : '20px',
        paddingRight: isMobile ? '20px' : isTablet ? '32px' : '40px',
        paddingBottom: '40px',
        paddingLeft: isMobile ? '20px' : isTablet ? '32px' : '40px',
        maxWidth: isDesktop ? '900px' : '100%',
      }}>
        {/* Form Card */}
        <div 
          className="rounded-2xl p-5 mb-6 shadow-lg"
          style={{ backgroundColor: colors.surface }}
        >
          {/* Tipo de Movimiento */}
          <div className="mb-4">
            <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Tipo de Movimiento *</label>
            <div className="relative">
              <button
                className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                style={{ 
                  backgroundColor: colors.background, 
                  borderColor: colors.outlineVariant,
                  color: formData.tipo_movimiento ? colors.onSurface : colors.outline
                }}
                onClick={() => setShowTipoMovimientoDropdown(!showTipoMovimientoDropdown)}
              >
                <span>{formData.tipo_movimiento || 'Seleccionar o escribir tipo...'}</span>
                {showTipoMovimientoDropdown ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
              </button>
              {showTipoMovimientoDropdown && (
                <div 
                  className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10 max-h-60 overflow-y-auto"
                  style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                >
                  <div className="p-2">
                    <input
                      type="text"
                      className="w-full p-2 rounded-lg border-2"
                      style={{ 
                        backgroundColor: colors.background, 
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant
                      }}
                      placeholder="Buscar o escribir nuevo..."
                      value={tipoMovimientoSearchText}
                      onChange={(e) => setTipoMovimientoSearchText(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {[...predefinedMovimientoTypes, ...customMovimientoTypes]
                    .filter(t => t.toLowerCase().includes(tipoMovimientoSearchText.toLowerCase()))
                    .map((type) => (
                      <button
                        key={type}
                        className="w-full p-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, tipo_movimiento: type }));
                          setShowTipoMovimientoDropdown(false);
                          setTipoMovimientoSearchText('');
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  {tipoMovimientoSearchText && ![...predefinedMovimientoTypes, ...customMovimientoTypes].includes(tipoMovimientoSearchText) && (
                    <button
                      className="w-full p-3 text-left hover:bg-black/5"
                      style={{ color: colors.primary }}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, tipo_movimiento: tipoMovimientoSearchText }));
                        setShowTipoMovimientoDropdown(false);
                        setTipoMovimientoSearchText('');
                      }}
                    >
                      Crear "{tipoMovimientoSearchText}"
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Estado */}
          <div className="mb-4">
            <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Estado</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => isAdmin && setFormData(prev => ({ ...prev, estado: !prev.estado }))}
                disabled={!isAdmin}
                className="relative w-12 h-6 rounded-full transition-colors"
                style={{ 
                  backgroundColor: formData.estado ? '#4CAF50' : colors.outlineVariant,
                  opacity: !isAdmin ? 0.6 : 1
                }}
              >
                <div 
                  className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ 
                    left: formData.estado ? '28px' : '4px',
                    transform: 'translateX(0)'
                  }} 
                />
              </button>
              <span style={{ 
                color: formData.estado ? '#4CAF50' : '#F44336', 
                fontWeight: '600',
                fontSize: '14px'
              }}>
                {formData.estado ? 'Completado' : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* Tienda Origen */}
          <div className="mb-4">
            <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Tienda Origen *</label>
            {shouldHideTiendaOrigen ? (
              <div
                className="p-3 rounded-lg border-2"
                style={{ 
                  backgroundColor: colors.background, 
                  borderColor: colors.outlineVariant,
                  color: colors.onSurface
                }}
              >
                {formData.tienda_origen?.nombre || 'N/A'}
              </div>
            ) : (
              <div className="relative">
                <button
                  className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                  style={{ 
                    backgroundColor: colors.background, 
                    borderColor: colors.outlineVariant,
                    color: colors.onSurface
                  }}
                  onClick={() => setShowTiendaOrigenDropdown(!showTiendaOrigenDropdown)}
                >
                  <span>{formData.tienda_origen?.nombre || 'Seleccionar...'}</span>
                  {showTiendaOrigenDropdown ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
                </button>
                {showTiendaOrigenDropdown && (
                  <div 
                    className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10 max-h-60 overflow-y-auto"
                    style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                  >
                    {getFilteredTiendas('origen').map((tienda) => (
                      <button
                        key={tienda.id_tienda}
                        className="w-full p-3 text-left hover:bg-black/5"
                        style={{ color: colors.onSurface }}
                        onClick={() => {
                          setFormData(prev => ({ 
                            ...prev, 
                            id_tienda_origen: tienda.id_tienda.toString(), 
                            tienda_origen: tienda 
                          }));
                          setShowTiendaOrigenDropdown(false);
                        }}
                      >
                        {tienda.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tienda Destino */}
          <div className="mb-4">
            <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Tienda Destino *</label>
            <div className="relative">
              <button
                className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                style={{ 
                  backgroundColor: colors.background, 
                  borderColor: colors.outlineVariant,
                  color: formData.tienda_destino?.nombre ? colors.onSurface : colors.outline
                }}
                onClick={() => setShowTiendaDestinoDropdown(!showTiendaDestinoDropdown)}
              >
                <span>{formData.tienda_destino?.nombre || 'Seleccionar...'}</span>
                {showTiendaDestinoDropdown ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
              </button>
              {showTiendaDestinoDropdown && (
                <div 
                  className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10 max-h-60 overflow-y-auto"
                  style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                >
                  {getFilteredTiendas('destino').map((tienda) => (
                    <button
                      key={tienda.id_tienda}
                      className="w-full p-3 text-left hover:bg-black/5"
                      style={{ color: colors.onSurface }}
                      onClick={() => {
                        setFormData(prev => ({ 
                          ...prev, 
                          id_tienda_destino: tienda.id_tienda.toString(), 
                          tienda_destino: tienda 
                        }));
                        setShowTiendaDestinoDropdown(false);
                      }}
                    >
                      {tienda.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Nota */}
          <div className="mb-4">
            <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Nota</label>
            <textarea
              className="w-full p-3 rounded-lg border-2"
              style={{ 
                backgroundColor: colors.background, 
                color: colors.onSurface,
                borderColor: colors.outlineVariant,
                minHeight: '80px'
              }}
              placeholder="Descripción del movimiento..."
              value={formData.nota}
              onChange={(e) => setFormData(prev => ({ ...prev, nota: e.target.value }))}
            />
          </div>
        </div>

        {/* Productos Card */}
        <div 
          className="rounded-2xl p-5 mb-6 shadow-lg"
          style={{ backgroundColor: colors.surface }}
        >
          <h2 style={{ color: colors.onSurface, fontSize: '18px', fontWeight: '700', marginBottom: '16px', fontFamily: 'Hanken Grotesk, sans-serif' }}>
            Productos en Movimiento
          </h2>

          {/* Add Product Form */}
          <div className="mb-4">
            <div className="flex gap-3">
              <div style={{ flex: 0.7 }}>
                <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Producto *</label>
                <div className="relative">
                  <button
                    className="w-full p-3 rounded-lg border-2 flex justify-between items-center"
                    style={{ 
                      backgroundColor: colors.background, 
                      borderColor: colors.outlineVariant,
                      color: movimientoItem.servicio_tienda?.servicio?.nombre ? colors.onSurface : colors.outline
                    }}
                    onClick={() => {
                      if (!formData.id_tienda_origen) {
                        showToast({ type: 'warning', message: 'Seleccione primero la tienda de origen' });
                      } else {
                        setShowServicioDropdown(!showServicioDropdown);
                      }
                    }}
                  >
                    <span>{movimientoItem.servicio_tienda?.servicio?.nombre || 'Seleccionar...'}</span>
                    {showServicioDropdown ? <ChevronUp size={20} color={colors.primary} /> : <ChevronDown size={20} color={colors.primary} />}
                  </button>
                  {showServicioDropdown && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-2 rounded-lg border-2 z-10 max-h-60 overflow-y-auto"
                      style={{ backgroundColor: colors.surface, borderColor: colors.outlineVariant }}
                    >
                      <div className="p-2 flex items-center gap-2" style={{ backgroundColor: colors.background, borderColor: colors.outlineVariant }}>
                        <Search size={18} color={colors.outline} />
                        <input
                          type="text"
                          className="w-full p-2 rounded-lg border-2"
                          style={{ 
                            backgroundColor: 'transparent',
                            color: colors.onSurface,
                            borderColor: 'transparent'
                          }}
                          placeholder="Buscar producto..."
                          value={servicioSearchText}
                          onChange={(e) => setServicioSearchText(e.target.value)}
                        />
                      </div>
                      {productosOrigen
                        .filter(p => p.servicio?.nombre?.toLowerCase().includes(servicioSearchText.toLowerCase()))
                        .filter(p => !formData.movimientos.some((m: any) => 
                          m.id_servicio === p.id_servicio_tienda || 
                          m.servicio_tienda?.servicio?.id_servicio === p.servicio?.id_servicio
                        ))
                        .length > 0 ? (
                        productosOrigen
                          .filter(p => p.servicio?.nombre?.toLowerCase().includes(servicioSearchText.toLowerCase()))
                          .filter(p => !formData.movimientos.some((m: any) => 
                            m.id_servicio === p.id_servicio_tienda || 
                            m.servicio_tienda?.servicio?.id_servicio === p.servicio?.id_servicio
                          ))
                          .map((producto) => (
                            <button
                              key={producto.id_servicio_tienda}
                              className="w-full p-3 text-left hover:bg-black/5"
                              style={{ color: colors.onSurface }}
                              onClick={() => {
                                setMovimientoItem(prev => ({ 
                                  ...prev, 
                                  id_servicio: producto.id_servicio_tienda.toString(), 
                                  servicio_tienda: producto 
                                }));
                                setShowServicioDropdown(false);
                                setServicioSearchText('');
                              }}
                            >
                              {producto.servicio?.nombre}
                            </button>
                          ))
                        ) : (
                          <div className="p-3" style={{ color: colors.outline }}>
                            No se encontraron productos
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ flex: 0.3 }}>
                <label style={{ color: colors.outline, fontSize: '14px', marginBottom: '8px', display: 'block' }}>Cantidad *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full p-3 rounded-lg border-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    color: colors.onSurface,
                    borderColor: colors.outlineVariant
                  }}
                  placeholder="0.00"
                  value={movimientoItem.cantidad}
                  onChange={(e) => setMovimientoItem(prev => ({ ...prev, cantidad: e.target.value }))}
                />
              </div>
            </div>

            {/* Stock Info Panel */}
            {movimientoItem.servicio_tienda && (
              <div 
                className="p-3 rounded-lg border-2 mt-2"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(76, 175, 80, 0.1)' : '#E8F5E9', 
                  borderColor: '#4CAF50' 
                }}
              >
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: colors.onSurface, fontSize: '14px' }}>
                    Stock actual: <span style={{ color: '#4CAF50', fontWeight: '600' }}>{formatNumber(movimientoItem.servicio_tienda.cantidad)}</span>
                  </span>
                </div>
                <div>
                  <span style={{ color: colors.onSurface, fontSize: '14px' }}>
                    Stock después del movimiento: <span style={{ 
                      color: movimientoItem.cantidad && parseFloat(movimientoItem.cantidad) > movimientoItem.servicio_tienda.cantidad ? '#F44336' : '#4CAF50',
                      fontWeight: '600'
                    }}>
                      {movimientoItem.cantidad ? formatNumber(Math.max(0, movimientoItem.servicio_tienda.cantidad - parseFloat(movimientoItem.cantidad))) : formatNumber(movimientoItem.servicio_tienda.cantidad)}
                    </span>
                  </span>
                </div>
              </div>
            )}

            <button
              className="flex items-center justify-center gap-2 w-full p-3 rounded-lg mt-3"
              style={{ backgroundColor: colors.primary, color: '#fff' }}
              onClick={handleAddMovimientoItem}
            >
              <Plus size={20} />
              <span>Agregar Producto</span>
            </button>
          </div>

          {/* Items List */}
          {formData.movimientos.length > 0 && (
            <div className="space-y-3">
              {formData.movimientos.map((item: any, index: number) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-4 rounded-lg border-2"
                  style={{ 
                    backgroundColor: colors.background, 
                    borderColor: colors.outlineVariant 
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ color: colors.onSurface, fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>
                      {item.servicio_tienda?.servicio?.nombre || 'N/A'}
                    </div>
                    <div style={{ color: colors.primary, fontSize: '14px' }}>
                      Cantidad: {formatNumber(item.cantidad)}
                    </div>
                  </div>
                  <button
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: isDarkMode ? colors.errorContainer : '#FFEBEE' }}
                    onClick={() => handleRemoveMovimientoItem(index)}
                  >
                    <Trash2 size={20} style={{ color: colors.error }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            className="flex-1 p-4 rounded-lg border-2"
            style={{ 
              backgroundColor: colors.surface, 
              borderColor: colors.outlineVariant,
              color: colors.onSurface
            }}
            onClick={() => router.push('/movimientos')}
          >
            Cancelar
          </button>
          <button
            className="flex-1 p-4 rounded-lg"
            style={{ backgroundColor: colors.primary, color: '#fff' }}
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <Toast />
    </div>
  );
}

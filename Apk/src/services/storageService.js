import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServicios } from './servicioService';
import { getProductos } from './productoService';
import { getTiendas } from './tiendaService';

const SERVICIOS_KEY = '@abacus_servicios';
const PRODUCTOS_KEY = '@abacus_productos';
const TIENDAS_KEY = '@abacus_tiendas';
const VENTAS_KEY = '@abacus_ventas';
const HAS_OFFLINE_DATA_KEY = '@abacus_has_offline_data';

export const storageService = {
  // Guardar servicios en AsyncStorage
  saveServicios: async (servicios) => {
    try {
      await AsyncStorage.setItem(SERVICIOS_KEY, JSON.stringify(servicios));
      await AsyncStorage.setItem(HAS_OFFLINE_DATA_KEY, 'true');
      return true;
    } catch (error) {
      return false;
    }
  },

  // Obtener servicios de AsyncStorage
  getServicios: async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(SERVICIOS_KEY);
      return jsonValue !== null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      return [];
    }
  },

  // Verificar si hay datos offline disponibles
  hasOfflineData: async () => {
    try {
      const hasData = await AsyncStorage.getItem(HAS_OFFLINE_DATA_KEY);
      return hasData === 'true';
    } catch (error) {
      return false;
    }
  },

  // Sincronizar todos los datos desde el servidor y guardarlos localmente
  syncAllData: async (user = null, permissions = null) => {
    try {
      // Limpiar datos anteriores antes de guardar nuevos
      await storageService.clearOfflineData();

      // Obtener todas las tiendas
      const tiendasData = await getTiendas({}, 1, 1000);
      let tiendas = tiendasData.data || [];
      
      // Aplicar filtrado por permisos para tiendas (misma lógica que ServiciosScreen)
      if (user && permissions) {
        const userRole = user.rol?.toLowerCase();
        const canViewAllStores = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && permissions?.dependiente) ||
          (userRole === 'almacenero' && permissions?.almacenero) ||
          (userRole === 'económico' && permissions?.economico);

        // Si el usuario no puede ver todas las tiendas, mostrar solo su tienda
        if (!canViewAllStores && user?.id_tienda) {
          const userTienda = tiendas.find(t => t.id_tienda === user.id_tienda);
          tiendas = userTienda ? [userTienda] : [];
        }
      }
      
      await storageService.saveTiendas(tiendas);

      // Obtener todos los servicios (incluyendo productos y sus relaciones de ofertas)
      // Sin filtros para obtener todos los servicios
      // fetchProducto: 'true' es CRUCIAL para incluir servicios vendibles (que tienen productos)
      const serviciosData = await getServicios({ fetchProducto: 'true', esvendible: '' }, 1, 10000);
      let servicios = serviciosData.data || [];
      
      // Aplicar filtrado por permisos (misma lógica que ServiciosScreen)
      if (user && permissions) {
        const userRole = user.rol?.toLowerCase();
        const canViewAllStores = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && permissions?.dependiente) ||
          (userRole === 'almacenero' && permissions?.almacenero) ||
          (userRole === 'económico' && permissions?.economico);

        // Si el usuario no puede ver todas las tiendas, filtrar por su tienda
        if (!canViewAllStores && user?.id_tienda) {
          servicios = servicios.filter(s => {
            return s.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
          });
        }
      }
      
      await storageService.saveServicios(servicios);

      // Obtener todos los productos
      const productosData = await getProductos({ esvendible: '' }, 1, 10000);
      let productos = productosData.data || [];
      
      // Aplicar filtrado por permisos (misma lógica que ProductosScreen)
      if (user && permissions) {
        const userRole = user.rol?.toLowerCase();
        const canViewAllStores = 
          userRole === 'administrador' ||
          (userRole === 'dependiente' && permissions?.dependiente) ||
          (userRole === 'almacenero' && permissions?.almacenero) ||
          (userRole === 'económico' && permissions?.economico);

        // Si el usuario no puede ver todas las tiendas, filtrar por su tienda
        if (!canViewAllStores && user?.id_tienda) {
          productos = productos.filter(p => {
            return p.tiendas_servicio?.some(ts => ts.id_tienda === user.id_tienda);
          });
        }
      }
      
      await storageService.saveProductos(productos);

      return { success: true, serviciosCount: servicios.length, productosCount: productos.length, tiendasCount: tiendas.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Limpiar todos los datos offline
  clearOfflineData: async () => {
    try {
      await AsyncStorage.multiRemove([SERVICIOS_KEY, PRODUCTOS_KEY, TIENDAS_KEY, HAS_OFFLINE_DATA_KEY]);
      return true;
    } catch (error) {
      return false;
    }
  },

  // Guardar productos en AsyncStorage
  saveProductos: async (productos) => {
    try {
      await AsyncStorage.setItem(PRODUCTOS_KEY, JSON.stringify(productos));
      return true;
    } catch (error) {
      return false;
    }
  },

  // Obtener productos de AsyncStorage
  getProductos: async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(PRODUCTOS_KEY);
      return jsonValue !== null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      return [];
    }
  },

  // Filtrar productos localmente (para modo offline)
  filterProductosLocal: async (filters = {}) => {
    try {
      const allProductos = await storageService.getProductos();
      
      let filtered = allProductos;

      if (filters.nombre) {
        filtered = filtered.filter(p => 
          p.nombre?.toLowerCase().includes(filters.nombre.toLowerCase())
        );
      }

      if (filters.codigo) {
        filtered = filtered.filter(p => 
          p.codigos?.some(c => c.codigo_barras_ean?.toLowerCase().includes(filters.codigo.toLowerCase()))
        );
      }

      if (filters.categoria) {
        filtered = filtered.filter(p => 
          p.categoria?.toLowerCase() === filters.categoria.toLowerCase()
        );
      }

      if (filters.esvendible !== '') {
        const esVendible = filters.esvendible === 'true';
        filtered = filtered.filter(p => p.esvendible === esVendible);
      }

      if (filters.id_tienda) {
        filtered = filtered.filter(p => 
          p.tiendas_servicio?.some(ts => ts.id_tienda === parseInt(filters.id_tienda))
        );
      }

      if (filters.cantidad_min !== '' && filters.cantidad_min !== undefined) {
        const minCantidad = parseFloat(filters.cantidad_min);
        filtered = filtered.filter(p => {
          if (filters.id_tienda) {
            // Filter by specific tienda quantity
            const tiendaServicio = p.tiendas_servicio?.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
            return tiendaServicio && parseFloat(tiendaServicio.cantidad) >= minCantidad;
          } else {
            // Filter by total quantity across all tiendas
            const totalCantidad = p.tiendas_servicio?.reduce((sum, ts) => sum + (parseFloat(ts.cantidad) || 0), 0) || 0;
            return totalCantidad >= minCantidad;
          }
        });
      }

      if (filters.cantidad_max !== '' && filters.cantidad_max !== undefined) {
        const maxCantidad = parseFloat(filters.cantidad_max);
        filtered = filtered.filter(p => {
          if (filters.id_tienda) {
            // Filter by specific tienda quantity
            const tiendaServicio = p.tiendas_servicio?.find(ts => ts.id_tienda === parseInt(filters.id_tienda));
            return tiendaServicio && parseFloat(tiendaServicio.cantidad) <= maxCantidad;
          } else {
            // Filter by total quantity across all tiendas
            const totalCantidad = p.tiendas_servicio?.reduce((sum, ts) => sum + (parseFloat(ts.cantidad) || 0), 0) || 0;
            return totalCantidad <= maxCantidad;
          }
        });
      }

      return filtered;
    } catch (error) {
      return [];
    }
  },

  // Guardar tiendas en AsyncStorage
  saveTiendas: async (tiendas) => {
    try {
      await AsyncStorage.setItem(TIENDAS_KEY, JSON.stringify(tiendas));
      return true;
    } catch (error) {
      return false;
    }
  },

  // Obtener tiendas de AsyncStorage
  getTiendas: async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(TIENDAS_KEY);
      return jsonValue !== null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      return [];
    }
  },

  // Guardar ventas en AsyncStorage
  saveVentas: async (ventas) => {
    try {
      await AsyncStorage.setItem(VENTAS_KEY, JSON.stringify(ventas));
      return true;
    } catch (error) {
      return false;
    }
  },

  // Obtener ventas de AsyncStorage
  getVentas: async (filters = {}, page = 1, limit = 10) => {
    try {
      const jsonValue = await AsyncStorage.getItem(VENTAS_KEY);
      let ventas = jsonValue !== null ? JSON.parse(jsonValue) : [];
      
      // Apply filters
      if (filters.nota) {
        ventas = ventas.filter(v => 
          v.nota?.toLowerCase().includes(filters.nota.toLowerCase())
        );
      }

      if (filters.id_tienda) {
        ventas = ventas.filter(v => 
          v.usuario?.tienda?.id_tienda === parseInt(filters.id_tienda)
        );
      }

      if (filters.id_usuario) {
        ventas = ventas.filter(v => 
          v.usuario?.id_usuario === parseInt(filters.id_usuario)
        );
      }

      if (filters.fecha_desde) {
        const fechaDesde = new Date(filters.fecha_desde);
        ventas = ventas.filter(v => 
          new Date(v.fecha_hora) >= fechaDesde
        );
      }

      if (filters.fecha_hasta) {
        const fechaHasta = new Date(filters.fecha_hasta);
        ventas = ventas.filter(v => 
          new Date(v.fecha_hora) <= fechaHasta
        );
      }

      if (filters.cantidad_min !== '' && filters.cantidad_min !== undefined) {
        const minCantidad = parseFloat(filters.cantidad_min);
        ventas = ventas.filter(v => 
          (parseFloat(v.cantidad_cobrada_efectivo_cup) || 0) >= minCantidad
        );
      }

      if (filters.cantidad_max !== '' && filters.cantidad_max !== undefined) {
        const maxCantidad = parseFloat(filters.cantidad_max);
        ventas = ventas.filter(v => 
          (parseFloat(v.cantidad_cobrada_efectivo_cup) || 0) <= maxCantidad
        );
      }

      // Pagination
      const total = ventas.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const paginatedVentas = ventas.slice(startIndex, startIndex + limit);

      return {
        data: paginatedVentas,
        pagination: {
          total,
          totalPages,
          currentPage: page,
          limit
        }
      };
    } catch (error) {
      return {
        data: [],
        pagination: {
          total: 0,
          totalPages: 1,
          currentPage: 1,
          limit
        }
      };
    }
  },

  // Eliminar venta localmente
  deleteVenta: async (id) => {
    try {
      const jsonValue = await AsyncStorage.getItem(VENTAS_KEY);
      let ventas = jsonValue !== null ? JSON.parse(jsonValue) : [];
      ventas = ventas.filter(v => v.id_lista_venta !== id);
      await AsyncStorage.setItem(VENTAS_KEY, JSON.stringify(ventas));
      return true;
    } catch (error) {
      return false;
    }
  },

  // Filtrar servicios localmente (para modo offline)
  filterServiciosLocal: async (filters = {}) => {
    try {
      const allServicios = await storageService.getServicios();
      
      let filtered = allServicios;

      // Excluir servicios que tienen un producto asociado (productos)
      // Esto es equivalente a fetchProducto: false en el backend
      filtered = filtered.filter(s => !s.producto && !s.hasProducto);

      if (filters.nombre) {
        filtered = filtered.filter(s => 
          s.nombre?.toLowerCase().includes(filters.nombre.toLowerCase())
        );
      }

      if (filters.codigo) {
        filtered = filtered.filter(s => 
          s.codigos?.some(c => c.codigo_barras_ean?.toLowerCase().includes(filters.codigo.toLowerCase()))
        );
      }

      if (filters.categoria) {
        filtered = filtered.filter(s => 
          s.categoria?.toLowerCase() === filters.categoria.toLowerCase()
        );
      }

      if (filters.esvendible !== '') {
        const esVendible = filters.esvendible === 'true';
        filtered = filtered.filter(s => s.esvendible === esVendible);
      }

      if (filters.id_tienda) {
        filtered = filtered.filter(s => 
          s.tiendas_servicio?.some(ts => ts.id_tienda === parseInt(filters.id_tienda))
        );
      }

      return filtered;
    } catch (error) {
      return [];
    }
  },

};

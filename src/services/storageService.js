import AsyncStorage from '@react-native-async-storage/async-storage';
import { getServicios } from './servicioService';
import { getProductos } from './productoService';
import { getTiendas } from './tiendaService';

const SERVICIOS_KEY = '@abacus_servicios';
const PRODUCTOS_KEY = '@abacus_productos';
const TIENDAS_KEY = '@abacus_tiendas';
const HAS_OFFLINE_DATA_KEY = '@abacus_has_offline_data';

export const storageService = {
  // Guardar servicios en AsyncStorage
  saveServicios: async (servicios) => {
    try {
      await AsyncStorage.setItem(SERVICIOS_KEY, JSON.stringify(servicios));
      await AsyncStorage.setItem(HAS_OFFLINE_DATA_KEY, 'true');
      return true;
    } catch (error) {
      console.error('Error guardando servicios en AsyncStorage:', error);
      return false;
    }
  },

  // Obtener servicios de AsyncStorage
  getServicios: async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(SERVICIOS_KEY);
      return jsonValue !== null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('Error leyendo servicios de AsyncStorage:', error);
      return [];
    }
  },

  // Verificar si hay datos offline disponibles
  hasOfflineData: async () => {
    try {
      const hasData = await AsyncStorage.getItem(HAS_OFFLINE_DATA_KEY);
      return hasData === 'true';
    } catch (error) {
      console.error('Error verificando datos offline:', error);
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
          console.log(`Filtrando tiendas por tienda del usuario ${user.id_tienda}: ${tiendas.length} tiendas`);
        }
      }
      
      console.log(`Sincronizando ${tiendas.length} tiendas`);
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
          console.log(`Filtrando por tienda ${user.id_tienda}: ${servicios.length} servicios`);
        }
      }
      
      console.log(`Sincronizando ${servicios.length} servicios`);
      console.log('Muestra de servicios:', servicios.slice(0, 5).map(s => ({
        id: s.id_servicio,
        nombre: s.nombre,
        esvendible: s.esvendible,
        hasProducto: !!s.producto
      })));
      
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
          console.log(`Filtrando productos por tienda ${user.id_tienda}: ${productos.length} productos`);
        }
      }
      
      console.log(`Sincronizando ${productos.length} productos`);
      await storageService.saveProductos(productos);

      return { success: true, serviciosCount: servicios.length, productosCount: productos.length, tiendasCount: tiendas.length };
    } catch (error) {
      console.error('Error sincronizando datos:', error);
      return { success: false, error: error.message };
    }
  },

  // Limpiar todos los datos offline
  clearOfflineData: async () => {
    try {
      await AsyncStorage.multiRemove([SERVICIOS_KEY, PRODUCTOS_KEY, TIENDAS_KEY, HAS_OFFLINE_DATA_KEY]);
      return true;
    } catch (error) {
      console.error('Error limpiando datos offline:', error);
      return false;
    }
  },

  // Guardar productos en AsyncStorage
  saveProductos: async (productos) => {
    try {
      await AsyncStorage.setItem(PRODUCTOS_KEY, JSON.stringify(productos));
      return true;
    } catch (error) {
      console.error('Error guardando productos en AsyncStorage:', error);
      return false;
    }
  },

  // Obtener productos de AsyncStorage
  getProductos: async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(PRODUCTOS_KEY);
      return jsonValue !== null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('Error leyendo productos de AsyncStorage:', error);
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

      return filtered;
    } catch (error) {
      console.error('Error filtrando productos localmente:', error);
      return [];
    }
  },

  // Guardar tiendas en AsyncStorage
  saveTiendas: async (tiendas) => {
    try {
      await AsyncStorage.setItem(TIENDAS_KEY, JSON.stringify(tiendas));
      return true;
    } catch (error) {
      console.error('Error guardando tiendas en AsyncStorage:', error);
      return false;
    }
  },

  // Obtener tiendas de AsyncStorage
  getTiendas: async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(TIENDAS_KEY);
      return jsonValue !== null ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('Error leyendo tiendas de AsyncStorage:', error);
      return [];
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
      console.error('Error filtrando servicios localmente:', error);
      return [];
    }
  },

};

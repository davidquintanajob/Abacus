import api from './api';

export const getProductos = async (filters = {}, page = 1, limit = 10) => {
  try {
    // Build query params manually to avoid double encoding with URLSearchParams
    const params = new Map();
    params.set('limit', limit.toString());
    params.set('page', page.toString());

    // Add filters with proper encoding
    if (filters.nombre) params.set('nombre', encodeURIComponent(filters.nombre));
    if (filters.codigo) params.set('codigo', encodeURIComponent(filters.codigo));
    if (filters.categoria) params.set('categoria', encodeURIComponent(filters.categoria));
    if (!filters.skipEsvendible && filters.esvendible !== '') params.set('esvendible', filters.esvendible === 'true' ? true : false);
    if (filters.id_tienda) params.set('id_tienda', filters.id_tienda);
    if (filters.cantidad_min !== undefined && filters.cantidad_min !== '') params.set('cantidad_min', filters.cantidad_min);
    if (filters.cantidad_max !== undefined && filters.cantidad_max !== '') params.set('cantidad_max', filters.cantidad_max);

    // If no store filter is selected, add a dummy cantidad_min=0 to force backend to include tiendas_servicio
    // Skip this if skipCantidadMin flag is set (used for product search in entrada form)
    if (!filters.skipCantidadMin && !filters.id_tienda && filters.cantidad_min === undefined && filters.cantidad_max === undefined) {
      params.set('cantidad_min', '0');
    }

    // Convert Map to query string manually
    const queryString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    const response = await api.get(`/producto/filter?${queryString}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener productos';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getProductoById = async (id) => {
  try {
    const response = await api.get(`/producto/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos del producto';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createProducto = async (productoData) => {
  try {
    const response = await api.post('/producto', productoData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear producto';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateProducto = async (id, productoData) => {
  try {
    const response = await api.put(`/producto/${id}`, productoData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar producto';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getProductoByCodigo = async (codigo) => {
  try {
    // Use the filter endpoint with codigo parameter
    const response = await api.get(`/producto/filter?codigo=${encodeURIComponent(codigo)}&limit=1`);
    const data = response.data;
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
    throw new Error('Producto no encontrado');
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener producto por código';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getProductosEnAlerta = async (id_tienda) => {
  try {
    const queryParams = new URLSearchParams();
    if (id_tienda) queryParams.append('id_tienda', id_tienda);
    
    const response = await api.get(`/producto/alerta?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener productos en alerta';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteProducto = async (id) => {
  try {
    const response = await api.delete(`/servicio/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] ||
                        error.response?.data?.message ||
                        error.message ||
                        'Error al eliminar producto';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getSeguimientoInventario = async (idProducto, idTienda, fechaDesde, fechaHasta) => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append('id_tienda', idTienda);
    queryParams.append('fecha_desde', fechaDesde);
    queryParams.append('fecha_hasta', fechaHasta);

    const response = await api.get(`/producto/${idProducto}/seguimiento-inventario?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] ||
                        error.response?.data?.message ||
                        error.message ||
                        'Error al obtener seguimiento de inventario';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

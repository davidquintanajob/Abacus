import api from './api';

export const getProductos = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nombre) queryParams.append('nombre', filters.nombre);
    if (filters.codigo) queryParams.append('codigo', filters.codigo);
    if (filters.categoria) queryParams.append('categoria', filters.categoria);
    if (filters.esvendible !== '') queryParams.append('esvendible', filters.esvendible === 'true' ? true : false);
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);
    if (filters.cantidad_min !== undefined) queryParams.append('cantidad_min', filters.cantidad_min);
    if (filters.cantidad_max !== undefined) queryParams.append('cantidad_max', filters.cantidad_max);

    console.log('getProductos queryParams:', queryParams.toString());
    const response = await api.get(`/producto/filter?${queryParams}`);
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
    console.log('createProducto llamado con datos:', JSON.stringify(productoData, null, 2));
    const response = await api.post('/producto', productoData);
    console.log('Respuesta del servidor:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error en createProducto:', error);
    console.error('Error response:', error.response?.data);
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

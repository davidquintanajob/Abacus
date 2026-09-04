import api from './api';

export const getVentas = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nota) queryParams.append('nota', filters.nota);
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);
    if (filters.id_usuario) queryParams.append('id_usuario', filters.id_usuario);
    if (filters.fecha_desde) queryParams.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) queryParams.append('fecha_hasta', filters.fecha_hasta);
    if (filters.cantidad_min) queryParams.append('cantidad_min', filters.cantidad_min);
    if (filters.cantidad_max) queryParams.append('cantidad_max', filters.cantidad_max);
    if (filters.forma_cobro) queryParams.append('forma_cobro', filters.forma_cobro);
    if (filters.tipo_cuenta) queryParams.append('tipo_cuenta', filters.tipo_cuenta);
    if (filters.id_servicio) queryParams.append('id_servicio', filters.id_servicio);
    if (filters.nombre_servicio) queryParams.append('nombre_servicio', filters.nombre_servicio);

    const response = await api.get(`/lista-venta/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener ventas';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getVentaById = async (id) => {
  try {
    const response = await api.get(`/lista-venta/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching venta:', error);
    throw error;
  }
};

export const createVenta = async (ventaData) => {
  try {
    const response = await api.post('/lista-venta', ventaData);
    return response.data;
  } catch (error) {
    console.error('Error creating venta:', error);
    console.error('Error response data:', error.response?.data);
    console.error('Error response status:', error.response?.status);
    console.error('Error response headers:', error.response?.headers);
    throw error;
  }
};

export const updateVenta = async (id, ventaData) => {
  try {
    const response = await api.put(`/lista-venta/${id}`, ventaData);
    return response.data;
  } catch (error) {
    console.error('Error updating venta:', error);
    throw error;
  }
};

export const deleteVenta = async (id) => {
  try {
    const response = await api.delete(`/lista-venta/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting venta:', error);
    throw error;
  }
};

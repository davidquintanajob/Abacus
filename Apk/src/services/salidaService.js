import api from './api';

export const getSalidas = async (filters = {}, page = undefined, limit = undefined) => {
  try {
    const queryParams = new URLSearchParams();

    // Only add limit and page if they are provided
    if (limit !== undefined) {
      queryParams.append('limit', limit.toString());
    }
    if (page !== undefined) {
      queryParams.append('page', page.toString());
    }

    // Add filters
    if (filters.id_servicio_tienda) queryParams.append('id_servicio_tienda', filters.id_servicio_tienda);
    if (filters.id_usuario) queryParams.append('id_usuario', filters.id_usuario);
    if (filters.fecha_desde) queryParams.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) queryParams.append('fecha_hasta', filters.fecha_hasta);
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);
    if (filters.tipo_salida) queryParams.append('tipo_salida', filters.tipo_salida);
    if (filters.descripcion) queryParams.append('descripcion', filters.descripcion);
    if (filters.nombre_producto) queryParams.append('nombre_producto', filters.nombre_producto);

    const response = await api.get(`/salida/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener salidas';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getSalidaById = async (id) => {
  try {
    const response = await api.get(`/salida/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos de la salida';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createSalida = async (salidaData) => {
  try {
    const response = await api.post('/salida', salidaData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear salida';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateSalida = async (id, salidaData) => {
  try {
    const response = await api.put(`/salida/${id}`, salidaData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar salida';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteSalida = async (id) => {
  try {
    const response = await api.delete(`/salida/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar salida';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

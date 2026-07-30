import api from './api';

export const getEntradas = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.id_servicio_tienda) queryParams.append('id_servicio_tienda', filters.id_servicio_tienda);
    if (filters.id_usuario) queryParams.append('id_usuario', filters.id_usuario);
    if (filters.fecha_desde) queryParams.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) queryParams.append('fecha_hasta', filters.fecha_hasta);
    if (filters.nombre_servicio) queryParams.append('nombre_servicio', filters.nombre_servicio);
    if (filters.codigo_lote) queryParams.append('codigo_lote', filters.codigo_lote);

    console.log('getEntradas queryParams:', queryParams.toString());
    const response = await api.get(`/entrada/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener entradas';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getEntradaById = async (id) => {
  try {
    const response = await api.get(`/entrada/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos de la entrada';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createEntrada = async (entradaData) => {
  try {
    console.log('createEntrada llamado con datos:', JSON.stringify(entradaData, null, 2));
    const response = await api.post('/entrada', entradaData);
    console.log('Respuesta del servidor:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error en createEntrada:', error);
    console.error('Error response:', error.response?.data);
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear entrada';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateEntrada = async (id, entradaData) => {
  try {
    const response = await api.put(`/entrada/${id}`, entradaData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar entrada';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteEntrada = async (id) => {
  try {
    const response = await api.delete(`/entrada/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar entrada';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

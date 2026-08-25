import api from '../lib/api';

interface ApiError extends Error {
  code?: number | string | null;
}

export const getEntradas = async (filters: any = {}, page: number = 1, limit: number = 10) => {
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
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);
    if (filters.cantidad_restante_min) queryParams.append('cantidad_restante_min', filters.cantidad_restante_min);
    if (filters.cantidad_restante_max) queryParams.append('cantidad_restante_max', filters.cantidad_restante_max);
    if (filters.fecha_vencimiento_desde) queryParams.append('fecha_vencimiento_desde', filters.fecha_vencimiento_desde);
    if (filters.fecha_vencimiento_hasta) queryParams.append('fecha_vencimiento_hasta', filters.fecha_vencimiento_hasta);

    const response = await api.get(`/entrada/filter?${queryParams}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener entradas';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getEntradaById = async (id: string | number) => {
  try {
    const response = await api.get(`/entrada/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos de la entrada';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createEntrada = async (entradaData: any) => {
  try {
    const response = await api.post('/entrada', entradaData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear entrada';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateEntrada = async (id: string | number, entradaData: any) => {
  try {
    const response = await api.put(`/entrada/${id}`, entradaData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar entrada';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteEntrada = async (id: string | number) => {
  try {
    const response = await api.delete(`/entrada/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar entrada';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createEntradasBulk = async (entradasData: any) => {
  try {
    const response = await api.post('/entrada/bulk', { entradas: entradasData });
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear entradas múltiples';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

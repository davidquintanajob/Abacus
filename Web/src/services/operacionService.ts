import api from '../lib/api';

interface ApiError extends Error {
  code?: number | string | null;
}

export const getOperaciones = async (filters: any = {}, page: number = 1, limit: number = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.id_cuenta) queryParams.append('id_cuenta', filters.id_cuenta);
    if (filters.id_usuario) queryParams.append('id_usuario', filters.id_usuario);
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);
    if (filters.tipo_operacion) queryParams.append('tipo_operacion', filters.tipo_operacion);
    if (filters.fecha_desde) queryParams.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) queryParams.append('fecha_hasta', filters.fecha_hasta);
    if (filters.cantidad_min) queryParams.append('cantidad_min', filters.cantidad_min);
    if (filters.cantidad_max) queryParams.append('cantidad_max', filters.cantidad_max);

    const response = await api.get(`/operacion/filter?${queryParams}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener operaciones';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getOperacionById = async (id: string | number) => {
  try {
    const response = await api.get(`/operacion/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos de la operación';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createOperacion = async (operacionData: any) => {
  try {
    const response = await api.post('/operacion', operacionData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear operación';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateOperacion = async (id: string | number, operacionData: any) => {
  try {
    const response = await api.put(`/operacion/${id}`, operacionData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar operación';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteOperacion = async (id: string | number) => {
  try {
    const response = await api.delete(`/operacion/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar operación';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

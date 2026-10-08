import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const getMovimientos = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.id_usuario) queryParams.append('id_usuario', filters.id_usuario);
    if (filters.tipo_movimiento) queryParams.append('tipo_movimiento', filters.tipo_movimiento);
    if (filters.estado !== undefined) queryParams.append('estado', filters.estado);
    if (filters.fecha_desde) queryParams.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) queryParams.append('fecha_hasta', filters.fecha_hasta);
    if (filters.id_servicio_tienda_origen) queryParams.append('id_servicio_tienda_origen', filters.id_servicio_tienda_origen);
    if (filters.id_servicio_tienda_destino) queryParams.append('id_servicio_tienda_destino', filters.id_servicio_tienda_destino);

    const response = await api.get(`/movimiento/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener movimientos';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getMovimientoById = async (id) => {
  try {
    const response = await api.get(`/movimiento/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos del movimiento';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createMovimiento = async (movimientoData) => {
  try {
    const response = await api.post('/movimiento', movimientoData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear movimiento';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateMovimiento = async (id, movimientoData) => {
  try {
    console.log('[movimientoService] updateMovimiento called with:', {
      id,
      hasIdUsuario: !!movimientoData.id_usuario,
      movimientoDataKeys: Object.keys(movimientoData),
    });

    // Only include id_usuario if it's already in the data
    // Don't try to fetch from AsyncStorage for updates
    const response = await api.put(`/movimiento/${id}`, movimientoData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar movimiento';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteMovimiento = async (id) => {
  try {
    const response = await api.delete(`/movimiento/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar movimiento';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

import api from '../lib/api';

interface ApiError extends Error {
  code?: number | string | null;
}

export const getTiendas = async (filters: any = {}, page: number = 1, limit: number = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nombre) queryParams.append('nombre', filters.nombre);
    if (filters.tipo) queryParams.append('tipo', filters.tipo);
    if (filters.activo !== undefined && filters.activo !== '') queryParams.append('activo', filters.activo);

    const response = await api.get(`/tienda/filter?${queryParams}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener tiendas';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getTiendaById = async (id: string | number) => {
  try {
    const response = await api.get(`/tienda/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener tienda';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createTienda = async (tiendaData: any) => {
  try {
    const response = await api.post('/tienda', tiendaData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear tienda';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateTienda = async (id: string | number, tiendaData: any) => {
  try {
    const response = await api.put(`/tienda/${id}`, tiendaData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar tienda';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteTienda = async (id: string | number) => {
  try {
    const response = await api.delete(`/tienda/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar tienda';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

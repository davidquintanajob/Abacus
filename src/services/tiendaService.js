import api from './api';

export const getTiendas = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nombre) queryParams.append('nombre', filters.nombre);
    if (filters.tipo) queryParams.append('tipo', filters.tipo);
    if (filters.activo !== '') queryParams.append('activo', filters.activo);

    const response = await api.get(`/tienda/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener tiendas';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getTiendaById = async (id) => {
  try {
    const response = await api.get(`/tienda/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener tienda';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createTienda = async (tiendaData) => {
  try {
    const response = await api.post('/tienda', tiendaData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear tienda';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateTienda = async (id, tiendaData) => {
  try {
    const response = await api.put(`/tienda/${id}`, tiendaData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar tienda';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteTienda = async (id) => {
  try {
    const response = await api.delete(`/tienda/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar tienda';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

import api from './api';

export const getServicios = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nombre) queryParams.append('nombre', filters.nombre);
    if (filters.codigo) queryParams.append('codigo', filters.codigo);
    if (filters.categoria) queryParams.append('categoria', filters.categoria);
    if (filters.esvendible !== undefined && filters.esvendible !== '') queryParams.append('esvendible', filters.esvendible === 'true' ? true : false);
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);
    if (filters.fetchProducto !== undefined) queryParams.append('fetchProducto', filters.fetchProducto);

    const response = await api.get(`/servicio/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener servicios';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getServicioById = async (id) => {
  try {
    const response = await api.get(`/servicio/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos del servicio';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createServicio = async (servicioData) => {
  try {
    const response = await api.post('/servicio', servicioData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear servicio';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateServicio = async (id, servicioData) => {
  try {
    const response = await api.put(`/servicio/${id}`, servicioData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar servicio';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getServicioByCodigo = async (codigo) => {
  try {
    const response = await api.get(`/servicio/codigo/${codigo}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener servicio por código';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteServicio = async (id) => {
  try {
    const response = await api.delete(`/servicio/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar servicio';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getServicioTiendas = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);
    if (filters.id_servicio) queryParams.append('id_servicio', filters.id_servicio);
    if (filters.codigo_barras_ean) queryParams.append('codigo_barras_ean', filters.codigo_barras_ean);
    if (filters.fetchServicio !== undefined) queryParams.append('fetchServicio', filters.fetchServicio);
    if (filters.fetchProducto !== undefined) queryParams.append('fetchProducto', filters.fetchProducto);
    if (filters.fetchTienda !== undefined) queryParams.append('fetchTienda', filters.fetchTienda);

    const response = await api.get(`/servicio-tienda/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener servicios de tienda';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

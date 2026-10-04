import api from './api';

export const getClientes = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nombre) queryParams.append('nombre', filters.nombre);
    if (filters.telefono) queryParams.append('telefono', filters.telefono);
    if (filters.tipo_cliente) queryParams.append('tipo_cliente', filters.tipo_cliente);

    const response = await api.get(`/cliente/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener clientes';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getClienteById = async (id) => {
  try {
    const response = await api.get(`/cliente/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos del cliente';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createCliente = async (clienteData) => {
  try {
    const response = await api.post('/cliente', clienteData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear cliente';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateCliente = async (id, clienteData) => {
  try {
    const response = await api.put(`/cliente/${id}`, clienteData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar cliente';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteCliente = async (id) => {
  try {
    const response = await api.delete(`/cliente/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar cliente';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

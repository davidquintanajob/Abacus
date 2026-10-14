import api from '../lib/api';

interface ApiError extends Error {
  code?: number | string | null;
}

export const getCuentas = async (filters: any = {}, page: number = 1, limit: number = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nombre) queryParams.append('nombre', filters.nombre);
    if (filters.tipo_cuenta) queryParams.append('tipo_cuenta', filters.tipo_cuenta);
    if (filters.num_cuenta) queryParams.append('num_cuenta', filters.num_cuenta);
    if (filters.activo !== undefined) queryParams.append('activo', filters.activo.toString());

    const response = await api.get(`/cuenta/filter?${queryParams}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener cuentas';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getCuentaById = async (id: string | number) => {
  try {
    const response = await api.get(`/cuenta/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos de la cuenta';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createCuenta = async (cuentaData: any) => {
  try {
    const response = await api.post('/cuenta', cuentaData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear cuenta';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateCuenta = async (id: string | number, cuentaData: any) => {
  try {
    const response = await api.put(`/cuenta/${id}`, cuentaData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar cuenta';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteCuenta = async (id: string | number) => {
  try {
    const response = await api.delete(`/cuenta/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar cuenta';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

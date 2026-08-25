import api from '../lib/api';

interface ApiError extends Error {
  code?: number | string | null;
}

export const getGeneralInformation = async () => {
  try {
    const response = await api.get('/informes/generalInformation');
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener información general';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

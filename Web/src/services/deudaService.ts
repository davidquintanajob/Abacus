import api from '../lib/api';

export const getDeudas = async (filters: any = {}, page: number = 1, limit: number = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.id_cliente) queryParams.append('id_cliente', filters.id_cliente);
    if (filters.nombre_cliente) queryParams.append('nombre_cliente', filters.nombre_cliente);
    if (filters.telefono_cliente) queryParams.append('telefono_cliente', filters.telefono_cliente);
    if (filters.fecha_desde) queryParams.append('fecha_desde', filters.fecha_desde);
    if (filters.fecha_hasta) queryParams.append('fecha_hasta', filters.fecha_hasta);
    if (filters.monto_cup_min !== undefined) queryParams.append('monto_cup_min', filters.monto_cup_min);
    if (filters.monto_cup_max !== undefined) queryParams.append('monto_cup_max', filters.monto_cup_max);
    if (filters.monto_usd_min !== undefined) queryParams.append('monto_usd_min', filters.monto_usd_min);
    if (filters.monto_usd_max !== undefined) queryParams.append('monto_usd_max', filters.monto_usd_max);
    if (filters.tiene_deuda !== undefined) queryParams.append('tiene_deuda', filters.tiene_deuda);

    const response = await api.get(`/deuda/filter?${queryParams}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] ||
                        error.response?.data?.message ||
                        error.message ||
                        'Error al obtener deudas';
    const err = new Error(errorMessage);
    (err as any).code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getDeudaById = async (id: string) => {
  try {
    const response = await api.get(`/deuda/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] ||
                        error.response?.data?.message ||
                        error.message ||
                        'Error al obtener datos de la deuda';
    const err = new Error(errorMessage);
    (err as any).code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createDeuda = async (deudaData: any) => {
  try {
    const response = await api.post('/deuda', deudaData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] ||
                        error.response?.data?.message ||
                        error.message ||
                        'Error al crear deuda';
    const err = new Error(errorMessage);
    (err as any).code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateDeuda = async (id: string, deudaData: any, pagos: any) => {
  try {
    const response = await api.put(`/deuda/${id}`, { ...deudaData, pagos });
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] ||
                        error.response?.data?.message ||
                        error.message ||
                        'Error al actualizar deuda';
    const err = new Error(errorMessage);
    (err as any).code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const saldarDeuda = async (id: string, pagos: any) => {
  try {
    const response = await api.post(`/deuda/${id}/saldar`, { pagos });
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] ||
                        error.response?.data?.message ||
                        error.message ||
                        'Error al saldar deuda';
    const err = new Error(errorMessage);
    (err as any).code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteDeuda = async (id: string) => {
  try {
    const response = await api.delete(`/deuda/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] ||
                        error.response?.data?.message ||
                        error.message ||
                        'Error al eliminar deuda';
    const err = new Error(errorMessage);
    (err as any).code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

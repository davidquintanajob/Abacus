import api from '../lib/api';

interface ApiError extends Error {
  code?: number | string | null;
}

export const getProductos = async (filters: any = {}, page: number = 1, limit: number = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nombre) queryParams.append('nombre', filters.nombre);
    if (filters.codigo) queryParams.append('codigo', filters.codigo);
    if (filters.categoria) queryParams.append('categoria', filters.categoria);
    if (filters.esvendible !== undefined && filters.esvendible !== '') queryParams.append('esvendible', filters.esvendible === 'true' ? 'true' : 'false');
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);
    if (filters.cantidad_min !== undefined && filters.cantidad_min !== '') queryParams.append('cantidad_min', filters.cantidad_min);
    if (filters.cantidad_max !== undefined && filters.cantidad_max !== '') queryParams.append('cantidad_max', filters.cantidad_max);

    const response = await api.get(`/producto/filter?${queryParams}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener productos';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getProductoById = async (id: string | number) => {
  try {
    const response = await api.get(`/producto/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos del producto';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createProducto = async (productoData: any) => {
  try {
    const response = await api.post('/producto', productoData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear producto';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateProducto = async (id: string | number, productoData: any) => {
  try {
    const response = await api.put(`/producto/${id}`, productoData);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar producto';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getProductoByCodigo = async (codigo: string) => {
  try {
    const response = await api.get(`/producto/filter?codigo=${encodeURIComponent(codigo)}&limit=1`);
    const data = response.data;
    if (data.data && data.data.length > 0) {
      return data.data[0];
    }
    throw new Error('Producto no encontrado');
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener producto por código';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteProducto = async (id: string | number) => {
  try {
    const response = await api.delete(`/producto/${id}`);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar producto';
    const err = new Error(errorMessage) as ApiError;
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

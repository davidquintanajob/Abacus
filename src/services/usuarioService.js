import api from './api';

export const getUsuarios = async (filters = {}, page = 1, limit = 10) => {
  try {
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      page: page.toString(),
    });

    // Add filters
    if (filters.nombre_natural) queryParams.append('nombre_natural', filters.nombre_natural);
    if (filters.nombre_usuario) queryParams.append('nombre_usuario', filters.nombre_usuario);
    if (filters.rol) queryParams.append('rol', filters.rol);
    if (filters.activo !== '') queryParams.append('activo', filters.activo);
    if (filters.id_tienda) queryParams.append('id_tienda', filters.id_tienda);

    const response = await api.get(`/usuario/filter?${queryParams}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener usuarios';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const getUsuarioById = async (id) => {
  try {
    const response = await api.get(`/usuario/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al obtener datos del usuario';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const createUsuario = async (usuarioData) => {
  try {
    const response = await api.post('/usuario', usuarioData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al crear usuario';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const updateUsuario = async (id, usuarioData) => {
  try {
    const response = await api.put(`/usuario/${id}`, usuarioData);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al actualizar usuario';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const deleteUsuario = async (id) => {
  try {
    const response = await api.delete(`/usuario/${id}`);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al eliminar usuario';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const changePassword = async (viejaContrasenna, nuevaContrasenna) => {
  try {
    const response = await api.post('/usuario/changePassword', {
      viejaContrasenna,
      nuevaContrasenna,
    });
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al cambiar contraseña';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

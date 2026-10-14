import api from './api';
import * as SecureStore from 'expo-secure-store';

export const login = async (nombre_usuario, contrasenna) => {
  try {
    const response = await api.post('/usuario/login', {
      nombre_usuario,
      contrasenna,
    });

    const { usuario, token, refreshToken, message } = response.data;

    // Guardar en SecureStore
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    await SecureStore.setItemAsync('user', JSON.stringify(usuario));

    return { usuario, token, refreshToken, message };
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0] || 
                        error.response?.data?.message || 
                        error.message ||
                        'Error al iniciar sesión';
    const err = new Error(errorMessage);
    err.code = error.response?.status ?? error.code ?? null;
    throw err;
  }
};

export const logout = async () => {
  try {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
  } catch (error) {
    // Error al cerrar sesión
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
                        'Error al cambiar contraseña';
    throw new Error(errorMessage);
  }
};

export const getUser = async () => {
  try {
    const userJson = await SecureStore.getItemAsync('user');
    return userJson ? JSON.parse(userJson) : null;
  } catch (error) {
    return null;
  }
};

export const getToken = async () => {
  try {
    return await SecureStore.getItemAsync('token');
  } catch (error) {
    return null;
  }
};

export const isAuthenticated = async () => {
  const token = await getToken();
  return !!token;
};

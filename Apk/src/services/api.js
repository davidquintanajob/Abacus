import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_CONFIG } from '../config';
import { navigationRef } from '../navigationRef';

// Función para obtener la URL base de la API
const getApiBaseUrl = async () => {
  try {
    // Primero intentar leer la URL configurada por el usuario en Settings
    const userConfiguredURL = await SecureStore.getItemAsync('serverIP');
    if (userConfiguredURL) {
      return userConfiguredURL;
    }
  } catch (error) {
    // Error reading serverIP from SecureStore
  }

  // Fallback a config.js
  if (API_CONFIG.API_BASE_URL) {
    return API_CONFIG.API_BASE_URL;
  }

  // Fallback final según plataforma
  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
};

// URL base inicial (se actualizará dinámicamente en el interceptor)
let API_BASE_URL;

// Inicializar la URL base
const initializeApiBaseUrl = async () => {
  API_BASE_URL = await getApiBaseUrl();
};

const api = axios.create({
  baseURL: API_BASE_URL || 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para actualizar la URL base y añadir token a las peticiones
api.interceptors.request.use(
  async (config) => {
    // Actualizar la URL base dinámicamente
    const currentBaseUrl = await getApiBaseUrl();
    config.baseURL = currentBaseUrl;

    // Añadir token si existe
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requestUrl = error.config?.url || '';
    const isLoginRequest = requestUrl.includes('/usuario/login');

    // Solo redirigir a Login por 401/403 si NO es el intento de login en sí.
    // Un 401 en /login significa credenciales incorrectas — el screen lo maneja.
    // Un 401 en cualquier otra ruta significa token expirado o inválido.
    if (!isLoginRequest && (error.response?.status === 401 || error.response?.status === 403)) {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');
      
      if (navigationRef.isReady()) {
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    }
    return Promise.reject(error);
  }
);

export { getApiBaseUrl };
export default api;

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_CONFIG } from '../config';

// Función para obtener la URL base de la API
const getApiBaseUrl = async () => {
  try {
    // Primero intentar leer la IP configurada por el usuario en Settings
    const userConfiguredIP = await SecureStore.getItemAsync('serverIP');
    if (userConfiguredIP) {
      return `http://${userConfiguredIP}:4000`;
    }
  } catch (error) {
    console.error('Error reading serverIP from SecureStore:', error);
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
    if (error.response?.status === 403) {
      // Token inválido o expirado
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('user');
    }
    return Promise.reject(error);
  }
);

export default api;

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_CONFIG } from '../config';
import { navigationRef } from '../navigationRef';
import NetInfo from '@react-native-community/netinfo';
import packageJson from '../../package.json';

// Función para verificar si el servidor está disponible
const checkServerAvailability = async (url) => {
  try {
    // Intentar hacer una petición simple al endpoint /config/ping
    await axios.get(`${url}/config/ping`, { timeout: 2000 });
    return true;
  } catch (error) {
    // Si falla /config/ping, intentar con la raíz
    try {
      await axios.get(url, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
};

// Función para verificar si el dispositivo está conectado a WiFi
const isWifiConnected = async () => {
  try {
    const state = await NetInfo.fetch();
    // isConnectionExpensive returns true for cellular data, false for WiFi
    return !state.isConnectionExpensive && state.type === 'wifi';
  } catch {
    return false;
  }
};

// Función para obtener la URL base de la API
const getApiBaseUrl = async () => {
  let userConfiguredURL;
  try {
    // Primero intentar leer la URL configurada por el usuario en Settings
    userConfiguredURL = await SecureStore.getItemAsync('serverIP');
  } catch (error) {
    // Error reading serverIP from SecureStore
  }

  // Verificar si el usuario ha activado la prioridad de WiFi
  let prioritizeWifi = false;
  try {
    const prioritizeWifiValue = await SecureStore.getItemAsync('prioritizeWifiConnection');
    prioritizeWifi = prioritizeWifiValue === 'true';
  } catch (error) {
    // Error reading prioritizeWifiConnection, default to false
  }

  // Solo aplicar lógica de priorización WiFi si el usuario lo ha activado
  if (prioritizeWifi) {
    // Verificar si estamos en WiFi
    const wifiConnected = await isWifiConnected();

    // Si estamos en WiFi y hay una URL configurada por el usuario (servidor local)
    if (wifiConnected && userConfiguredURL) {
      // Verificar si el servidor local está disponible
      const serverAvailable = await checkServerAvailability(userConfiguredURL);
      if (serverAvailable) {
        return userConfiguredURL;
      }
    }
  }

  // Si no está activada la prioridad WiFi, o no estamos en WiFi, o el servidor local no está disponible,
  // usar la URL remota configurada o fallback
  if (API_CONFIG.API_BASE_URL) {
    return API_CONFIG.API_BASE_URL;
  }

  // Si hay URL configurada por el usuario pero no está disponible,
  // aún así intentar usarla (puede ser un problema temporal)
  if (userConfiguredURL) {
    return userConfiguredURL;
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

    // Añadir versión de la APK
    config.headers['apk-version'] = packageJson.version;

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

    // Detectar error de versión incompatible
    const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0] || '';
    
    // También verificar si el data es HTML y contiene el mensaje de versión
    const dataString = typeof error.response?.data === 'string' ? error.response?.data : '';
    const isHtmlError = dataString.toLowerCase().includes('versión de apk no soportada') ||
                        dataString.toLowerCase().includes('versión de apk no soportada');
    
    console.log('[API Interceptor] Full error response:', {
      status: error.response?.status,
      data: error.response?.data,
      errorMessage: errorMessage,
      dataMessage: error.response?.data?.message,
      dataErrors: error.response?.data?.errors,
      dataString: dataString.substring(0, 200),
      isHtmlError,
      requestUrl: requestUrl,
      currentVersion: packageJson.version
    });

    const isVersionError = error.response?.status === 426 ||
                          isHtmlError ||
                          (error.response?.status === 400 && (
                            errorMessage.toLowerCase().includes('versión') ||
                            errorMessage.toLowerCase().includes('version') ||
                            error.response?.data?.errors?.[0]?.toLowerCase().includes('versión') ||
                            error.response?.data?.errors?.[0]?.toLowerCase().includes('version')
                          )) ||
                          error.response?.data?.message?.toLowerCase().includes('versión') ||
                          error.response?.data?.errors?.[0]?.toLowerCase().includes('versión') ||
                          error.response?.data?.errors?.[0]?.toLowerCase().includes('version');

    console.log('[API Interceptor] Error detected:', {
      status: error.response?.status,
      message: errorMessage,
      isVersionError,
      requestUrl: requestUrl,
      currentVersion: packageJson.version
    });

    if (isVersionError) {
      console.log('[API Interceptor] Version error detected, saving to SecureStore');
      
      // Extraer el mensaje del error
      let versionErrorMessage = error.response?.data?.message || error.response?.data?.errors?.[0];
      
      // Si es HTML, extraer el mensaje de la primera línea
      if (!versionErrorMessage && typeof error.response?.data === 'string') {
        const htmlMatch = error.response.data.match(/Error: ([^<]+)/);
        if (htmlMatch) {
          versionErrorMessage = htmlMatch[1].trim();
        }
      }
      
      // Guardar el error de versión en SecureStore
      const versionError = {
        message: versionErrorMessage || 'Versión de la aplicación incompatible con el servidor',
        code: error.response?.status || 426,
        currentVersion: packageJson.version
      };
      await SecureStore.setItemAsync('versionError', JSON.stringify(versionError));

      // Redirigir a PasswordRecoveryScreen
      if (navigationRef.isReady()) {
        console.log('[API Interceptor] Redirecting to PasswordRecoveryScreen');
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'PasswordRecovery' }],
        });
      }
      return Promise.reject(error);
    }

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

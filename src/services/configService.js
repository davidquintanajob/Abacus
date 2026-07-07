import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const CONFIG_KEY = '@abacus_config';

export const configService = {
  // Obtener configuración: intenta el backend primero, cae a AsyncStorage si falla
  getConfig: async () => {
    try {
      const response = await api.get('/config');
      const data = response.data;
      // Sincroniza la respuesta del backend en el caché local
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(data));
      return data;
    } catch (networkError) {
      // Sin conexión o backend no disponible: leer del caché local
      try {
        const jsonValue = await AsyncStorage.getItem(CONFIG_KEY);
        if (jsonValue !== null) {
          return JSON.parse(jsonValue);
        }
        return { cupToUsdRate: null };
      } catch (storageError) {
        console.error('Error leyendo config de AsyncStorage:', storageError);
        return { cupToUsdRate: null };
      }
    }
  },

  // Actualizar configuración: guarda en backend y también en AsyncStorage
  updateConfig: async (configData) => {
    // Siempre persiste localmente primero
    try {
      await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(configData));
    } catch (storageError) {
      console.error('Error guardando config en AsyncStorage:', storageError);
    }

    // Luego intenta sincronizar con el backend
    try {
      const response = await api.put('/config', configData);
      return response.data?.data ?? configData;
    } catch (networkError) {
      // Sin conexión: devuelve los datos locales igual para que la UI funcione
      console.warn('Backend no disponible, config guardada solo localmente.');
      return configData;
    }
  },
};

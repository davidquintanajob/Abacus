import axios from 'axios';

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    const savedURL = localStorage.getItem('serverIP');
    if (savedURL) {
      return savedURL;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
};

export const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Función para actualizar la baseURL dinámicamente
export const updateBaseURL = (newURL: string) => {
  api.defaults.baseURL = newURL;
};

// Interceptor para agregar token y releer la URL base en cada request
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      // Releer la URL base en cada petición por si cambió después de inicializar
      const currentURL = localStorage.getItem('serverIP');
      if (currentURL) {
        config.baseURL = currentURL;
      }
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
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
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
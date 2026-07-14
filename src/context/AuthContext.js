import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as loginService, logout as logoutService, getUser, getToken } from '../services/authService';
import { configService } from '../services/configService';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [config, setConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedToken = await getToken();
      const storedUser = await getUser();
      const storedConfig = await SecureStore.getItemAsync('appConfig');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        if (storedConfig) {
          setConfig(JSON.parse(storedConfig));
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (nombre_usuario, contrasenna) => {
    try {
      const { usuario, token: newToken } = await loginService(nombre_usuario, contrasenna);
      setUser(usuario);
      setToken(newToken);
      
      // Fetch and store configuration after successful login
      try {
        const appConfig = await configService.getConfig();
        setConfig(appConfig);
        await SecureStore.setItemAsync('appConfig', JSON.stringify(appConfig));
      } catch (configError) {
        console.error('Error fetching config during login:', configError);
        // Don't fail login if config fetch fails
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code ?? null,
      };
    }
  };

  const logout = async () => {
    try {
      await logoutService();
      setUser(null);
      setToken(null);
      setConfig(null);
      await SecureStore.deleteItemAsync('appConfig');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const value = {
    user,
    token,
    config,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    permissions: config?.permissions || {
      dependiente: false,
      almacenero: false,
      economico: false,
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

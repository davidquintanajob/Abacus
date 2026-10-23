import api from '../lib/api';

export interface Config {
  cupToUsdRate?: number;
  permissions?: {
    dependiente?: boolean;
    almacenero?: boolean;
    economico?: boolean;
  };
  entradaAccessLevels?: {
    dependiente?: string;
    almacenero?: string;
    economico?: string;
  };
  entradaManagePermissions?: {
    dependiente?: boolean;
    almacenero?: boolean;
    economico?: boolean;
  };
  salidaAccessLevels?: {
    dependiente?: string;
    almacenero?: string;
    economico?: string;
  };
  salidaManagePermissions?: {
    dependiente?: boolean;
    almacenero?: boolean;
    economico?: boolean;
  };
  operacionAccessLevels?: {
    dependiente?: string;
    almacenero?: string;
    economico?: string;
  };
  operacionManagePermissions?: {
    dependiente?: boolean;
    almacenero?: boolean;
    economico?: boolean;
  };
  ventaAccessLevels?: {
    dependiente?: string;
    almacenero?: string;
    economico?: string;
  };
  ventaManagePermissions?: {
    dependiente?: boolean;
    almacenero?: boolean;
    economico?: boolean;
  };
  applyWeightedAverageCost?: boolean;
  autoApplySuggestedCost?: {
    dependiente?: boolean;
    almacenero?: boolean;
    economico?: boolean;
  };
  showEntradaModalAfterProductCreation?: boolean;
  customSalidaTypes?: any[];
  tiendaCuentasConfig?: any;
  cuentaChangePermissions?: {
    dependiente?: boolean;
    almacenero?: boolean;
    economico?: boolean;
  };
  priceChangePermissions?: {
    dependiente?: boolean;
    almacenero?: boolean;
    economico?: boolean;
  };
  comprobanteConfig?: {
    logo?: string | null | undefined;
    nombreNegocio?: string;
  };
  prioritizeWifiConnection?: boolean;
  monedaConfig?: {
    modificarSoloServicios?: boolean;
    datosModificar?: string;
    tipoDatoModificar?: string;
    monedaValor?: number;
  };
}

export const configService = {
  async getConfig(): Promise<Config> {
    try {
      const response = await api.get('/config');
      return response.data;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  },

  async updateConfig(config: Config): Promise<any> {
    try {
      const response = await api.put('/config', config);
      return response.data;
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  },
};

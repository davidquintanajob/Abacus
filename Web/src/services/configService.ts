const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

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
  comprobanteConfig?: {
    logo?: string | null;
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
      const response = await fetch(`${API_BASE_URL}/config`);
      if (!response.ok) {
        throw new Error('Error al obtener configuración');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  },

  async updateConfig(config: Config): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        throw new Error('Error al actualizar configuración');
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating config:', error);
      throw error;
    }
  },
};

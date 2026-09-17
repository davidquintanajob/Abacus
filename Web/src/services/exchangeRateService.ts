const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface ExchangeRates {
  tasas: {
    USD: number;
    ECU: number;
    MLC: number;
    USDT_TRC20: number;
  };
  date: string;
  hour: number;
  minutes: number;
}

export const exchangeRateService = {
  async getExchangeRates(): Promise<ExchangeRates> {
    try {
      const response = await fetch(`${API_BASE_URL}/config/tasa-cambio`);
      if (!response.ok) {
        throw new Error('No se pudo obtener las tasas de cambio del servidor');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      throw error;
    }
  },

  formatCurrency(value: number, currency = 'CUP'): string {
    if (value === undefined || value === null || isNaN(value)) return '—';

    if (currency === 'CUP') {
      return `$${Number(value).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} CUP`;
    }

    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${Number(value).toFixed(2)} ${currency}`;
    }
  },
};

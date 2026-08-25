import api from './api';

export const exchangeRateService = {
  async getExchangeRates() {
    try {
      const response = await api.get('/config/tasa-cambio');
      return response.data;
    } catch (error) {
      throw new Error('No se pudo obtener las tasas de cambio del servidor');
    }
  },

  /**
   * Formatea un valor numérico como moneda.
   * Para CUP no existe locale oficial en Intl, así que lo formateamos manualmente.
   */
  formatCurrency(value, currency = 'CUP') {
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

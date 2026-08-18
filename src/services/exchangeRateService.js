const ELTOQUE_API_URL = 'https://tasas.eltoque.com/v1/trmi';
const ELTOQUE_API_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc3MDczMDQ4NCwianRpIjoiMDM3YmVmYWEtNTc0OS00MjliLWExMDctNTI3ODI4NzZiY2M1IiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5ODAxYjgwYzFkYjdhMjU4OWQxN2YzZiIsIm5iZiI6MTc3MDczMDQ4NCwiZXhwIjoxODAyMjY2NDg0fQ.b0YJPqe4_NCYwVE-5w-cJfmDMoQ2Kx2vTb8WOmI9khs';

export const exchangeRateService = {
  async getExchangeRates() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(ELTOQUE_API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ELTOQUE_API_TOKEN}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText || 'Error en la API de ElToque'}`);
    }

    const data = await response.json();
    return data;
  },

  formatCurrency(value, currency = 'CUP') {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  },
};

const ELTOQUE_API_URL = 'https://tasas.eltoque.com/v1/trmi';
const ELTOQUE_API_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc3MDczMDQ4NCwianRpIjoiMDM3YmVmYWEtNTc0OS00MjliLWExMDctNTI3ODI4NzZiY2M1IiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjY5ODAxYjgwYzFkYjdhMjU4OWQxN2YzZiIsIm5iZiI6MTc3MDczMDQ4NCwiZXhwIjoxODAyMjY2NDg0fQ.b0YJPqe4_NCYwVE-5w-cJfmDMoQ2Kx2vTb8WOmI9khs';

// Proxy CORS para cuando se corre en web (Expo web / browser)
// allorigins devuelve el contenido de la URL en el campo "contents"
const CORS_PROXY_URL = `https://api.allorigins.win/get?url=${encodeURIComponent(
  `${ELTOQUE_API_URL}?token=${ELTOQUE_API_TOKEN}`
)}`;

/**
 * Intenta hacer la petición directamente (funciona en iOS/Android nativo).
 * Si falla por CORS o red, lo propagará para que el caller intente el proxy.
 */
async function fetchDirect(signal) {
  const response = await fetch(ELTOQUE_API_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${ELTOQUE_API_TOKEN}`,
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status}: ${body || 'Error en la API de elToque'}`);
  }

  return response.json();
}

/**
 * Fallback via proxy CORS (funciona cuando la llamada directa falla por CORS en web).
 * allorigins devuelve { contents: "<json string>", status: { ... } }
 */
async function fetchViaProxy(signal) {
  const response = await fetch(CORS_PROXY_URL, { signal });

  if (!response.ok) {
    throw new Error(`Proxy HTTP ${response.status}`);
  }

  const wrapper = await response.json();

  if (!wrapper.contents) {
    throw new Error('El proxy no devolvió contenido');
  }

  const data = JSON.parse(wrapper.contents);

  // La API devuelve un mensaje de error en formato JSON cuando el token falla
  if (data.msg) {
    throw new Error(`API error: ${data.msg}`);
  }

  return data;
}

export const exchangeRateService = {
  async getExchangeRates() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      // Primer intento: directo (nativo iOS/Android)
      const data = await fetchDirect(controller.signal);
      clearTimeout(timeoutId);
      return data;
    } catch (directError) {
      // Si fue un abort (timeout), no vale la pena intentar el proxy
      if (directError.name === 'AbortError') {
        clearTimeout(timeoutId);
        throw new Error('La solicitud tardó demasiado. Verificá tu conexión a internet.');
      }

      // Segundo intento: proxy CORS (para web / emulador con CORS bloqueado)
      try {
        const data = await fetchViaProxy(controller.signal);
        clearTimeout(timeoutId);
        return data;
      } catch (proxyError) {
        clearTimeout(timeoutId);
        // Lanzar el error original (más descriptivo)
        throw new Error(
          `No se pudo obtener las tasas de cambio. Error directo: ${directError.message}`
        );
      }
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

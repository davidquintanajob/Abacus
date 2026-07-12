import { API_CONFIG as DEFAULT_CONFIG } from './appConfig';

let API_CONFIG = DEFAULT_CONFIG;

try {
  const localConfig = require('./config.local');
  if (localConfig?.API_CONFIG) {
    API_CONFIG = { ...DEFAULT_CONFIG, ...localConfig.API_CONFIG };
  }
} catch {
  // config.local.js es opcional (solo desarrollo local)
}

export { API_CONFIG };

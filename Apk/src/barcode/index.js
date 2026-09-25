/**
 * Barcode Module
 * 
 * Main export for the barcode scanning and validation engine.
 */

export { default as BarcodeEngine } from './BarcodeEngine';
export { default as BarcodeResult } from './BarcodeResult';
export { default as BarcodeNormalizer } from './core/BarcodeNormalizer';

// Config exports
export { 
  BARCODE_TYPES, 
  BARCODE_LENGTHS, 
  CHECKSUM_REQUIREMENTS, 
  ALLOWED_BARCODE_TYPES,
  BARCODE_TYPE_NAMES,
} from './config/BarcodeTypes';

export { 
  PRODUCT_CREATION, 
  QUICK_SCAN, 
  INVENTORY, 
  DEFAULT_CONFIG, 
  CONFIGS, 
  getConfig, 
  validateConfig 
} from './config/BarcodeConfig';

// Session state export
export { SessionState } from './core/BarcodeSession';

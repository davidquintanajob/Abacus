/**
 * Barcode Configuration
 * 
 * Defines configuration for different use cases in the POS application.
 * Each use case has specific requirements for precision vs speed.
 */

import { BARCODE_TYPES } from './BarcodeTypes';

/**
 * Use Case: PRODUCT_CREATION
 * Maximum precision required - no tolerance for incorrect codes
 * Used when creating new products in the system
 */
export const PRODUCT_CREATION = {
  SCAN_BUFFER_SIZE: 2,              // Analyze last 2 reads (very fast)
  MIN_CONFIDENCE_SCORE: 0.50,        // 50% confidence required (minimal)
  ALLOW_TIMEOUT: false,             // Never accept by timeout
  REQUIRE_CHECKSUM: true,           // Validate checksums (this ensures accuracy)
  MIN_READ_INTERVAL: 50,            // Minimum ms between reads (anti-rattle)
  MAX_SESSION_DURATION: 5000,       // Max 5 seconds per session
  LOG_LEVEL: 'NONE',                // No logging
};

/**
 * Use Case: QUICK_SCAN
 * Balanced precision and speed
 * Used for quick product lookup, inventory counts, etc.
 */
export const QUICK_SCAN = {
  SCAN_BUFFER_SIZE: 3,
  MIN_CONFIDENCE_SCORE: 0.70,        // 70% confidence sufficient
  ALLOW_TIMEOUT: true,
  TIMEOUT_DURATION: 2000,             // 2 second timeout
  REQUIRE_CHECKSUM: true,
  MIN_READ_INTERVAL: 80,
  MAX_SESSION_DURATION: 5000,         // 5 seconds max
  LOG_LEVEL: 'NONE',                 // No logging
};

/**
 * Use Case: INVENTORY
 * High precision but faster than product creation
 * Used for inventory management, stock counts
 */
export const INVENTORY = {
  SCAN_BUFFER_SIZE: 4,
  MIN_CONFIDENCE_SCORE: 0.75,
  ALLOW_TIMEOUT: true,
  TIMEOUT_DURATION: 3000,
  REQUIRE_CHECKSUM: true,
  MIN_READ_INTERVAL: 100,
  MAX_SESSION_DURATION: 7000,
  LOG_LEVEL: 'NONE',                // No logging
};

/**
 * Default configuration
 * Used when no specific use case is provided
 */
export const DEFAULT_CONFIG = PRODUCT_CREATION;

/**
 * Configuration registry
 * Maps use case names to their configurations
 */
export const CONFIGS = {
  PRODUCT_CREATION,
  QUICK_SCAN,
  INVENTORY,
  DEFAULT: DEFAULT_CONFIG,
};

/**
 * Get configuration for a specific use case
 * @param {string} useCase - The use case identifier
 * @returns {Object} The configuration object
 */
export function getConfig(useCase = 'DEFAULT') {
  return CONFIGS[useCase] || DEFAULT_CONFIG;
}

/**
 * Validate a configuration object
 * @param {Object} config - Configuration to validate
 * @returns {boolean} True if valid
 */
export function validateConfig(config) {
  const required = [
    'SCAN_BUFFER_SIZE',
    'MIN_CONFIDENCE_SCORE',
    'ALLOW_TIMEOUT',
    'REQUIRE_CHECKSUM',
    'MIN_READ_INTERVAL',
    'MAX_SESSION_DURATION',
    'LOG_LEVEL',
  ];

  return required.every(field => config.hasOwnProperty(field));
}

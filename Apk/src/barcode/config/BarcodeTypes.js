/**
 * Barcode Types Constants
 * 
 * Defines all supported barcode types for the POS application.
 * These types align with expo-camera's BarcodeType enum.
 */

export const BARCODE_TYPES = {
  EAN13: 'ean13',
  EAN8: 'ean8',
  UPC_A: 'upc_a',
  UPC_E: 'upc_e',
  ITF14: 'itf14',
  CODE128: 'code128',
  CODE39: 'code39',
};

/**
 * Mapping of barcode types to their expected lengths
 * Used for validation and type detection
 */
export const BARCODE_LENGTHS = {
  [BARCODE_TYPES.EAN13]: 13,
  [BARCODE_TYPES.EAN8]: 8,
  [BARCODE_TYPES.UPC_A]: 12,
  [BARCODE_TYPES.UPC_E]: 6,  // UPC-E can be 6-8 digits, typically 6
  [BARCODE_TYPES.ITF14]: 14,
  [BARCODE_TYPES.CODE128]: null,  // Variable length
  [BARCODE_TYPES.CODE39]: null,  // Variable length
};

/**
 * Mapping of barcode types to their checksum requirements
 * true = checksum validation required
 * false = no checksum or already validated by library
 */
export const CHECKSUM_REQUIREMENTS = {
  [BARCODE_TYPES.EAN13]: true,
  [BARCODE_TYPES.EAN8]: true,
  [BARCODE_TYPES.UPC_A]: true,
  [BARCODE_TYPES.UPC_E]: true,
  [BARCODE_TYPES.ITF14]: true,
  [BARCODE_TYPES.CODE128]: false,  // Has internal checksum validated by ML Kit
  [BARCODE_TYPES.CODE39]: false,  // No standard checksum
};

/**
 * Allowed barcode types for expo-camera configuration
 * This is the unified list used across all screens
 */
export const ALLOWED_BARCODE_TYPES = [
  BARCODE_TYPES.EAN13,
  BARCODE_TYPES.EAN8,
  BARCODE_TYPES.UPC_A,
  BARCODE_TYPES.UPC_E,
  BARCODE_TYPES.ITF14,
  BARCODE_TYPES.CODE128,
  BARCODE_TYPES.CODE39,
];

/**
 * Human-readable names for barcode types
 * Used for logging and user-facing messages
 */
export const BARCODE_TYPE_NAMES = {
  [BARCODE_TYPES.EAN13]: 'EAN-13',
  [BARCODE_TYPES.EAN8]: 'EAN-8',
  [BARCODE_TYPES.UPC_A]: 'UPC-A',
  [BARCODE_TYPES.UPC_E]: 'UPC-E',
  [BARCODE_TYPES.ITF14]: 'ITF-14',
  [BARCODE_TYPES.CODE128]: 'Code 128',
  [BARCODE_TYPES.CODE39]: 'Code 39',
};

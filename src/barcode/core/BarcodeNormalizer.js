/**
 * Barcode Normalizer
 * 
 * Cleans and normalizes barcode data from the camera.
 * Removes spaces, invisible characters, and control characters.
 * 
 * IMPORTANT: Does NOT modify the length of the code (no padding or truncation).
 * Only removes unwanted characters as specified.
 */

class BarcodeNormalizer {
  /**
   * Normalize a barcode scanning result
   * @param {Object} scanningResult - The raw result from expo-camera { data, type }
   * @returns {Object} Normalized result { value, type }
   */
  static normalize(scanningResult) {
    if (!scanningResult || !scanningResult.data) {
      throw new Error('Invalid scanning result: missing data');
    }

    const rawData = scanningResult.data;
    const type = scanningResult.type;

    // Remove leading/trailing whitespace
    let normalized = rawData.trim();

    // Remove invisible Unicode characters (zero-width spaces, etc.)
    normalized = this._removeInvisibleUnicode(normalized);

    // Remove line breaks and carriage returns
    normalized = this._removeLineBreaks(normalized);

    // Remove ASCII control characters (0-31, 127) except when valid for the type
    normalized = this._removeControlCharacters(normalized, type);

    return {
      value: normalized,
      type: type,
    };
  }

  /**
   * Remove invisible Unicode characters
   * These include zero-width spaces, non-breaking spaces, etc.
   */
  static _removeInvisibleUnicode(str) {
    // Remove common invisible Unicode characters
    const invisibleChars = /[\u2000-\u200F\u2028-\u202F\u205F-\u206F\uFEFF\u00A0]/g;
    return str.replace(invisibleChars, '');
  }

  /**
   * Remove line breaks and carriage returns
   */
  static _removeLineBreaks(str) {
    return str.replace(/[\r\n]+/g, '');
  }

  /**
   * Remove ASCII control characters (0-31, 127)
   * Some barcode types may include valid control characters (e.g., Code128 FNC1)
   */
  static _removeControlCharacters(str, type) {
    // For Code128, we need to be careful about control characters
    // Code128 can include FNC1 (ASCII 29) in GS1-128 barcodes
    if (type === 'code128') {
      // Only remove truly problematic control chars, keep FNC1 (ASCII 29)
      return str.replace(/[\x00-\x1C\x1E-\x1F\x7F]/g, '');
    }

    // For other types, remove all control characters
    return str.replace(/[\x00-\x1F\x7F]/g, '');
  }

  /**
   * Check if a string appears to be already normalized
   * Used for optimization to skip unnecessary processing
   */
  static isNormalized(str) {
    if (!str || typeof str !== 'string') return false;
    
    // Check for common issues
    if (str !== str.trim()) return false;
    if (/[\r\n]/.test(str)) return false;
    if (/[\x00-\x1F\x7F]/.test(str)) return false;
    if (/[\u2000-\u200F\uFEFF\u00A0]/.test(str)) return false;
    
    return true;
  }
}

export default BarcodeNormalizer;

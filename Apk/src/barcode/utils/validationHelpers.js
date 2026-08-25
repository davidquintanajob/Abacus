/**
 * Validation Helpers
 * 
 * Common validation utilities used across barcode validators.
 */

/**
 * Check if a string contains only numeric digits
 * @param {string} str - String to check
 * @returns {boolean} True if only digits
 */
export function isNumeric(str) {
  return /^\d+$/.test(str);
}

/**
 * Check if a string has a specific length
 * @param {string} str - String to check
 * @param {number} length - Expected length
 * @returns {boolean} True if length matches
 */
export function hasLength(str, length) {
  return str && str.length === length;
}

/**
 * Check if a string has a length within a range
 * @param {string} str - String to check
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @returns {boolean} True if length is within range
 */
export function hasLengthInRange(str, min, max) {
  if (!str) return false;
  return str.length >= min && str.length <= max;
}

/**
 * Check if a string contains only allowed characters
 * @param {string} str - String to check
 * @param {string} allowedChars - String of allowed characters
 * @returns {boolean} True if only allowed characters
 */
export function hasOnlyAllowedChars(str, allowedChars) {
  const regex = new RegExp(`^[${allowedChars}]+$`);
  return regex.test(str);
}

/**
 * Validate Code39 allowed characters
 * Code39 supports: 0-9, A-Z, space, and special characters -.$/+%
 * @param {string} str - String to validate
 * @returns {boolean} True if valid Code39 characters
 */
export function isValidCode39Chars(str) {
  return hasOnlyAllowedChars(str.toUpperCase(), '0-9A-Z -. $/+%');
}

/**
 * Validate Code128 allowed characters
 * Code128 supports full ASCII (0-127)
 * @param {string} str - String to validate
 * @returns {boolean} True if valid ASCII
 */
export function isValidCode128Chars(str) {
  // Check if all characters are within ASCII range
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0 || code > 127) {
      return false;
    }
  }
  return true;
}

/**
 * Remove non-numeric characters from a string
 * @param {string} str - String to clean
 * @returns {string} String with only digits
 */
export function extractDigits(str) {
  return str.replace(/\D/g, '');
}

/**
 * Pad a string with leading zeros
 * @param {string} str - String to pad
 * @param {number} length - Target length
 * @returns {string} Padded string
 */
export function padWithZeros(str, length) {
  return str.padStart(length, '0');
}

/**
 * Truncate a string to a specific length
 * @param {string} str - String to truncate
 * @param {number} length - Target length
 * @returns {string} Truncated string
 */
export function truncateToLength(str, length) {
  return str.substring(0, length);
}

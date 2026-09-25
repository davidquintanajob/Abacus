/**
 * Checksum Utilities
 * 
 * Implements checksum calculations for various barcode formats.
 * 
 * IMPORTANT: These checksums are implemented because expo-camera (ML Kit/VisionKit)
 * does NOT validate checksums for most formats. Only Code128 has internal checksum
 * validation already performed by the library.
 */

/**
 * Calculate EAN-13 checksum
 * EAN-13 uses Modulo 10 algorithm
 * @param {string} code - 12-digit code (without checksum)
 * @returns {number} The checksum digit
 */
export function calculateEAN13Checksum(code) {
  if (!code || code.length !== 12) {
    throw new Error('EAN-13 code must be 12 digits');
  }

  const digits = code.split('').map(Number);
  let sum = 0;

  // Odd positions (1, 3, 5, ...) are multiplied by 1
  // Even positions (2, 4, 6, ...) are multiplied by 3
  for (let i = 0; i < digits.length; i++) {
    const multiplier = (i % 2 === 0) ? 1 : 3;
    sum += digits[i] * multiplier;
  }

  const checksum = (10 - (sum % 10)) % 10;
  return checksum;
}

/**
 * Validate EAN-13 checksum
 * @param {string} code - 13-digit code with checksum
 * @returns {boolean} True if checksum is valid
 */
export function validateEAN13Checksum(code) {
  if (!code || code.length !== 13) {
    return false;
  }

  const data = code.substring(0, 12);
  const providedChecksum = parseInt(code[12], 10);
  const calculatedChecksum = calculateEAN13Checksum(data);

  return providedChecksum === calculatedChecksum;
}

/**
 * Calculate EAN-8 checksum
 * EAN-8 uses the same Modulo 10 algorithm as EAN-13
 * @param {string} code - 7-digit code (without checksum)
 * @returns {number} The checksum digit
 */
export function calculateEAN8Checksum(code) {
  if (!code || code.length !== 7) {
    throw new Error('EAN-8 code must be 7 digits');
  }

  const digits = code.split('').map(Number);
  let sum = 0;

  // Odd positions multiplied by 3, even positions by 1
  for (let i = 0; i < digits.length; i++) {
    const multiplier = (i % 2 === 0) ? 3 : 1;
    sum += digits[i] * multiplier;
  }

  const checksum = (10 - (sum % 10)) % 10;
  return checksum;
}

/**
 * Validate EAN-8 checksum
 * @param {string} code - 8-digit code with checksum
 * @returns {boolean} True if checksum is valid
 */
export function validateEAN8Checksum(code) {
  if (!code || code.length !== 8) {
    return false;
  }

  const data = code.substring(0, 7);
  const providedChecksum = parseInt(code[7], 10);
  const calculatedChecksum = calculateEAN8Checksum(data);

  return providedChecksum === calculatedChecksum;
}

/**
 * Calculate UPC-A checksum
 * UPC-A uses the same Modulo 10 algorithm as EAN-13
 * @param {string} code - 11-digit code (without checksum)
 * @returns {number} The checksum digit
 */
export function calculateUPCAChecksum(code) {
  if (!code || code.length !== 11) {
    throw new Error('UPC-A code must be 11 digits');
  }

  const digits = code.split('').map(Number);
  let sum = 0;

  // Odd positions multiplied by 3, even positions by 1
  for (let i = 0; i < digits.length; i++) {
    const multiplier = (i % 2 === 0) ? 3 : 1;
    sum += digits[i] * multiplier;
  }

  const checksum = (10 - (sum % 10)) % 10;
  return checksum;
}

/**
 * Validate UPC-A checksum
 * @param {string} code - 12-digit code with checksum
 * @returns {boolean} True if checksum is valid
 */
export function validateUPCAChecksum(code) {
  if (!code || code.length !== 12) {
    return false;
  }

  const data = code.substring(0, 11);
  const providedChecksum = parseInt(code[11], 10);
  const calculatedChecksum = calculateUPCAChecksum(data);

  return providedChecksum === calculatedChecksum;
}

/**
 * Validate UPC-E checksum
 * UPC-E checksums are calculated by expanding to UPC-A first
 * @param {string} code - 6-8 digit UPC-E code
 * @returns {boolean} True if checksum is valid
 */
export function validateUPCEChecksum(code) {
  if (!code || code.length < 6 || code.length > 8) {
    return false;
  }

  try {
    // Expand UPC-E to UPC-A
    const upca = expandUPCEtoUPCA(code);
    // Validate the UPC-A checksum
    return validateUPCAChecksum(upca);
  } catch (error) {
    return false;
  }
}

/**
 * Expand UPC-E to UPC-A for checksum validation
 * @param {string} upce - UPC-E code
 * @returns {string} UPC-A code
 */
function expandUPCEtoUPCA(upce) {
  // UPC-E expansion rules are complex
  // This is a simplified implementation for common cases
  const digits = upce.split('').map(Number);
  const lastDigit = digits[digits.length - 1]; // Checksum digit
  
  let upca = '';
  
  // The expansion depends on the last digit (parity pattern)
  // This is a simplified version - full implementation would handle all cases
  switch (lastDigit) {
    case 0:
      upca = `${digits[0]}${digits[1]}${digits[2]}00000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 1:
      upca = `${digits[0]}${digits[1]}${digits[2]}10000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 2:
      upca = `${digits[0]}${digits[1]}${digits[2]}20000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 3:
      upca = `${digits[0]}${digits[1]}${digits[2]}30000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 4:
      upca = `${digits[0]}${digits[1]}${digits[2]}40000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 5:
      upca = `${digits[0]}${digits[1]}${digits[2]}50000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 6:
      upca = `${digits[0]}${digits[1]}${digits[2]}60000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 7:
      upca = `${digits[0]}${digits[1]}${digits[2]}70000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 8:
      upca = `${digits[0]}${digits[1]}${digits[2]}80000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    case 9:
      upca = `${digits[0]}${digits[1]}${digits[2]}90000${digits[3]}${digits[4]}${digits[5]}`;
      break;
    default:
      throw new Error('Invalid UPC-E checksum digit');
  }

  return upca;
}

/**
 * Calculate ITF-14 checksum
 * ITF-14 uses Modulo 10 algorithm
 * @param {string} code - 13-digit code (without checksum)
 * @returns {number} The checksum digit
 */
export function calculateITF14Checksum(code) {
  if (!code || code.length !== 13) {
    throw new Error('ITF-14 code must be 13 digits');
  }

  const digits = code.split('').map(Number);
  let sum = 0;

  // Odd positions multiplied by 3, even positions by 1
  for (let i = 0; i < digits.length; i++) {
    const multiplier = (i % 2 === 0) ? 3 : 1;
    sum += digits[i] * multiplier;
  }

  const checksum = (10 - (sum % 10)) % 10;
  return checksum;
}

/**
 * Validate ITF-14 checksum
 * @param {string} code - 14-digit code with checksum
 * @returns {boolean} True if checksum is valid
 */
export function validateITF14Checksum(code) {
  if (!code || code.length !== 14) {
    return false;
  }

  const data = code.substring(0, 13);
  const providedChecksum = parseInt(code[13], 10);
  const calculatedChecksum = calculateITF14Checksum(data);

  return providedChecksum === calculatedChecksum;
}

/**
 * Validate Code128 checksum
 * Code128 has an internal checksum that is validated by ML Kit/VisionKit
 * This function is a placeholder for reference - we don't need to implement it
 * @param {string} code - Code128 code
 * @returns {boolean} Always true (validated by library)
 */
export function validateCode128Checksum(code) {
  // Code128 checksum is already validated by expo-camera (ML Kit/VisionKit)
  // No need to re-validate
  return true;
}

/**
 * Validate Code39 checksum
 * Code39 does not have a standard checksum
 * Some implementations use Modulo 43, but it's not required
 * @param {string} code - Code39 code
 * @returns {boolean} Always true (no standard checksum)
 */
export function validateCode39Checksum(code) {
  // Code39 does not have a standard checksum
  // Some variants use Modulo 43, but it's not universally required
  return true;
}

/**
 * EAN-8 Validator
 * 
 * Validates EAN-8 barcodes.
 * EAN-8: 8 digits, includes Modulo 10 checksum.
 */

import BaseValidator from './BaseValidator';
import { BARCODE_TYPES } from '../config/BarcodeTypes';
import { validateEAN8Checksum } from '../utils/checksums';
import { isNumeric, hasLength } from '../utils/validationHelpers';

class EAN8Validator extends BaseValidator {
  getType() {
    return BARCODE_TYPES.EAN8;
  }

  validateFormat(code) {
    // EAN-8 must be exactly 8 numeric digits
    if (!code) {
      return { valid: false, details: 'Code is empty' };
    }

    if (!isNumeric(code)) {
      return { valid: false, details: 'EAN-8 must contain only numeric digits' };
    }

    if (!hasLength(code, 8)) {
      return { valid: false, details: `EAN-8 must be exactly 8 digits, got ${code.length}` };
    }

    return { valid: true, details: 'Format valid' };
  }

  validateChecksum(code) {
    try {
      const isValid = validateEAN8Checksum(code);
      return {
        valid: isValid,
        details: isValid ? 'Checksum valid' : 'Checksum invalid',
      };
    } catch (error) {
      return {
        valid: false,
        details: `Checksum validation error: ${error.message}`,
      };
    }
  }
}

export default EAN8Validator;

/**
 * EAN-13 Validator
 * 
 * Validates EAN-13 barcodes.
 * EAN-13: 13 digits, includes Modulo 10 checksum.
 */

import BaseValidator from './BaseValidator';
import { BARCODE_TYPES } from '../config/BarcodeTypes';
import { validateEAN13Checksum } from '../utils/checksums';
import { isNumeric, hasLength } from '../utils/validationHelpers';

class EAN13Validator extends BaseValidator {
  getType() {
    return BARCODE_TYPES.EAN13;
  }

  validateFormat(code) {
    // EAN-13 must be exactly 13 numeric digits
    if (!code) {
      return { valid: false, details: 'Code is empty' };
    }

    if (!isNumeric(code)) {
      return { valid: false, details: 'EAN-13 must contain only numeric digits' };
    }

    if (!hasLength(code, 13)) {
      return { valid: false, details: `EAN-13 must be exactly 13 digits, got ${code.length}` };
    }

    return { valid: true, details: 'Format valid' };
  }

  validateChecksum(code) {
    try {
      const isValid = validateEAN13Checksum(code);
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

export default EAN13Validator;

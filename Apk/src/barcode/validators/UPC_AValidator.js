/**
 * UPC-A Validator
 * 
 * Validates UPC-A barcodes.
 * UPC-A: 12 digits, includes Modulo 10 checksum.
 */

import BaseValidator from './BaseValidator';
import { BARCODE_TYPES } from '../config/BarcodeTypes';
import { validateUPCAChecksum } from '../utils/checksums';
import { isNumeric, hasLength } from '../utils/validationHelpers';

class UPC_AValidator extends BaseValidator {
  getType() {
    return BARCODE_TYPES.UPC_A;
  }

  validateFormat(code) {
    // UPC-A must be exactly 12 numeric digits
    if (!code) {
      return { valid: false, details: 'Code is empty' };
    }

    if (!isNumeric(code)) {
      return { valid: false, details: 'UPC-A must contain only numeric digits' };
    }

    if (!hasLength(code, 12)) {
      return { valid: false, details: `UPC-A must be exactly 12 digits, got ${code.length}` };
    }

    return { valid: true, details: 'Format valid' };
  }

  validateChecksum(code) {
    try {
      const isValid = validateUPCAChecksum(code);
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

export default UPC_AValidator;

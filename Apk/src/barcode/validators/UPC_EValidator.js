/**
 * UPC-E Validator
 * 
 * Validates UPC-E barcodes.
 * UPC-E: 6-8 digits, includes checksum (validated by expanding to UPC-A).
 */

import BaseValidator from './BaseValidator';
import { BARCODE_TYPES } from '../config/BarcodeTypes';
import { validateUPCEChecksum } from '../utils/checksums';
import { isNumeric, hasLengthInRange } from '../utils/validationHelpers';

class UPC_EValidator extends BaseValidator {
  getType() {
    return BARCODE_TYPES.UPC_E;
  }

  validateFormat(code) {
    // UPC-E is typically 6-8 digits
    if (!code) {
      return { valid: false, details: 'Code is empty' };
    }

    if (!isNumeric(code)) {
      return { valid: false, details: 'UPC-E must contain only numeric digits' };
    }

    if (!hasLengthInRange(code, 6, 8)) {
      return { valid: false, details: `UPC-E must be 6-8 digits, got ${code.length}` };
    }

    return { valid: true, details: 'Format valid' };
  }

  validateChecksum(code) {
    try {
      const isValid = validateUPCEChecksum(code);
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

export default UPC_EValidator;

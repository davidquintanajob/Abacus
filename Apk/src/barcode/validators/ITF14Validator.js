/**
 * ITF-14 Validator
 * 
 * Validates ITF-14 barcodes.
 * ITF-14: 14 digits, includes Modulo 10 checksum.
 */

import BaseValidator from './BaseValidator';
import { BARCODE_TYPES } from '../config/BarcodeTypes';
import { validateITF14Checksum } from '../utils/checksums';
import { isNumeric, hasLength } from '../utils/validationHelpers';

class ITF14Validator extends BaseValidator {
  getType() {
    return BARCODE_TYPES.ITF14;
  }

  validateFormat(code) {
    // ITF-14 must be exactly 14 numeric digits
    if (!code) {
      return { valid: false, details: 'Code is empty' };
    }

    if (!isNumeric(code)) {
      return { valid: false, details: 'ITF-14 must contain only numeric digits' };
    }

    if (!hasLength(code, 14)) {
      return { valid: false, details: `ITF-14 must be exactly 14 digits, got ${code.length}` };
    }

    return { valid: true, details: 'Format valid' };
  }

  validateChecksum(code) {
    try {
      const isValid = validateITF14Checksum(code);
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

export default ITF14Validator;

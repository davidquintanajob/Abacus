/**
 * Code 39 Validator
 * 
 * Validates Code 39 barcodes.
 * Code 39: Variable length, no standard checksum (optional Modulo 43).
 * 
 * IMPORTANT: Code 39 does not have a standard checksum. Some implementations
 * use Modulo 43, but it's not universally required. We only validate format.
 */

import BaseValidator from './BaseValidator';
import { BARCODE_TYPES } from '../config/BarcodeTypes';
import { validateCode39Checksum } from '../utils/checksums';
import { isValidCode39Chars, hasLengthInRange } from '../utils/validationHelpers';

class Code39Validator extends BaseValidator {
  getType() {
    return BARCODE_TYPES.CODE39;
  }

  validateFormat(code) {
    // Code 39 supports variable length (typically 1-43 characters)
    if (!code) {
      return { valid: false, details: 'Code is empty' };
    }

    if (!hasLengthInRange(code, 1, 43)) {
      return { valid: false, details: `Code 39 must be 1-43 characters, got ${code.length}` };
    }

    if (!isValidCode39Chars(code)) {
      return { valid: false, details: 'Code 39 must contain only 0-9, A-Z, space, and -.$/+%' };
    }

    return { valid: true, details: 'Format valid' };
  }

  validateChecksum(code) {
    // Code 39 does not have a standard checksum
    // Some variants use Modulo 43, but it's not universally required
    const isValid = validateCode39Checksum(code);
    return {
      valid: isValid,
      details: 'Code 39 has no standard checksum (optional Modulo 43 not validated)',
    };
  }
}

export default Code39Validator;

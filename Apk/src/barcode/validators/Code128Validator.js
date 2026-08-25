/**
 * Code 128 Validator
 * 
 * Validates Code 128 barcodes.
 * Code 128: Variable length, has internal checksum validated by ML Kit/VisionKit.
 * 
 * IMPORTANT: We do NOT validate the checksum because expo-camera (ML Kit/VisionKit)
 * already validates it internally. We only validate character set.
 */

import BaseValidator from './BaseValidator';
import { BARCODE_TYPES } from '../config/BarcodeTypes';
import { validateCode128Checksum } from '../utils/checksums';
import { isValidCode128Chars, hasLengthInRange } from '../utils/validationHelpers';

class Code128Validator extends BaseValidator {
  getType() {
    return BARCODE_TYPES.CODE128;
  }

  validateFormat(code) {
    // Code 128 supports variable length (typically 1-80 characters)
    if (!code) {
      return { valid: false, details: 'Code is empty' };
    }

    if (!hasLengthInRange(code, 1, 80)) {
      return { valid: false, details: `Code 128 must be 1-80 characters, got ${code.length}` };
    }

    if (!isValidCode128Chars(code)) {
      return { valid: false, details: 'Code 128 must contain only ASCII characters' };
    }

    return { valid: true, details: 'Format valid' };
  }

  validateChecksum(code) {
    // Code 128 checksum is already validated by expo-camera (ML Kit/VisionKit)
    // We trust the library's validation
    const isValid = validateCode128Checksum(code);
    return {
      valid: isValid,
      details: 'Checksum validated by library (ML Kit/VisionKit)',
    };
  }
}

export default Code128Validator;

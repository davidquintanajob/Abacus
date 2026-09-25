/**
 * QR Code Validator
 * 
 * Validator for QR codes.
 * QR codes contain the product barcode data and have built-in error correction,
 * so we primarily validate that the content is not empty and contains valid characters.
 */

import BaseValidator from './BaseValidator';
import { BARCODE_TYPES } from '../config/BarcodeTypes';

class QRValidator extends BaseValidator {
  constructor(logger) {
    super(logger);
  }

  getType() {
    return BARCODE_TYPES.QR;
  }

  /**
   * Validate QR code format
   * QR codes can contain any printable ASCII characters
   * We check that the content is not empty and contains valid characters
   */
  validateFormat(code) {
    if (!code || code.length === 0) {
      return { valid: false, details: 'QR code content is empty' };
    }

    // QR codes can contain any printable ASCII characters
    // We just check that it's not empty and contains valid characters
    const validChars = /^[\x20-\x7E]+$/;
    if (!validChars.test(code)) {
      return { valid: false, details: 'QR code contains invalid characters' };
    }

    return { valid: true, details: 'QR code format is valid' };
  }

  /**
   * QR codes have built-in error correction, so no checksum validation is needed
   */
  validateChecksum(code) {
    return { valid: true, details: 'QR codes have built-in error correction' };
  }
}

export default QRValidator;

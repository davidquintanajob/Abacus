/**
 * Validator Factory
 * 
 * Factory pattern for creating barcode validators based on barcode type.
 * Implements the Strategy pattern by returning the appropriate validator.
 */

import { BARCODE_TYPES } from '../config/BarcodeTypes';
import EAN13Validator from './EAN13Validator';
import EAN8Validator from './EAN8Validator';
import UPC_AValidator from './UPC_AValidator';
import UPC_EValidator from './UPC_EValidator';
import ITF14Validator from './ITF14Validator';
import Code128Validator from './Code128Validator';
import Code39Validator from './Code39Validator';

class ValidatorFactory {
  constructor(logger) {
    this.logger = logger;
    
    // Initialize validators
    this.validators = {
      [BARCODE_TYPES.EAN13]: new EAN13Validator(logger),
      [BARCODE_TYPES.EAN8]: new EAN8Validator(logger),
      [BARCODE_TYPES.UPC_A]: new UPC_AValidator(logger),
      [BARCODE_TYPES.UPC_E]: new UPC_EValidator(logger),
      [BARCODE_TYPES.ITF14]: new ITF14Validator(logger),
      [BARCODE_TYPES.CODE128]: new Code128Validator(logger),
      [BARCODE_TYPES.CODE39]: new Code39Validator(logger),
    };
  }

  /**
   * Get a validator for a specific barcode type
   * @param {string} type - The barcode type
   * @returns {BaseValidator} The appropriate validator
   */
  getValidator(type) {
    const validator = this.validators[type];
    
    if (!validator) {
      this.logger.warn('FACTORY', 'No validator found for type', { type });
      throw new Error(`No validator available for barcode type: ${type}`);
    }

    this.logger.debug('FACTORY', 'Validator retrieved', { type });
    return validator;
  }

  /**
   * Check if a validator exists for a type
   * @param {string} type - The barcode type
   * @returns {boolean} True if validator exists
   */
  hasValidator(type) {
    return this.validators.hasOwnProperty(type);
  }

  /**
   * Get all supported types
   * @returns {string[]} Array of supported barcode types
   */
  getSupportedTypes() {
    return Object.keys(this.validators);
  }
}

export default ValidatorFactory;

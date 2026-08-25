/**
 * Base Validator
 * 
 * Abstract base class for barcode validators.
 * All specific validators must extend this class.
 */

class BaseValidator {
  constructor(logger) {
    if (this.constructor === BaseValidator) {
      throw new Error('BaseValidator is abstract and cannot be instantiated');
    }
    this.logger = logger;
  }

  /**
   * Get the barcode type this validator handles
   * Must be implemented by subclasses
   */
  getType() {
    throw new Error('getType() must be implemented by subclass');
  }

  /**
   * Validate a barcode code
   * Must be implemented by subclasses
   * @param {string} code - The barcode value to validate
   * @returns {Object} Validation result { valid: boolean, details: string }
   */
  validate(code) {
    throw new Error('validate() must be implemented by subclass');
  }

  /**
   * Validate the format (length, characters, etc.)
   * Can be overridden by subclasses
   * @param {string} code - The barcode value
   * @returns {Object} Format validation result
   */
  validateFormat(code) {
    return { valid: true, details: 'Format validation not implemented' };
  }

  /**
   * Validate the checksum
   * Can be overridden by subclasses
   * @param {string} code - The barcode value
   * @returns {Object} Checksum validation result
   */
  validateChecksum(code) {
    return { valid: true, details: 'Checksum validation not required' };
  }

  /**
   * Perform complete validation (format + checksum)
   * @param {string} code - The barcode value
   * @returns {Object} Complete validation result
   */
  validate(code) {
    this.logger.debug('VALIDATOR', `Validating ${this.getType()} code`, { code });

    const formatResult = this.validateFormat(code);
    if (!formatResult.valid) {
      this.logger.warn('VALIDATOR', 'Format validation failed', {
        type: this.getType(),
        code,
        details: formatResult.details,
      });
      return {
        valid: false,
        details: formatResult.details,
        format: formatResult,
        checksum: { valid: true, details: 'Skipped due to format error' },
      };
    }

    const checksumResult = this.validateChecksum(code);
    if (!checksumResult.valid) {
      this.logger.warn('VALIDATOR', 'Checksum validation failed', {
        type: this.getType(),
        code,
        details: checksumResult.details,
      });
      return {
        valid: false,
        details: checksumResult.details,
        format: formatResult,
        checksum: checksumResult,
      };
    }

    this.logger.info('VALIDATOR', 'Validation passed', {
      type: this.getType(),
      code,
    });

    return {
      valid: true,
      details: 'Validation passed',
      format: formatResult,
      checksum: checksumResult,
    };
  }
}

export default BaseValidator;

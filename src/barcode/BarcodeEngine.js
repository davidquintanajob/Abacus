/**
 * Barcode Engine
 * 
 * Main orchestrator for barcode scanning and validation.
 * Coordinates all components: Normalizer, Session, Confirmator, Validators.
 * 
 * This is the primary interface that screens should use.
 */

import BarcodeLogger from './core/BarcodeLogger';
import BarcodeNormalizer from './core/BarcodeNormalizer';
import { BarcodeSession, SessionState } from './core/BarcodeSession';
import BarcodeConfirmator from './core/BarcodeConfirmator';
import BarcodeResult from './BarcodeResult';
import { getConfig, ALLOWED_BARCODE_TYPES } from './config/BarcodeConfig';
import { BARCODE_TYPE_NAMES } from './config/BarcodeTypes';
import ValidatorFactory from './validators/ValidatorFactory';

class BarcodeEngine {
  constructor(useCase = 'PRODUCT_CREATION', customConfig = {}) {
    // Merge custom config with use case config
    const baseConfig = getConfig(useCase);
    this.config = { ...baseConfig, ...customConfig };
    
    // Initialize components
    this.logger = new BarcodeLogger(this.config);
    this.session = new BarcodeSession(this.config, this.logger);
    this.confirmator = new BarcodeConfirmator(this.config, this.logger);
    this.validatorFactory = new ValidatorFactory(this.logger);
    
    // Business rules callback (optional)
    this.businessRulesCallback = null;
    
    this.logger.info('ENGINE', 'BarcodeEngine initialized', {
      useCase,
      config: this.config,
    });
  }

  /**
   * Set a callback for business rules validation
   * @param {Function} callback - Function that receives { code, type } and returns { valid, details }
   */
  setBusinessRulesCallback(callback) {
    this.businessRulesCallback = callback;
    this.logger.info('ENGINE', 'Business rules callback set');
  }

  /**
   * Start a new scanning session
   * @returns {boolean} True if session started successfully
   */
  startSession() {
    this.confirmator.clear();
    this.logger.resetSession();
    return this.session.start();
  }

  /**
   * Process a barcode scanning result from the camera
   * @param {Object} scanningResult - Raw result from expo-camera { data, type }
   * @returns {Promise<BarcodeResult>} The validation result
   */
  async processScanningResult(scanningResult) {
    const startTime = Date.now();

    try {
      // Phase 1: Normalize
      const normalized = BarcodeNormalizer.normalize(scanningResult);
      this.logger.debug('ENGINE', 'Code normalized', {
        original: scanningResult.data,
        normalized: normalized.value,
        type: normalized.type,
      });

      // Phase 2: Get validator
      const validator = this.validatorFactory.getValidator(normalized.type);
      
      // Phase 3: Quick checksum validation (fast path)
      if (this.config.REQUIRE_CHECKSUM) {
        const checksumResult = validator.validateChecksum(normalized.value);
        
        if (!checksumResult.valid) {
          this.logger.warn('ENGINE', 'Checksum validation failed', {
            code: normalized.value,
            type: normalized.type,
            details: checksumResult.details,
          });

          return BarcodeResult.failure(
            checksumResult.details,
            normalized.value,
            normalized.type,
            { checksumValid: false },
            { checksum: checksumResult }
          );
        }
      }

      // Phase 4: Full validation
      const validationResult = validator.validate(normalized.value);
      
      if (!validationResult.valid) {
        this.logger.warn('ENGINE', 'Validation failed', {
          code: normalized.value,
          type: normalized.type,
          details: validationResult.details,
        });

        return BarcodeResult.failure(
          validationResult.details,
          normalized.value,
          normalized.type,
          { checksumValid: validationResult.checksum?.valid || false },
          {
            checksum: validationResult.checksum,
            format: validationResult.format,
          }
        );
      }

      // Phase 5: Business rules validation
      let businessResult = { valid: true, details: 'No business rules' };
      if (this.businessRulesCallback) {
        try {
          businessResult = await this.businessRulesCallback({
            code: normalized.value,
            type: normalized.type,
          });
        } catch (error) {
          this.logger.error('ENGINE', 'Business rules callback error', { error });
          businessResult = { valid: false, details: 'Business rules error' };
        }
      }

      if (!businessResult.valid) {
        this.logger.warn('ENGINE', 'Business rules validation failed', {
          code: normalized.value,
          details: businessResult.details,
        });

        return BarcodeResult.failure(
          businessResult.details,
          normalized.value,
          normalized.type,
          { checksumValid: validationResult.checksum?.valid || false },
          {
            checksum: validationResult.checksum,
            format: validationResult.format,
            business: businessResult,
          }
        );
      }

      // Phase 6: Success
      const processingTime = Date.now() - startTime;

      const finalMetrics = {
        checksumValid: validationResult.checksum?.valid || false,
        processingTime,
      };

      const finalConfidenceScore = 1.0; // Full confidence if checksum passed

      this.logger.info('ENGINE', 'Barcode accepted', {
        code: normalized.value,
        type: normalized.type,
        confidenceScore: finalConfidenceScore,
        processingTime,
      });

      return BarcodeResult.success(
        normalized.value,
        normalized.type,
        finalConfidenceScore,
        finalMetrics,
        {
          checksum: validationResult.checksum,
          format: validationResult.format,
          business: businessResult,
        },
        `Code validated with checksum`
      );

    } catch (error) {
      this.logger.error('ENGINE', 'Processing error', { error });
      
      return BarcodeResult.failure(
        `Processing error: ${error.message}`,
        null,
        null
      );
    }
  }

  /**
   * Get the current session state
   * @returns {string} The session state
   */
  getSessionState() {
    return this.session.getState();
  }

  /**
   * Get the current buffer state
   * @returns {Object} Buffer state
   */
  getBufferState() {
    return this.confirmator.getBufferState();
  }

  /**
   * Reset the current session
   */
  resetSession() {
    this.session.reset();
    this.confirmator.clear();
    this.logger.info('ENGINE', 'Session reset');
  }

  /**
   * Get the allowed barcode types for expo-camera configuration
   * @returns {string[]} Array of allowed barcode types
   */
  static getAllowedBarcodeTypes() {
    return ALLOWED_BARCODE_TYPES;
  }

  /**
   * Get human-readable name for a barcode type
   * @param {string} type - Barcode type
   * @returns {string} Human-readable name
   */
  static getTypeName(type) {
    return BARCODE_TYPE_NAMES[type] || type;
  }
}

export default BarcodeEngine;

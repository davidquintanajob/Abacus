/**
 * Barcode Result
 * 
 * Represents the complete result of a barcode scanning operation.
 * Includes the code, type, confidence score, metrics, and validation details.
 */

class BarcodeResult {
  constructor(options = {}) {
    this.success = options.success || false;
    this.code = options.code || null;
    this.type = options.type || null;
    this.confidenceScore = options.confidenceScore || 0;
    this.metrics = options.metrics || this._createDefaultMetrics();
    this.validations = options.validations || this._createDefaultValidations();
    this.rejectionReason = options.rejectionReason || null;
    this.acceptanceReason = options.acceptanceReason || null;
    this.sessionId = options.sessionId || null;
    this.timestamp = options.timestamp || new Date().toISOString();
  }

  _createDefaultMetrics() {
    return {
      bufferConsistency: 0,
      typeStability: 0,
      checksumValid: false,
      readQuality: 0,
      totalReads: 0,
      processingTime: 0,
      dominantValue: null,
      bufferContents: [],
    };
  }

  _createDefaultValidations() {
    return {
      checksum: { passed: false, details: 'Not validated' },
      format: { passed: false, details: 'Not validated' },
      business: { passed: false, details: 'Not validated' },
    };
  }

  /**
   * Create a successful result
   */
  static success(code, type, confidenceScore, metrics, validations, reason) {
    return new BarcodeResult({
      success: true,
      code,
      type,
      confidenceScore,
      metrics,
      validations,
      acceptanceReason: reason,
    });
  }

  /**
   * Create a failed result
   */
  static failure(reason, code = null, type = null, metrics = null, validations = null) {
    return new BarcodeResult({
      success: false,
      code,
      type,
      rejectionReason: reason,
      metrics: metrics || this._createDefaultMetrics(),
      validations: validations || this._createDefaultValidations(),
    });
  }

  /**
   * Update metrics
   */
  updateMetrics(metrics) {
    this.metrics = { ...this.metrics, ...metrics };
  }

  /**
   * Update a specific validation
   */
  updateValidation(validationType, passed, details) {
    if (this.validations[validationType]) {
      this.validations[validationType] = { passed, details };
    }
  }

  /**
   * Check if all validations passed
   */
  allValidationsPassed() {
    return Object.values(this.validations).every(v => v.passed);
  }

  /**
   * Get a summary of the result for logging
   */
  toSummary() {
    return {
      success: this.success,
      code: this.code,
      type: this.type,
      confidenceScore: this.confidenceScore,
      rejectionReason: this.rejectionReason,
      acceptanceReason: this.acceptanceReason,
    };
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON() {
    return {
      success: this.success,
      code: this.code,
      type: this.type,
      confidenceScore: this.confidenceScore,
      metrics: this.metrics,
      validations: this.validations,
      rejectionReason: this.rejectionReason,
      acceptanceReason: this.acceptanceReason,
      sessionId: this.sessionId,
      timestamp: this.timestamp,
    };
  }
}

export default BarcodeResult;

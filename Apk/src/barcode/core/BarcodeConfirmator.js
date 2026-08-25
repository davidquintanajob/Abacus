/**
 * Barcode Confirmator
 * 
 * Implements the sliding buffer algorithm for confirming barcode reads.
 * Calculates confidence scores based on multiple factors:
 * - Buffer consistency (dominant value ratio)
 * - Type stability (consistency of detected barcode type)
 * - Read quality (timing between reads)
 */

class BarcodeConfirmator {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.buffer = [];
    this.bufferSize = config.SCAN_BUFFER_SIZE;
    this.readTimestamps = [];
  }

  /**
   * Add a read to the buffer
   * @param {Object} read - { value, type, timestamp }
   */
  addRead(read) {
    this.buffer.push(read);
    this.readTimestamps.push(read.timestamp || Date.now());

    // Maintain buffer size
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
      this.readTimestamps.shift();
    }

    this.logger.trace('CONFIRMATOR', 'Read added to buffer', {
      value: read.value,
      type: read.type,
      bufferSize: this.buffer.length,
    });
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = [];
    this.readTimestamps = [];
    this.logger.trace('CONFIRMATOR', 'Buffer cleared');
  }

  /**
   * Check if buffer has enough reads to analyze
   */
  hasEnoughReads() {
    return this.buffer.length >= Math.ceil(this.bufferSize * 0.6);
  }

  /**
   * Analyze the buffer and calculate confidence score
   * @returns {Object} Analysis result with confidence score and metrics
   */
  analyze() {
    if (!this.hasEnoughReads()) {
      this.logger.debug('CONFIRMATOR', 'Not enough reads to analyze', {
        current: this.buffer.length,
        required: Math.ceil(this.bufferSize * 0.6),
      });
      return {
        ready: false,
        confidenceScore: 0,
        dominantValue: null,
        metrics: this._createEmptyMetrics(),
      };
    }

    // Calculate metrics
    const bufferConsistency = this._calculateBufferConsistency();
    const typeStability = this._calculateTypeStability();
    const readQuality = this._calculateReadQuality();
    const dominantValue = this._getDominantValue();

    // Calculate confidence score
    // Weights: bufferConsistency 40%, typeStability 20%, readQuality 15%
    // checksumValid 25% (added later by validator)
    const confidenceScore = (bufferConsistency * 0.40) + 
                            (typeStability * 0.20) + 
                            (readQuality * 0.15);

    const metrics = {
      bufferConsistency,
      typeStability,
      readQuality,
      totalReads: this.buffer.length,
      dominantValue,
      bufferContents: [...this.buffer],
    };

    this.logger.debug('CONFIRMATOR', 'Buffer analysis complete', {
      confidenceScore,
      dominantValue,
      metrics,
    });

    return {
      ready: true,
      confidenceScore,
      dominantValue,
      metrics,
    };
  }

  /**
   * Calculate buffer consistency (ratio of dominant value)
   */
  _calculateBufferConsistency() {
    if (this.buffer.length === 0) return 0;

    const valueCounts = {};
    this.buffer.forEach(read => {
      const key = read.value;
      valueCounts[key] = (valueCounts[key] || 0) + 1;
    });

    const counts = Object.values(valueCounts);
    const maxCount = Math.max(...counts);
    const consistency = maxCount / this.buffer.length;

    this.logger.trace('CONFIRMATOR', 'Buffer consistency calculated', {
      consistency,
      valueCounts,
    });

    return consistency;
  }

  /**
   * Calculate type stability (consistency of detected type)
   */
  _calculateTypeStability() {
    if (this.buffer.length === 0) return 0;

    const typeCounts = {};
    this.buffer.forEach(read => {
      const type = read.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const dominantTypeCount = Math.max(...Object.values(typeCounts));
    const stability = dominantTypeCount / this.buffer.length;

    this.logger.trace('CONFIRMATOR', 'Type stability calculated', {
      stability,
      typeCounts,
    });

    return stability;
  }

  /**
   * Calculate read quality based on timing
   * Very rapid reads may indicate noise
   */
  _calculateReadQuality() {
    if (this.readTimestamps.length < 2) return 1.0;

    const intervals = [];
    for (let i = 1; i < this.readTimestamps.length; i++) {
      intervals.push(this.readTimestamps[i] - this.readTimestamps[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // If reads are too fast (< 50ms average), it's likely noise
    // If reads are reasonable (> 100ms average), quality is good
    let quality = 1.0;
    if (avgInterval < 50) {
      quality = 0.5;
    } else if (avgInterval < 80) {
      quality = 0.7;
    } else if (avgInterval >= 100) {
      quality = 1.0;
    }

    this.logger.trace('CONFIRMATOR', 'Read quality calculated', {
      quality,
      avgInterval,
    });

    return quality;
  }

  /**
   * Get the dominant value in the buffer
   */
  _getDominantValue() {
    if (this.buffer.length === 0) return null;

    const valueCounts = {};
    this.buffer.forEach(read => {
      const key = read.value;
      valueCounts[key] = (valueCounts[key] || 0) + 1;
    });

    let dominantValue = null;
    let maxCount = 0;

    Object.entries(valueCounts).forEach(([value, count]) => {
      if (count > maxCount) {
        maxCount = count;
        dominantValue = value;
      }
    });

    return dominantValue;
  }

  /**
   * Check if the dominant value meets the minimum confidence threshold
   */
  meetsThreshold(confidenceScore, checksumValid = false) {
    // Add checksum to confidence score if valid
    const finalScore = confidenceScore + (checksumValid ? 0.25 : 0);
    
    const meetsThreshold = finalScore >= this.config.MIN_CONFIDENCE_SCORE;

    this.logger.debug('CONFIRMATOR', 'Threshold check', {
      confidenceScore,
      checksumValid,
      finalScore,
      threshold: this.config.MIN_CONFIDENCE_SCORE,
      meetsThreshold,
    });

    return meetsThreshold;
  }

  /**
   * Create empty metrics object
   */
  _createEmptyMetrics() {
    return {
      bufferConsistency: 0,
      typeStability: 0,
      readQuality: 0,
      totalReads: 0,
      dominantValue: null,
      bufferContents: [],
    };
  }

  /**
   * Get current buffer state
   */
  getBufferState() {
    return {
      buffer: [...this.buffer],
      bufferSize: this.buffer.length,
      maxSize: this.bufferSize,
    };
  }
}

export default BarcodeConfirmator;

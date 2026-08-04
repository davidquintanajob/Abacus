/**
 * Barcode Session
 * 
 * Manages the state of a barcode scanning session.
 * Prevents parallel processing and provides explicit session states.
 */

const SessionState = {
  IDLE: 'IDLE',
  ACCUMULATING: 'ACCUMULATING',
  VALIDATING: 'VALIDATING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
};

class BarcodeSession {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.state = SessionState.IDLE;
    this.startTime = null;
    this.endTime = null;
    this.isProcessing = false;
    this.sessionId = logger.sessionId;
  }

  /**
   * Start a new session
   */
  start() {
    if (this.state !== SessionState.IDLE) {
      this.logger.warn('SESSION', 'Session already active', { currentState: this.state });
      return false;
    }

    this.state = SessionState.ACCUMULATING;
    this.startTime = Date.now();
    this.isProcessing = true;
    this.endTime = null;

    this.logger.info('SESSION', 'Session started', { sessionId: this.sessionId });
    return true;
  }

  /**
   * Transition to validating state
   */
  beginValidation() {
    if (this.state !== SessionState.ACCUMULATING) {
      this.logger.warn('SESSION', 'Cannot begin validation from current state', { currentState: this.state });
      return false;
    }

    this.state = SessionState.VALIDATING;
    this.logger.debug('SESSION', 'Session transitioned to VALIDATING', { sessionId: this.sessionId });
    return true;
  }

  /**
   * Complete the session successfully
   */
  complete() {
    if (this.state !== SessionState.VALIDATING && this.state !== SessionState.ACCUMULATING) {
      this.logger.warn('SESSION', 'Cannot complete from current state', { currentState: this.state });
      return false;
    }

    this.state = SessionState.COMPLETED;
    this.endTime = Date.now();
    this.isProcessing = false;

    const duration = this.endTime - this.startTime;
    this.logger.info('SESSION', 'Session completed', { 
      sessionId: this.sessionId,
      duration,
    });
    return true;
  }

  /**
   * Reject the session
   */
  reject(reason) {
    this.state = SessionState.REJECTED;
    this.endTime = Date.now();
    this.isProcessing = false;

    const duration = this.endTime - this.startTime;
    this.logger.info('SESSION', 'Session rejected', { 
      sessionId: this.sessionId,
      reason,
      duration,
    });
  }

  /**
   * Reset the session to IDLE
   */
  reset() {
    this.state = SessionState.IDLE;
    this.startTime = null;
    this.endTime = null;
    this.isProcessing = false;

    this.logger.debug('SESSION', 'Session reset', { sessionId: this.sessionId });
  }

  /**
   * Check if the session is active
   */
  isActive() {
    return this.state !== SessionState.IDLE && 
           this.state !== SessionState.COMPLETED && 
           this.state !== SessionState.REJECTED;
  }

  /**
   * Check if the session is processing (prevents parallel reads)
   */
  isSessionProcessing() {
    return this.isProcessing;
  }

  /**
   * Check if the session has timed out
   */
  hasTimedOut() {
    if (!this.startTime || !this.config.ALLOW_TIMEOUT) {
      return false;
    }

    const elapsed = Date.now() - this.startTime;
    return elapsed > this.config.MAX_SESSION_DURATION;
  }

  /**
   * Get the current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get session duration
   */
  getDuration() {
    if (!this.startTime) return 0;
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }
}

export { SessionState, BarcodeSession };

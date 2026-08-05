/**
 * Barcode Logger
 * 
 * Structured logging system for barcode scanning operations.
 * Provides detailed debugging information with configurable log levels.
 */

const LOG_LEVELS = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  TRACE: 5,
};

class BarcodeLogger {
  constructor(config = {}) {
    this.level = this._parseLevel(config.LOG_LEVEL || 'NONE');
    this.sessionId = this._generateSessionId();
    this.enabled = config.ENABLE_LOGGING !== false;
  }

  _parseLevel(levelName) {
    return LOG_LEVELS[levelName] || LOG_LEVELS.INFO;
  }

  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _shouldLog(level) {
    return this.enabled && level <= this.level;
  }

  _formatLog(level, phase, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: this._getLevelName(level),
      phase,
      message,
      ...data,
    };
  }

  _getLevelName(level) {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level) || 'UNKNOWN';
  }

  _log(level, phase, message, data) {
    if (!this._shouldLog(level)) return;

    const logEntry = this._formatLog(level, phase, message, data);
    
    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error('[BarcodeLogger]', logEntry);
        break;
      case LOG_LEVELS.WARN:
        console.warn('[BarcodeLogger]', logEntry);
        break;
      case LOG_LEVELS.INFO:
        console.info('[BarcodeLogger]', logEntry);
        break;
      case LOG_LEVELS.DEBUG:
      case LOG_LEVELS.TRACE:
        console.log('[BarcodeLogger]', logEntry);
        break;
    }
  }

  error(phase, message, data) {
    this._log(LOG_LEVELS.ERROR, phase, message, data);
  }

  warn(phase, message, data) {
    this._log(LOG_LEVELS.WARN, phase, message, data);
  }

  info(phase, message, data) {
    this._log(LOG_LEVELS.INFO, phase, message, data);
  }

  debug(phase, message, data) {
    this._log(LOG_LEVELS.DEBUG, phase, message, data);
  }

  trace(phase, message, data) {
    this._log(LOG_LEVELS.TRACE, phase, message, data);
  }

  resetSession() {
    this.sessionId = this._generateSessionId();
  }

  setLevel(levelName) {
    this.level = this._parseLevel(levelName);
  }
}

export default BarcodeLogger;

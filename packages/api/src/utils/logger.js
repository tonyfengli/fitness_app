"use strict";
/**
 * Simple logger utility that can be controlled by environment variables
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
var LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
var currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'error'];
var isDevelopment = process.env.NODE_ENV !== 'production';
var Logger = /** @class */ (function () {
    function Logger(context) {
        this.context = context;
    }
    Logger.prototype.shouldLog = function (level) {
        return LOG_LEVELS[level] >= currentLogLevel;
    };
    Logger.prototype.formatMessage = function (level, message, data) {
        if (!this.shouldLog(level))
            return;
        var timestamp = new Date().toISOString();
        var prefix = "[".concat(timestamp, "] [").concat(level.toUpperCase(), "] [").concat(this.context, "]");
        switch (level) {
            case 'debug':
                if (isDevelopment) {
                    console.debug(prefix, message, data || '');
                }
                break;
            case 'info':
                if (isDevelopment) {
                    console.info(prefix, message, data || '');
                }
                break;
            case 'warn':
                console.warn(prefix, message, data || '');
                break;
            case 'error':
                console.error(prefix, message, data || '');
                break;
        }
    };
    Logger.prototype.debug = function (message, data) {
        this.formatMessage('debug', message, data);
    };
    Logger.prototype.info = function (message, data) {
        this.formatMessage('info', message, data);
    };
    Logger.prototype.warn = function (message, data) {
        this.formatMessage('warn', message, data);
    };
    Logger.prototype.error = function (message, data) {
        this.formatMessage('error', message, data);
    };
    /**
     * Log performance metrics (only in development)
     */
    Logger.prototype.performance = function (operation, duration, details) {
        if (isDevelopment && duration > 100) {
            this.warn("Slow operation: ".concat(operation, " took ").concat(duration, "ms"), details);
        }
    };
    return Logger;
}());
function createLogger(context) {
    return new Logger(context);
}

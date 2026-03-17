/**
 * Enhanced Error Handler Middleware
 * Comprehensive error handling for new appointment scheduling features
 */

const { getPool } = require('../db');

class EnhancedErrorHandler {
    constructor() {
        this.errorTypes = {
            VALIDATION_ERROR: 'VALIDATION_ERROR',
            RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
            SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
            PRIORITY_ERROR: 'PRIORITY_ERROR',
            INTEGRATION_ERROR: 'INTEGRATION_ERROR',
            DATABASE_ERROR: 'DATABASE_ERROR',
            AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
            AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
            NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
            BUSINESS_RULE_ERROR: 'BUSINESS_RULE_ERROR'
        };

        this.errorMessages = {
            [this.errorTypes.VALIDATION_ERROR]: 'Invalid input data provided',
            [this.errorTypes.RESOURCE_CONFLICT]: 'Resource scheduling conflict detected',
            [this.errorTypes.SCHEDULE_CONFLICT]: 'Provider schedule conflict detected',
            [this.errorTypes.PRIORITY_ERROR]: 'Priority assignment error',
            [this.errorTypes.INTEGRATION_ERROR]: 'Integration service error',
            [this.errorTypes.DATABASE_ERROR]: 'Database operation failed',
            [this.errorTypes.AUTHENTICATION_ERROR]: 'Authentication required',
            [this.errorTypes.AUTHORIZATION_ERROR]: 'Insufficient permissions',
            [this.errorTypes.NOT_FOUND_ERROR]: 'Requested resource not found',
            [this.errorTypes.BUSINESS_RULE_ERROR]: 'Business rule violation'
        };
    }

    /**
     * Main error handling middleware
     */
    handleError() {
        return (err, req, res, next) => {
            // Log error details
            this.logError(err, req);

            // Determine error type and create response
            const errorResponse = this.createErrorResponse(err, req);

            // Send response
            res.status(errorResponse.statusCode).json(errorResponse.body);
        };
    }

    /**
     * Async error wrapper for route handlers
     */
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Validation error handler
     */
    validationError(errors) {
        const error = new Error('Validation failed');
        error.type = this.errorTypes.VALIDATION_ERROR;
        error.details = errors;
        error.statusCode = 400;
        return error;
    }

    /**
     * Resource conflict error handler
     */
    resourceConflictError(conflicts, suggestedAlternatives = []) {
        const error = new Error('Resource scheduling conflict detected');
        error.type = this.errorTypes.RESOURCE_CONFLICT;
        error.details = {
            conflicts: conflicts,
            suggested_alternatives: suggestedAlternatives
        };
        error.statusCode = 409;
        return error;
    }

    /**
     * Schedule conflict error handler
     */
    scheduleConflictError(exceptions, conflictingAppointments = []) {
        const error = new Error('Provider schedule conflict detected');
        error.type = this.errorTypes.SCHEDULE_CONFLICT;
        error.details = {
            schedule_exceptions: exceptions,
            conflicting_appointments: conflictingAppointments
        };
        error.statusCode = 409;
        return error;
    }

    /**
     * Priority error handler
     */
    priorityError(message, details = {}) {
        const error = new Error(message);
        error.type = this.errorTypes.PRIORITY_ERROR;
        error.details = details;
        error.statusCode = 400;
        return error;
    }

    /**
     * Integration service error handler
     */
    integrationError(serviceName, method, originalError) {
        const error = new Error(`Integration service error: ${serviceName}.${method}`);
        error.type = this.errorTypes.INTEGRATION_ERROR;
        error.details = {
            service: serviceName,
            method: method,
            original_error: originalError.message,
            error_type: originalError.constructor.name
        };
        error.statusCode = 503;
        return error;
    }

    /**
     * Business rule violation error handler
     */
    businessRuleError(rule, violation, details = {}) {
        const error = new Error(`Business rule violation: ${rule}`);
        error.type = this.errorTypes.BUSINESS_RULE_ERROR;
        error.details = {
            rule: rule,
            violation: violation,
            ...details
        };
        error.statusCode = 422;
        return error;
    }

    /**
     * Create standardized error response
     */
    createErrorResponse(err, req) {
        const isDevelopment = process.env.NODE_ENV === 'development';

        // Determine error type
        const errorType = err.type || this.classifyError(err);
        const statusCode = err.statusCode || this.getStatusCodeForError(errorType);

        // Base error response
        const errorResponse = {
            success: false,
            error: err.message || this.errorMessages[errorType] || 'An unexpected error occurred',
            error_type: errorType,
            timestamp: new Date().toISOString(),
            request_id: req.id || this.generateRequestId()
        };
        console.log('DEBUG: createErrorResponse req.id:', req.id, 'generated:', errorResponse.request_id);

        // Add error details if available
        if (err.details) {
            errorResponse.details = err.details;
        }

        // Add stack trace in development
        if (isDevelopment && err.stack) {
            errorResponse.stack = err.stack;
        }

        // Add suggestions for specific error types
        if (errorType === this.errorTypes.RESOURCE_CONFLICT && err.details?.suggested_alternatives) {
            errorResponse.suggestions = {
                message: 'Consider these alternative time slots',
                alternatives: err.details.suggested_alternatives
            };
        }

        if (errorType === this.errorTypes.SCHEDULE_CONFLICT && err.details?.schedule_exceptions) {
            errorResponse.suggestions = {
                message: 'Provider is not available during the requested time',
                exceptions: err.details.schedule_exceptions.map(e => ({
                    type: e.tipo_excepcion,
                    reason: e.motivo,
                    start: e.fecha_inicio,
                    end: e.fecha_fin
                }))
            };
        }

        return {
            statusCode: statusCode,
            body: errorResponse
        };
    }

    /**
     * Classify unknown errors
     */
    classifyError(err) {
        // Database errors
        if (err.code && (err.code.startsWith('ER_') || err.code.startsWith('23'))) {
            return this.errorTypes.DATABASE_ERROR;
        }

        // Validation errors
        if (err.name === 'ValidationError' || err.message.includes('validation')) {
            return this.errorTypes.VALIDATION_ERROR;
        }

        // Authentication errors
        if (err.name === 'UnauthorizedError' || err.message.includes('unauthorized')) {
            return this.errorTypes.AUTHENTICATION_ERROR;
        }

        // Not found errors
        if (err.message.includes('not found') || err.message.includes('does not exist')) {
            return this.errorTypes.NOT_FOUND_ERROR;
        }

        // Integration errors
        if (err.message.includes('Python service') || err.message.includes('integration')) {
            return this.errorTypes.INTEGRATION_ERROR;
        }

        // Resource conflicts
        if (err.message.includes('resource') && err.message.includes('conflict')) {
            return this.errorTypes.RESOURCE_CONFLICT;
        }

        // Schedule conflicts
        if (err.message.includes('schedule') && err.message.includes('conflict')) {
            return this.errorTypes.SCHEDULE_CONFLICT;
        }

        // Default to generic error
        return 'UNKNOWN_ERROR';
    }

    /**
     * Get appropriate HTTP status code for error type
     */
    getStatusCodeForError(errorType) {
        const statusCodes = {
            [this.errorTypes.VALIDATION_ERROR]: 400,
            [this.errorTypes.RESOURCE_CONFLICT]: 409,
            [this.errorTypes.SCHEDULE_CONFLICT]: 409,
            [this.errorTypes.PRIORITY_ERROR]: 400,
            [this.errorTypes.INTEGRATION_ERROR]: 503,
            [this.errorTypes.DATABASE_ERROR]: 500,
            [this.errorTypes.AUTHENTICATION_ERROR]: 401,
            [this.errorTypes.AUTHORIZATION_ERROR]: 403,
            [this.errorTypes.NOT_FOUND_ERROR]: 404,
            [this.errorTypes.BUSINESS_RULE_ERROR]: 422
        };

        return statusCodes[errorType] || 500;
    }

    /**
     * Log error with context
     */
    async logError(err, req) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            error_type: err.type || 'UNKNOWN_ERROR',
            message: err.message,
            stack: err.stack,
            request: {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body,
                params: req.params,
                query: req.query,
                user_id: req.user?.id
            },
            details: err.details
        };

        // Log to console
        console.error('Enhanced Error Handler:', JSON.stringify(errorLog, null, 2));

        // Log to database if possible
        try {
            await this.logToDatabase(errorLog);
        } catch (dbError) {
            console.error('Failed to log error to database:', dbError);
        }
    }

    /**
     * Log error to database
     */
    async logToDatabase(errorLog) {
        try {
            const pool = getPool();
            if (!pool) return;

            await pool.query(`
                INSERT INTO LOGS_ERRORES (
                    tipo_error, mensaje, detalles, contexto_request,
                    usuario_id, fecha_hora
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `, [
                errorLog.error_type,
                errorLog.message,
                JSON.stringify(errorLog.details || {}),
                JSON.stringify(errorLog.request),
                errorLog.request.user_id || null
            ]);
        } catch (error) {
            // Silently fail database logging to avoid infinite loops
            console.warn('Database error logging failed:', error.message);
        }
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Request ID middleware
     */
    requestId() {
        return (req, res, next) => {
            req.id = this.generateRequestId();
            res.setHeader('X-Request-ID', req.id);
            next();
        };
    }

    /**
     * Rate limiting error handler
     */
    rateLimitError(limit, windowMs) {
        const error = new Error('Too many requests');
        error.type = 'RATE_LIMIT_ERROR';
        error.details = {
            limit: limit,
            window_ms: windowMs,
            retry_after: Math.ceil(windowMs / 1000)
        };
        error.statusCode = 429;
        return error;
    }

    /**
     * Timeout error handler
     */
    timeoutError(operation, timeoutMs) {
        const error = new Error(`Operation timeout: ${operation}`);
        error.type = 'TIMEOUT_ERROR';
        error.details = {
            operation: operation,
            timeout_ms: timeoutMs
        };
        error.statusCode = 408;
        return error;
    }

    /**
     * Circuit breaker error handler
     */
    circuitBreakerError(service, state) {
        const error = new Error(`Service unavailable: ${service}`);
        error.type = 'CIRCUIT_BREAKER_ERROR';
        error.details = {
            service: service,
            circuit_state: state,
            retry_after: 60 // seconds
        };
        error.statusCode = 503;
        return error;
    }
}

// Create singleton instance
const enhancedErrorHandler = new EnhancedErrorHandler();

module.exports = enhancedErrorHandler;
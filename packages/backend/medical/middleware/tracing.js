const { trace } = require('@opentelemetry/api');

/**
 * Middleware to extract OpenTelemetry Trace ID and attach it to the response headers.
 */
const tracingMiddleware = (req, res, next) => {
    const currentSpan = trace.getActiveSpan();

    if (currentSpan) {
        const { traceId } = currentSpan.spanContext();
        // Add Trace ID to response headers
        res.setHeader('X-Trace-Id', traceId);
        // Attach Trace ID to the request object for use in controllers/services
        req.traceId = traceId;
        console.log(`[Tracing] Request processed with Trace ID: ${traceId}`);
    }

    next();
};

module.exports = tracingMiddleware;

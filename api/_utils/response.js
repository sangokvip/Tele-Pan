// Utility functions for standardized API responses

/**
 * Set CORS headers for Vercel serverless functions
 * @param {Object} res - Response object
 */
export function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Handle preflight OPTIONS requests
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {boolean} - True if handled, false otherwise
 */
export function handlePreflight(req, res) {
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res);
        res.status(200).end();
        return true;
    }
    return false;
}

/**
 * Validate HTTP method
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string|Array} allowedMethods - Allowed HTTP methods
 * @returns {boolean} - True if valid, false otherwise
 */
export function validateMethod(req, res, allowedMethods) {
    const methods = Array.isArray(allowedMethods) ? allowedMethods : [allowedMethods];
    
    if (!methods.includes(req.method)) {
        res.status(405).json({
            error: 'Method not allowed',
            allowedMethods: methods
        });
        return false;
    }
    return true;
}

/**
 * Create standardized success response
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} - Standardized response object
 */
export function createSuccessResponse(data, message = 'Success') {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    };
}

/**
 * Create standardized error response
 * @param {string} error - Error message
 * @param {number} code - Error code (optional)
 * @returns {Object} - Standardized error response object
 */
export function createErrorResponse(error, code = null) {
    return {
        success: false,
        error,
        code,
        timestamp: new Date().toISOString()
    };
}

/**
 * Handle and log errors consistently
 * @param {Error} error - Error object
 * @param {Object} res - Response object
 * @param {string} context - Context where error occurred
 */
export function handleError(error, res, context = 'API') {
    console.error(`${context} error:`, error);
    
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const errorMessage = isDevelopment ? error.message : 'Internal server error';
    
    res.status(500).json(createErrorResponse(errorMessage));
}
// Health check endpoint for Vercel Serverless Function
import { setCorsHeaders, handlePreflight, validateMethod, createSuccessResponse, handleError } from './_utils/response.js';

export default async function handler(req, res) {
    // Set CORS headers
    setCorsHeaders(res);
    
    // Handle preflight requests
    if (handlePreflight(req, res)) {
        return;
    }
    
    // Only allow GET requests
    if (!validateMethod(req, res, 'GET')) {
        return;
    }
    
    try {
        // Check environment variables
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        
        const healthData = {
            status: 'healthy',
            service: 'telegram-media-uploader',
            version: '1.0.0',
            environment: {
                botTokenConfigured: !!botToken,
                chatIdConfigured: !!chatId,
                nodeVersion: process.version
            }
        };
        
        return res.status(200).json(createSuccessResponse(healthData, 'Service is healthy'));
        
    } catch (error) {
        handleError(error, res, 'Health check');
    }
}
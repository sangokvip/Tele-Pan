// Simplified upload endpoint without formidable
const { setCorsHeaders, handlePreflight, validateMethod, createSuccessResponse, createErrorResponse } = require('./_utils/response.js');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export default async function handler(req, res) {
    setCorsHeaders(res);
    
    if (handlePreflight(req, res)) {
        return;
    }
    
    if (!validateMethod(req, res, 'POST')) {
        return;
    }
    
    try {
        console.log('Simple upload test started');
        console.log('Headers:', req.headers);
        
        // Check if we can access the request body
        console.log('Request body type:', typeof req.body);
        console.log('Request method:', req.method);
        
        // Try to read raw body
        const chunks = [];
        req.on('data', chunk => {
            chunks.push(chunk);
        });
        
        req.on('end', () => {
            const body = Buffer.concat(chunks);
            console.log('Body length:', body.length);
            console.log('Body preview:', body.slice(0, 100).toString());
            
            return res.status(200).json(createSuccessResponse({
                message: 'Simple upload test successful',
                bodyLength: body.length,
                contentType: req.headers['content-type']
            }));
        });
        
    } catch (error) {
        console.error('Simple upload error:', error);
        return res.status(500).json(createErrorResponse(error.message));
    }
}
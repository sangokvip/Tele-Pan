// Debug version of upload endpoint
const { setCorsHeaders, handlePreflight, validateMethod, createSuccessResponse, createErrorResponse } = require('./_utils/response.js');

export default async function handler(req, res) {
    setCorsHeaders(res);
    
    if (handlePreflight(req, res)) {
        return;
    }
    
    if (!validateMethod(req, res, 'POST')) {
        return;
    }
    
    try {
        console.log('Debug upload started');
        console.log('Headers:', req.headers);
        console.log('Method:', req.method);
        
        // Check environment variables
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        
        console.log('Bot token configured:', !!botToken);
        console.log('Chat ID configured:', !!chatId);
        
        if (!botToken || !chatId) {
            return res.status(500).json(createErrorResponse('Environment variables not configured'));
        }
        
        // Try to parse form data
        const formidable = require('formidable');
        const form = formidable({
            maxFileSize: 50 * 1024 * 1024,
            keepExtensions: true,
        });
        
        console.log('Parsing form data...');
        const [fields, files] = await form.parse(req);
        console.log('Form parsed successfully');
        console.log('Fields:', Object.keys(fields));
        console.log('Files:', Object.keys(files));
        
        const file = files.file?.[0];
        if (!file) {
            return res.status(400).json(createErrorResponse('No file found in request'));
        }
        
        console.log('File details:', {
            name: file.originalFilename,
            size: file.size,
            type: file.mimetype,
            path: file.filepath
        });
        
        // Just return success without actually uploading to Telegram
        return res.status(200).json(createSuccessResponse({
            message: 'Debug successful - file received but not uploaded',
            file: {
                name: file.originalFilename,
                size: file.size,
                type: file.mimetype
            }
        }));
        
    } catch (error) {
        console.error('Debug upload error:', error);
        console.error('Error stack:', error.stack);
        
        return res.status(500).json(createErrorResponse(
            `Debug error: ${error.message}`
        ));
    }
}
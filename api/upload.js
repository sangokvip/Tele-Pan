// Vercel Serverless Function for file upload
const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { setCorsHeaders, handlePreflight, validateMethod, createSuccessResponse, createErrorResponse, handleError } = require('./_utils/response.js');

// Telegram Bot configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/avi', 'video/mov', 'video/webm'];

export default async function handler(req, res) {
    // Set CORS headers
    setCorsHeaders(res);
    
    // Handle preflight requests
    if (handlePreflight(req, res)) {
        return;
    }
    
    // Only allow POST requests
    if (!validateMethod(req, res, 'POST')) {
        return;
    }
    
    // Check configuration
    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json(createErrorResponse('Telegram Bot Token not configured'));
    }
    
    if (!TELEGRAM_CHAT_ID) {
        return res.status(500).json(createErrorResponse('Telegram Chat ID not configured'));
    }
    
    try {
        console.log('Upload request started');
        console.log('Request method:', req.method);
        console.log('Content-Type:', req.headers['content-type']);
        
        // Parse the uploaded file
        const form = formidable({
            maxFileSize: 50 * 1024 * 1024, // 50MB limit for Vercel
            keepExtensions: true,
        });
        
        console.log('Parsing form data...');
        const [fields, files] = await form.parse(req);
        console.log('Form parsing completed');
        console.log('Files received:', Object.keys(files));
        
        const file = files.file?.[0];
        
        if (!file) {
            return res.status(400).json(createErrorResponse('No file uploaded'));
        }
        
        // Validate file type more strictly
        const isImage = SUPPORTED_IMAGE_TYPES.includes(file.mimetype);
        const isVideo = SUPPORTED_VIDEO_TYPES.includes(file.mimetype);
        
        if (!isImage && !isVideo) {
            return res.status(400).json(createErrorResponse(
                `Unsupported file type: ${file.mimetype}. Supported types: ${[...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES].join(', ')}`
            ));
        }
        
        // Log file info for debugging
        console.log(`Processing file: ${file.originalFilename}, type: ${file.mimetype}, size: ${file.size} bytes`);
        
        // Send to Telegram
        const telegramResult = await sendToTelegram(file, isImage);
        
        // Clean up temporary file
        try {
            fs.unlinkSync(file.filepath);
        } catch (cleanupError) {
            console.error('Failed to cleanup temp file:', cleanupError);
        }
        
        if (telegramResult.success) {
            return res.status(200).json(createSuccessResponse({
                filename: file.originalFilename,
                fileSize: file.size,
                fileType: file.mimetype,
                telegramMessageId: telegramResult.messageId
            }, 'File uploaded successfully to Telegram'));
        } else {
            console.error('Telegram upload failed:', telegramResult);
            return res.status(500).json(createErrorResponse(
                `Telegram upload failed: ${telegramResult.error}. Retry count: ${telegramResult.retryCount || 0}`
            ));
        }
        
    } catch (error) {
        console.error('Upload error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        handleError(error, res, 'File upload');
    }
}

async function sendToTelegram(file, isImage, retryCount = 0) {
    const FormData = require('form-data');
    const axios = require('axios');
    
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s
    
    try {
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID);
        
        const fileStream = fs.createReadStream(file.filepath);
        const fieldName = isImage ? 'photo' : 'video';
        form.append(fieldName, fileStream, file.originalFilename);
        
        const method = isImage ? 'sendPhoto' : 'sendVideo';
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
        
        console.log(`Sending ${isImage ? 'image' : 'video'} to Telegram (attempt ${retryCount + 1})`);
        
        const response = await axios.post(url, form, {
            headers: form.getHeaders(),
            timeout: 30000, // 30 second timeout
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
        
        if (response.data.ok) {
            console.log(`Successfully sent file to Telegram, message ID: ${response.data.result.message_id}`);
            return {
                success: true,
                messageId: response.data.result.message_id
            };
        } else {
            throw new Error(response.data.description || 'Telegram API returned error');
        }
        
    } catch (error) {
        console.error(`Telegram API error (attempt ${retryCount + 1}):`, error.message);
        
        // Check if we should retry
        const shouldRetry = retryCount < MAX_RETRIES && isRetryableError(error);
        
        if (shouldRetry) {
            const delay = RETRY_DELAYS[retryCount];
            console.log(`Retrying in ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendToTelegram(file, isImage, retryCount + 1);
        }
        
        return {
            success: false,
            error: error.response?.data?.description || error.message,
            retryCount: retryCount + 1
        };
    }
}

function isRetryableError(error) {
    // Retry on network errors, timeouts, and specific Telegram API errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        return true;
    }
    
    // Retry on 429 (Too Many Requests) and 5xx server errors
    if (error.response) {
        const status = error.response.status;
        return status === 429 || (status >= 500 && status < 600);
    }
    
    return false;
}
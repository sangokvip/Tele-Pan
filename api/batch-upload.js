// Vercel Serverless Function for batch file upload
const formidable = require('formidable');
const fs = require('fs');
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
        // Parse the uploaded files
        const form = formidable({
            maxFileSize: 50 * 1024 * 1024, // 50MB limit for Vercel
            keepExtensions: true,
            multiples: true, // Allow multiple files
        });
        
        const [fields, files] = await form.parse(req);
        const uploadedFiles = files.files || [];
        
        if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json(createErrorResponse('No files uploaded'));
        }
        
        console.log(`Processing ${uploadedFiles.length} files for batch upload`);
        
        // Process each file
        const results = [];
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const result = await processFile(file, i + 1, uploadedFiles.length);
            results.push(result);
        }
        
        // Calculate summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        return res.status(200).json(createSuccessResponse({
            results,
            summary: {
                total: uploadedFiles.length,
                successful,
                failed
            }
        }, `Batch upload completed: ${successful} successful, ${failed} failed`));
        
    } catch (error) {
        handleError(error, res, 'Batch file upload');
    }
}

async function processFile(file, index, total) {
    try {
        console.log(`Processing file ${index}/${total}: ${file.originalFilename}`);
        
        // Validate file type
        const isImage = SUPPORTED_IMAGE_TYPES.includes(file.mimetype);
        const isVideo = SUPPORTED_VIDEO_TYPES.includes(file.mimetype);
        
        if (!isImage && !isVideo) {
            return {
                success: false,
                filename: file.originalFilename,
                error: `Unsupported file type: ${file.mimetype}`
            };
        }
        
        // Send to Telegram
        const telegramResult = await sendToTelegram(file, isImage);
        
        // Clean up temporary file
        try {
            fs.unlinkSync(file.filepath);
        } catch (cleanupError) {
            console.error('Failed to cleanup temp file:', cleanupError);
        }
        
        if (telegramResult.success) {
            return {
                success: true,
                filename: file.originalFilename,
                fileSize: file.size,
                fileType: file.mimetype,
                telegramMessageId: telegramResult.messageId
            };
        } else {
            return {
                success: false,
                filename: file.originalFilename,
                error: telegramResult.error,
                retryCount: telegramResult.retryCount
            };
        }
        
    } catch (error) {
        console.error(`Error processing file ${file.originalFilename}:`, error);
        return {
            success: false,
            filename: file.originalFilename,
            error: error.message
        };
    }
}

async function sendToTelegram(file, isImage, retryCount = 0) {
    const FormData = require('form-data');
    
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
        
        const response = await fetch(url, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
            return {
                success: true,
                messageId: data.result.message_id
            };
        } else {
            throw new Error(data.description || 'Telegram API returned error');
        }
        
    } catch (error) {
        console.error(`Telegram API error for ${file.originalFilename} (attempt ${retryCount + 1}):`, error.message);
        
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
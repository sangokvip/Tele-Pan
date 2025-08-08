// Alternative upload endpoint without formidable
const { setCorsHeaders, handlePreflight, validateMethod, createSuccessResponse, createErrorResponse, handleError } = require('./_utils/response.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Telegram Bot configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/avi', 'video/mov', 'video/webm'];

export default async function handler(req, res) {
    setCorsHeaders(res);
    
    if (handlePreflight(req, res)) {
        return;
    }
    
    if (!validateMethod(req, res, 'POST')) {
        return;
    }
    
    if (!TELEGRAM_BOT_TOKEN) {
        return res.status(500).json(createErrorResponse('Telegram Bot Token not configured'));
    }
    
    if (!TELEGRAM_CHAT_ID) {
        return res.status(500).json(createErrorResponse('Telegram Chat ID not configured'));
    }
    
    try {
        console.log('Upload v2 request started');
        console.log('Content-Type:', req.headers['content-type']);
        
        // Parse multipart data manually
        const fileData = await parseMultipartData(req);
        
        if (!fileData) {
            return res.status(400).json(createErrorResponse('No file uploaded'));
        }
        
        console.log('File parsed:', {
            filename: fileData.filename,
            size: fileData.buffer.length,
            mimetype: fileData.mimetype
        });
        
        // Validate file type
        const isImage = SUPPORTED_IMAGE_TYPES.includes(fileData.mimetype);
        const isVideo = SUPPORTED_VIDEO_TYPES.includes(fileData.mimetype);
        
        if (!isImage && !isVideo) {
            return res.status(400).json(createErrorResponse(
                `Unsupported file type: ${fileData.mimetype}. Supported types: ${[...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_VIDEO_TYPES].join(', ')}`
            ));
        }
        
        // Create temporary file
        const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${fileData.filename}`);
        fs.writeFileSync(tempFilePath, fileData.buffer);
        
        console.log('Temporary file created:', tempFilePath);
        
        // Send to Telegram
        const telegramResult = await sendToTelegram({
            filepath: tempFilePath,
            originalFilename: fileData.filename,
            size: fileData.buffer.length,
            mimetype: fileData.mimetype
        }, isImage);
        
        // Clean up temporary file
        try {
            fs.unlinkSync(tempFilePath);
            console.log('Temporary file cleaned up');
        } catch (cleanupError) {
            console.error('Failed to cleanup temp file:', cleanupError);
        }
        
        if (telegramResult.success) {
            return res.status(200).json(createSuccessResponse({
                filename: fileData.filename,
                fileSize: fileData.buffer.length,
                fileType: fileData.mimetype,
                telegramMessageId: telegramResult.messageId
            }, 'File uploaded successfully to Telegram'));
        } else {
            console.error('Telegram upload failed:', telegramResult);
            return res.status(500).json(createErrorResponse(
                `Telegram upload failed: ${telegramResult.error}. Retry count: ${telegramResult.retryCount || 0}`
            ));
        }
        
    } catch (error) {
        console.error('Upload v2 error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        handleError(error, res, 'File upload v2');
    }
}

// Manual multipart parser
async function parseMultipartData(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalLength = 0;
        
        req.on('data', chunk => {
            chunks.push(chunk);
            totalLength += chunk.length;
        });
        
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks, totalLength);
                const contentType = req.headers['content-type'];
                
                if (!contentType || !contentType.includes('multipart/form-data')) {
                    resolve(null);
                    return;
                }
                
                // Extract boundary
                const boundaryMatch = contentType.match(/boundary=(.+)$/);
                if (!boundaryMatch) {
                    resolve(null);
                    return;
                }
                
                const boundary = '--' + boundaryMatch[1];
                const textDecoder = new TextDecoder();
                
                // Split by boundary
                const parts = buffer.toString('binary').split(boundary);
                
                for (const part of parts) {
                    if (part.includes('Content-Disposition: form-data') && part.includes('filename=')) {
                        // Extract filename
                        const filenameMatch = part.match(/filename="([^"]+)"/);
                        if (!filenameMatch) continue;
                        
                        const filename = filenameMatch[1];
                        
                        // Extract content type
                        const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                        const mimetype = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
                        
                        // Find the start of binary data (after double CRLF)
                        const headerEndIndex = part.indexOf('\r\n\r\n');
                        if (headerEndIndex === -1) continue;
                        
                        // Extract binary data
                        const binaryStart = headerEndIndex + 4;
                        const binaryEnd = part.lastIndexOf('\r\n');
                        
                        if (binaryEnd <= binaryStart) continue;
                        
                        const binaryData = part.substring(binaryStart, binaryEnd);
                        const fileBuffer = Buffer.from(binaryData, 'binary');
                        
                        resolve({
                            filename,
                            mimetype,
                            buffer: fileBuffer
                        });
                        return;
                    }
                }
                
                resolve(null);
            } catch (error) {
                reject(error);
            }
        });
        
        req.on('error', reject);
    });
}

async function sendToTelegram(file, isImage, retryCount = 0) {
    const FormData = require('form-data');
    
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 4000];
    
    try {
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID);
        
        const fileStream = fs.createReadStream(file.filepath);
        const fieldName = isImage ? 'photo' : 'video';
        form.append(fieldName, fileStream, file.originalFilename);
        
        const method = isImage ? 'sendPhoto' : 'sendVideo';
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
        
        console.log(`Sending ${isImage ? 'image' : 'video'} to Telegram (attempt ${retryCount + 1})`);
        
        const response = await fetch(url, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
            console.log(`Successfully sent file to Telegram, message ID: ${data.result.message_id}`);
            return {
                success: true,
                messageId: data.result.message_id
            };
        } else {
            throw new Error(data.description || 'Telegram API returned error');
        }
        
    } catch (error) {
        console.error(`Telegram API error (attempt ${retryCount + 1}):`, error.message);
        
        const shouldRetry = retryCount < MAX_RETRIES && isRetryableError(error);
        
        if (shouldRetry) {
            const delay = RETRY_DELAYS[retryCount];
            console.log(`Retrying in ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendToTelegram(file, isImage, retryCount + 1);
        }
        
        return {
            success: false,
            error: error.message,
            retryCount: retryCount + 1
        };
    }
}

function isRetryableError(error) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        return true;
    }
    
    return false;
}
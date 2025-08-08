// Working upload endpoint based on successful simple-upload
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
        console.log('Working upload started');
        console.log('Bot token configured:', !!TELEGRAM_BOT_TOKEN);
        console.log('Chat ID configured:', !!TELEGRAM_CHAT_ID);
        
        if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
            return res.status(500).json(createErrorResponse('Environment variables not configured'));
        }
        
        // Parse multipart data (same as simple-upload)
        const fileData = await parseMultipartData(req);
        
        if (!fileData) {
            return res.status(400).json(createErrorResponse('No file uploaded'));
        }
        
        console.log('File parsed successfully:', {
            filename: fileData.filename,
            size: fileData.buffer.length,
            mimetype: fileData.mimetype
        });
        
        // Validate file type
        const isImage = fileData.mimetype.startsWith('image/') || 
                       ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileData.filename.toLowerCase().split('.').pop());
        
        if (!isImage) {
            return res.status(400).json(createErrorResponse('Only image files are supported for now'));
        }
        
        // Send to Telegram using the simplest method
        const telegramResult = await sendToTelegramSimple(fileData);
        
        if (telegramResult.success) {
            return res.status(200).json(createSuccessResponse({
                filename: fileData.filename,
                fileSize: fileData.buffer.length,
                fileType: fileData.mimetype,
                telegramMessageId: telegramResult.messageId
            }, 'File uploaded successfully to Telegram'));
        } else {
            return res.status(500).json(createErrorResponse(
                `Telegram upload failed: ${telegramResult.error}`
            ));
        }
        
    } catch (error) {
        console.error('Working upload error:', error);
        return res.status(500).json(createErrorResponse(error.message));
    }
}

// Simple multipart parser (same as simple-upload)
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
                
                const boundaryMatch = contentType.match(/boundary=(.+)$/);
                if (!boundaryMatch) {
                    resolve(null);
                    return;
                }
                
                const boundary = '--' + boundaryMatch[1];
                const parts = buffer.toString('binary').split(boundary);
                
                for (const part of parts) {
                    if (part.includes('Content-Disposition: form-data') && part.includes('filename=')) {
                        const filenameMatch = part.match(/filename="([^"]+)"/);
                        if (!filenameMatch) continue;
                        
                        const filename = filenameMatch[1];
                        const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                        const mimetype = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
                        
                        const headerEndIndex = part.indexOf('\r\n\r\n');
                        if (headerEndIndex === -1) continue;
                        
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

// Simple Telegram sender using fetch and JSON
async function sendToTelegramSimple(fileData) {
    try {
        console.log('Sending to Telegram using simple method...');
        
        // Convert to base64
        const base64Data = fileData.buffer.toString('base64');
        console.log('Base64 data length:', base64Data.length);
        
        // Use sendDocument with base64 data
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
        const payload = {
            chat_id: TELEGRAM_CHAT_ID,
            document: `data:${fileData.mimetype};base64,${base64Data}`,
            caption: `📎 ${fileData.filename}`
        };
        
        console.log('Sending request to Telegram API...');
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('Telegram API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('Telegram API error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Telegram API response:', data);
        
        if (data.ok) {
            console.log('Successfully sent to Telegram, message ID:', data.result.message_id);
            return {
                success: true,
                messageId: data.result.message_id
            };
        } else {
            throw new Error(data.description || 'Telegram API returned error');
        }
        
    } catch (error) {
        console.error('Telegram send error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
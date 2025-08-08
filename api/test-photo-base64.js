// Test sending photo using base64 encoding
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
        console.log('Base64 photo test started');
        
        // Parse multipart data to get file
        const fileData = await parseMultipartData(req);
        
        if (!fileData) {
            return res.status(400).json(createErrorResponse('No file uploaded'));
        }
        
        console.log('File received:', {
            filename: fileData.filename,
            size: fileData.buffer.length,
            mimetype: fileData.mimetype
        });
        
        // Convert to base64
        const base64Data = fileData.buffer.toString('base64');
        console.log('Base64 length:', base64Data.length);
        
        // Send using sendDocument with base64
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                document: `data:${fileData.mimetype};base64,${base64Data}`,
                caption: `📎 Base64测试文件: ${fileData.filename}`
            })
        });
        
        const data = await response.json();
        console.log('Telegram response:', data);
        
        if (response.ok && data.ok) {
            return res.status(200).json(createSuccessResponse({
                filename: fileData.filename,
                fileSize: fileData.buffer.length,
                fileType: fileData.mimetype,
                telegramMessageId: data.result.message_id,
                method: 'base64'
            }, 'Base64 photo test successful'));
        } else {
            return res.status(400).json(createErrorResponse(
                `Telegram API error: ${data.description || 'Unknown error'}`
            ));
        }
        
    } catch (error) {
        console.error('Base64 photo test error:', error);
        return res.status(500).json(createErrorResponse(error.message));
    }
}

// Simple multipart parser (reused from upload-v2)
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
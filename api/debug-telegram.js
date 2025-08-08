// Debug Telegram API calls
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
        console.log('Debug Telegram API call started');
        console.log('Bot Token:', TELEGRAM_BOT_TOKEN ? 'Configured' : 'Missing');
        console.log('Chat ID:', TELEGRAM_CHAT_ID ? 'Configured' : 'Missing');
        
        // Test 1: Send a simple text message
        console.log('Test 1: Sending text message...');
        const textResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: `🔧 调试测试 - ${new Date().toISOString()}`
            })
        });
        
        const textData = await textResponse.json();
        console.log('Text message response:', textData);
        
        if (!textData.ok) {
            return res.status(400).json(createErrorResponse(
                `Text message failed: ${textData.description}`
            ));
        }
        
        // Test 2: Try to send a photo using URL (no file upload)
        console.log('Test 2: Sending photo via URL...');
        const photoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                photo: 'https://via.placeholder.com/300x200.png?text=Test+Image',
                caption: '测试图片 - 通过URL发送'
            })
        });
        
        const photoData = await photoResponse.json();
        console.log('Photo URL response:', photoData);
        
        return res.status(200).json(createSuccessResponse({
            textMessage: {
                success: textData.ok,
                messageId: textData.result?.message_id,
                error: textData.description
            },
            photoUrl: {
                success: photoData.ok,
                messageId: photoData.result?.message_id,
                error: photoData.description
            }
        }, 'Telegram API debug test completed'));
        
    } catch (error) {
        console.error('Debug Telegram error:', error);
        return res.status(500).json(createErrorResponse(error.message));
    }
}
// Simple test endpoint for Telegram connection
const { setCorsHeaders, handlePreflight, validateMethod, createSuccessResponse, createErrorResponse } = require('./_utils/response.js');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export default async function handler(req, res) {
    setCorsHeaders(res);
    
    if (handlePreflight(req, res)) {
        return;
    }
    
    if (!validateMethod(req, res, 'GET')) {
        return;
    }
    
    try {
        console.log('Testing Telegram connection...');
        console.log('Bot token configured:', !!TELEGRAM_BOT_TOKEN);
        console.log('Chat ID configured:', !!TELEGRAM_CHAT_ID);
        
        // Use fetch instead of axios for better Vercel compatibility
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: TELEGRAM_CHAT_ID,
            text: `测试消息 - ${new Date().toISOString()}`
        };
        
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
            return res.status(200).json(createSuccessResponse({
                messageId: data.result.message_id,
                chatId: data.result.chat.id,
                chatTitle: data.result.chat.title || 'Unknown'
            }, 'Test message sent successfully'));
        } else {
            return res.status(500).json(createErrorResponse(data.description || 'Telegram API error'));
        }
        
    } catch (error) {
        console.error('Telegram test error:', error);
        return res.status(500).json(createErrorResponse(error.message));
    }
}
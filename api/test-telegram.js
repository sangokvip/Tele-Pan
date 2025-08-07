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
        // Test sending a simple message
        const axios = require('axios');
        
        const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `测试消息 - ${new Date().toISOString()}`
        });
        
        if (response.data.ok) {
            return res.status(200).json(createSuccessResponse({
                messageId: response.data.result.message_id,
                chatId: response.data.result.chat.id,
                chatTitle: response.data.result.chat.title
            }, 'Test message sent successfully'));
        } else {
            return res.status(500).json(createErrorResponse(response.data.description));
        }
        
    } catch (error) {
        console.error('Telegram test error:', error);
        return res.status(500).json(createErrorResponse(
            error.response?.data?.description || error.message
        ));
    }
}
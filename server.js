const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Configure CORS to only allow requests from your website
app.use(cors({
    origin: ['https://prime-tips.xyz', 'http://localhost:5000'] 
}));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 1. Secure Telegram Proxy
app.post('/api/telegram/notify', async (req, res) => {
    const { messageText } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        return res.status(500).json({ error: 'Telegram environment variables missing' });
    }

    try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        res.status(200).json({ success: response.data.ok });
    } catch (error) {
        console.error('Telegram API error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to send Telegram notification' });
    }
});

// 2. Secure PayHero M-Pesa Proxy
app.post('/api/payment/mpesa', async (req, res) => {
    const { amount, phoneNumber, reference } = req.body;
    const channelId = process.env.PAYHERO_CHANNEL_ID;
    const authToken = process.env.PAYHERO_AUTH_TOKEN;
    const callbackUrl = process.env.PAYHERO_CALLBACK_URL;

    if (!channelId || !authToken) {
        return res.status(500).json({ error: 'PayHero config environment variables missing' });
    }

    try {
        const body = {
            amount: parseFloat(amount),
            phone_number: phoneNumber,
            channel_id: isNaN(Number(channelId)) ? channelId : Number(channelId),
            provider: 'm-pesa',
            network_code: '63902',
            external_reference: reference,
            customer_name: 'PRIME-TIPS Customer',
            callback_url: callbackUrl || 'https://prime-tips.xyz/payhero-callback'
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': authToken.startsWith('Basic ') ? authToken : `Basic ${authToken}`
        };

        const response = await axios.post('https://backend.payhero.co.ke/api/v2/payments', body, { headers });
        res.status(200).json(response.data);
    } catch (error) {
        console.error('PayHero API error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.response?.data?.message || 'Payment initiation failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Secure Server running on port ${PORT}`);
});

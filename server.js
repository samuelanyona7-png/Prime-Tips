const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');

const app = express();
const upload = multer(); // For handling screenshot uploads

app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// 1. Secure Telegram Message Proxy
app.post('/api/telegram/notify', async (req, res) => {
    const { messageText } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        return res.status(500).json({ error: 'Server environment missing keys' });
    }

    try {
        const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            chat_id: chatId,
            text: messageText,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        res.status(200).json({ success: response.data.ok });
    } catch (error) {
        console.error('Telegram error:', error.message);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// 2. Secure Telegram Photo Proxy (For Screenshots)
app.post('/api/telegram/photo', upload.single('photo'), async (req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        return res.status(500).json({ error: 'Server environment missing keys' });
    }

    try {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', req.body.caption || '');
        form.append('parse_mode', 'Markdown');
        
        if (req.file) {
            form.append('photo', req.file.buffer, {
                filename: req.file.originalname || 'payment.jpg',
                contentType: req.file.mimetype
            });
        }

        const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, {
            headers: form.getHeaders()
        });

        res.status(200).json({ success: response.data.ok });
    } catch (error) {
        console.error('Telegram photo failed:', error.message);
        res.status(500).json({ error: 'Failed to upload screenshot' });
    }
});

// 3. Secure PayHero M-Pesa STK Proxy
app.post('/api/payment/mpesa', async (req, res) => {
    const { amount, phoneNumber, reference } = req.body;
    const channelId = process.env.PAYHERO_CHANNEL_ID;
    const authToken = process.env.PAYHERO_AUTH_TOKEN;
    const callbackUrl = process.env.PAYHERO_CALLBACK_URL;

    if (!channelId || !authToken) {
        return res.status(500).json({ error: 'Server environment missing keys' });
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
        console.error('PayHero connection error:', error.message);
        res.status(500).json({ error: 'Gateway error' });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server is securely listening on port ${PORT}`);
});

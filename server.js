const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const upload = multer(); // Handle image uploads in memory

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 1. Reroute Telegram Text Notifications
app.post('/api/telegram/notify', async (req, res) => {
  const { messageText } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'Telegram credentials are not configured on the server.' });
  }

  try {
    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: messageText,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Telegram message failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to send Telegram notification', details: error.response?.data });
  }
});

// 2. Reroute Telegram Photo Uploads (Screenshots)
app.post('/api/telegram/photo', upload.single('photo'), async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'Telegram credentials are not configured on the server.' });
  }

  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', req.body.caption || '');
    form.append('parse_mode', 'Markdown');
    
    if (req.file) {
      form.append('photo', req.file.buffer, {
        filename: req.file.originalname || 'screenshot.jpg',
        contentType: req.file.mimetype
      });
    } else {
      return res.status(400).json({ error: 'No photo provided' });
    }

    const response = await axios.post(`https://api.telegram.org/bot${botToken}/sendPhoto`, form, {
      headers: form.getHeaders()
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Telegram photo upload failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to upload photo to Telegram', details: error.response?.data });
  }
});

// 3. Reroute PayHero M-Pesa STK Push Payments
app.post('/api/payment/mpesa', async (req, res) => {
  const { amount, phoneNumber, reference } = req.body;
  const channelId = process.env.PAYHERO_CHANNEL_ID;
  const authToken = process.env.PAYHERO_AUTH_TOKEN;
  const callbackUrl = process.env.PAYHERO_CALLBACK_URL;

  if (!channelId || !authToken) {
    return res.status(500).json({ error: 'PayHero credentials are not configured on the server.' });
  }

  try {
    const response = await axios.post('https://backend.payhero.co.ke/api/v2/payments', {
      amount: parseFloat(amount),
      phone_number: phoneNumber,
      channel_id: isNaN(Number(channelId)) ? channelId : Number(channelId),
      provider: 'm-pesa',
      network_code: '63902',
      external_reference: reference,
      customer_name: 'PRIME-TIPS Customer',
      callback_url: callbackUrl
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken.startsWith('Basic ') ? authToken : `Basic ${authToken}`
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('PayHero request failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'PayHero payment failed', details: error.response?.data });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

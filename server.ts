import express from "express";
import path from "path"; // standard imports first
import multer from "multer";
import FormData from "form-data";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const app = express();
const PORT = 3000;

// Body Parsers
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Set up file uploads
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB limit

const DEFAULT_TELEGRAM_TOKEN = "8239062094:AAHPNJiOD5Zpda-zfQXdaPQDsASNwqXXgok";
const DEFAULT_TELEGRAM_CHAT_ID = "65077119128";

// API 1: Healthcheck
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// API 2: Telegram Text Notifications Proxy
app.post("/api/telegram/notify", async (req, res) => {
  const { messageText } = req.body;
  if (!messageText) {
    return res.status(400).json({ error: "Missing message text." });
  }

  try {
    // Try to fetch custom settings from Firebase first, otherwise fall back to default
    let token = DEFAULT_TELEGRAM_TOKEN;
    let chatId = DEFAULT_TELEGRAM_CHAT_ID;

    try {
      const fbRes = await fetch("https://primetips-23e64-default-rtdb.firebaseio.com/app_data/siteSettings.json");
      const settings = await fbRes.json();
      if (settings && settings.telegram) {
        // Resolve Telegram channel from username if custom (though usually chat id is static)
        // Keep it robust
      }
    } catch (e) {}

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const tgRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown",
        disable_web_page_preview: true
      })
    });

    const data = await tgRes.json();
    if (tgRes.ok && data.ok) {
      res.json({ success: true });
    } else {
      res.status(502).json({ error: "Telegram API reject", details: data });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Server error", message: err.message });
  }
});

// API 3: Telegram Photo Upload Proxy
app.post("/api/telegram/photo", upload.single("photo"), async (req, res) => {
  const caption = req.body.caption || "";
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No photo file provided." });
  }

  try {
    let token = DEFAULT_TELEGRAM_TOKEN;
    let chatId = DEFAULT_TELEGRAM_CHAT_ID;

    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("caption", caption);
    form.append("parse_mode", "Markdown");
    form.append("photo", file.buffer, {
      filename: file.originalname || "receipt.jpg",
      contentType: file.mimetype || "image/jpeg"
    });

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;
    const tgRes = await fetch(url, {
      method: "POST",
      headers: form.getHeaders(),
      body: form as any
    });

    const data = await tgRes.json();
    if (tgRes.ok && data.ok) {
      res.json({ success: true });
    } else {
      res.status(502).json({ error: "Telegram API photo reject", details: data });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Server photo upload failure", message: err.message });
  }
});

// API 4: PayHero Safaricom Express STK Push Proxy
app.post("/api/payment/mpesa", async (req, res) => {
  const { amount, phoneNumber, reference } = req.body;
  if (!amount || !phoneNumber || !reference) {
    return res.status(400).json({ error: "Missing amount, phone, or reference." });
  }

  try {
    // Retrieve configuration from Firebase Realtime Database
    const fbRes = await fetch("https://primetips-23e64-default-rtdb.firebaseio.com/payheroConfig.json");
    const cfg = await fbRes.json();

    if (!cfg || !cfg.channelId || !cfg.authToken) {
      return res.status(502).json({ error: "PayHero billing is not configured in the database yet." });
    }

    const body = {
      amount,
      phone_number: phoneNumber,
      channel_id: isNaN(Number(cfg.channelId)) ? cfg.channelId : Number(cfg.channelId),
      provider: "m-pesa",
      network_code: "63902",
      external_reference: reference,
      customer_name: "PRIME-TIPS Customer",
      callback_url: cfg.callbackUrl || `https://ais-dev-4mna7lceweaoi23gfpsjwz-414111186096.europe-west2.run.app/api/payhero-callback`
    };

    const headers: { [key: string]: string } = { "Content-Type": "application/json" };
    const tok = cfg.authToken.trim();
    headers["Authorization"] = /^basic\s+/i.test(tok) ? tok : `Basic ${tok}`;

    const payRes = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const data = await payRes.json();
    if (payRes.ok && (data.success || data.status === "QUEUED" || data.CheckoutRequestID || data.reference)) {
      res.json({ success: true, data });
    } else {
      res.status(502).json({ error: "PayHero billing reject", details: data });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Payment gateway exception", message: err.message });
  }
});

// Hook HMR / Static asset loaders
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PRIME-TIPS SERVER] running on http://localhost:${PORT}`);
  });
}

startServer();

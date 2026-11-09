const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

/* ========================================================
   AUTH MIDDLEWARE
   Verifies Firebase ID token and loads user role & VIP status
======================================================== */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      ...(userDoc.exists ? userDoc.data() : { role: "member", vipStatus: "free" }),
    };
  } catch (err) {
    req.user = null;
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin only." });
  }
  next();
}

app.use(authenticate);

/* ========================================================
   MATCHES ENDPOINTS
======================================================== */

// GET /api/matches (Public: masks VIP tips if user is not active VIP or admin)
app.get("/matches", async (req, res) => {
  try {
    const snapshot = await db.collection("matches").get();
    const isVipUser =
      req.user &&
      (req.user.role === "admin" ||
        (req.user.vipStatus === "active" && req.user.planExpiry > Date.now()));

    const matches = snapshot.docs.map((doc) => {
      const data = doc.data();
      const id = doc.id;

      // SERVER-SIDE SECURITY MASKING
      if (data.vip && !isVipUser) {
        return {
          id,
          league: data.league,
          home: data.home,
          away: data.away,
          time: data.time,
          color: data.color || "#ff2d95",
          vip: true,
          tip: "🔒 Locked VIP Pick",
          odds: "—",
          conf: data.conf,
          status: data.status || "pending",
          score: data.score || "",
        };
      }

      return { id, ...data };
    });

    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/matches (Admin only: Add or update game)
app.post("/matches", requireAdmin, async (req, res) => {
  try {
    const { id, league, home, away, time, tip, odds, conf, color, vip, status, score } = req.body;

    const matchData = {
      league: String(league),
      home: String(home),
      away: String(away),
      time: String(time || "TBD"),
      tip: String(tip),
      odds: String(odds),
      conf: Number(conf),
      color: String(color || "#ff2d95"),
      vip: Boolean(vip),
      status: String(status || "pending"),
      score: String(score || ""),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (id) {
      await db.collection("matches").doc(id).set(matchData, { merge: true });
      return res.json({ success: true, id, ...matchData });
    } else {
      const docRef = await db.collection("matches").add({
        ...matchData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.json({ success: true, id: docRef.id, ...matchData });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/matches/:id (Admin only)
app.delete("/matches/:id", requireAdmin, async (req, res) => {
  try {
    await db.collection("matches").doc(req.params.id).delete();
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========================================================
   MEMBERS MANAGEMENT (Admin Only)
======================================================== */

// GET /api/members
app.get("/members", requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const members = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/members/create (Creates Firebase Auth user + Firestore profile)
app.post("/members/create", requireAdmin, async (req, res) => {
  try {
    const { name, email, plan, days } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }

    // Generate secure temporary password
    const plainPass = Math.random().toString(36).slice(-8) + "Aa1!";
    const username = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) + Math.floor(100 + Math.random() * 900);
    const durationDays = parseInt(days, 10) || 30;

    // Create directly in Firebase Auth (no client-side logout bug)
    const userRecord = await admin.auth().createUser({
      email: email.toLowerCase(),
      password: plainPass,
      displayName: name,
    });

    const userData = {
      name,
      email: email.toLowerCase(),
      username,
      role: "member",
      plan: plan || "VIP Member",
      planPrice: plan === "VIP Pro" ? "$59.99/mo" : "$29.99/mo",
      planExpiry: Date.now() + durationDays * 24 * 60 * 60 * 1000,
      vipStatus: "active",
      joined: Date.now(),
    };

    await db.collection("users").doc(userRecord.uid).set(userData);

    res.json({
      success: true,
      uid: userRecord.uid,
      plainPass,
      ...userData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/members/:uid/vip-status (Activate or revoke VIP)
app.post("/members/:uid/vip-status", requireAdmin, async (req, res) => {
  try {
    const { action, plan, days } = req.body;
    const userRef = db.collection("users").doc(req.params.uid);

    if (action === "activate") {
      const durationDays = parseInt(days, 10) || 30;
      await userRef.update({
        vipStatus: "active",
        plan: plan || "VIP Member",
        planPrice: plan === "VIP Pro" ? "$59.99/mo" : "$29.99/mo",
        planExpiry: Date.now() + durationDays * 24 * 60 * 60 * 1000,
      });
    } else {
      await userRef.update({
        vipStatus: "free",
        plan: null,
        planPrice: null,
        planExpiry: null,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/members/:uid
app.delete("/members/:uid", requireAdmin, async (req, res) => {
  try {
    await admin.auth().deleteUser(req.params.uid);
    await db.collection("users").doc(req.params.uid).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========================================================
   LEAGUES & FEEDBACK
======================================================== */
app.get("/leagues", async (req, res) => {
  const snap = await db.collection("leagues").get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

app.post("/leagues", requireAdmin, async (req, res) => {
  const { name, color } = req.body;
  const docRef = await db.collection("leagues").add({ name, color });
  res.json({ id: docRef.id, name, color });
});

app.get("/feedback", async (req, res) => {
  const snap = await db.collection("feedback").get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

// Export Cloud Function API
exports.api = functions.https.onRequest(app);

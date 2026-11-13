const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Callable Function: Broadcast Push Notification to All Subscribed Users
 */
exports.sendPushBroadcast = functions.https.onCall(async (data, context) => {
  // 1. Verify Caller is Admin
  const isMasterUid = context.auth && context.auth.uid === 'xYFVBUfUxUPbhReHYPsgXhyxWXH2';
  const hasAdminClaim = context.auth && context.auth.token && context.auth.token.admin === true;

  if (!isMasterUid && !hasAdminClaim) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only the Master Admin can broadcast push notifications.'
    );
  }

  const { title, body, url } = data;
  if (!title || !body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Both title and body are required.'
    );
  }

  // 2. Fetch all registered push tokens from Firestore
  const usersSnap = await admin.firestore()
    .collection('users')
    .where('pushToken', '!=', null)
    .get();

  if (usersSnap.empty) {
    return { ok: true, count: 0, message: 'No registered devices found.' };
  }

  const tokens = [];
  usersSnap.forEach((doc) => {
    const t = doc.data().pushToken;
    if (t && typeof t === 'string') {
      tokens.push(t);
    }
  });

  if (tokens.length === 0) {
    return { ok: true, count: 0, message: 'No valid tokens found.' };
  }

  // 3. Construct FCM Multicast Payload
  const message = {
    notification: {
      title: title,
      body: body,
    },
    data: {
      url: url || 'https://prime1w.firebaseapp.com#banker-hero-box',
    },
    tokens: tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    
    // Clean up stale/invalid tokens
    const staleTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          staleTokens.push(tokens[idx]);
        }
      }
    });

    if (staleTokens.length > 0) {
      const batch = admin.firestore().batch();
      for (const token of staleTokens) {
        const query = await admin.firestore().collection('users').where('pushToken', '==', token).get();
        query.forEach((doc) => {
          batch.update(doc.ref, { pushToken: null });
        });
      }
      await batch.commit();
    }

    return {
      ok: true,
      count: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

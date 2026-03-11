const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ========== FIREBASE SYNC ==========
async function syncFirebase(ref, statut, refs = []) {
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  const FIREBASE_URL = 'https://autoref-express-default-rtdb.asia-southeast1.firebasedatabase.app';
  try {
    const res = await fetch(`${FIREBASE_URL}/demandes.json`);
    const data = await res.json();
    if (!data) { console.log('⚠️ Firebase vide'); return; }

    // Recherche par ref ARX — identifiant unique, pas d'ambiguïté
    const entry = Object.entries(data).find(([k, v]) => v.ref === ref);

    if (!entry) { console.log('⚠️ Demande Firebase non trouvée pour ref:', ref); return; }
    const [key] = entry;
    const patch = { statut };
    if (refs.length > 0) patch.refs = refs;
    await fetch(`${FIREBASE_URL}/demandes/${key}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    console.log('✅ Firebase sync OK | ref:', ref, '| statut:', statut, '| refs:', refs.length);
  } catch(e) {
    console.error('❌ Firebase sync error:', e.message);
  }
}

// ========== EMAIL ==========
async function envoyerEmail(to, ref, montant, vehicule, vin, pieces) {
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  const piecesHTML = pieces && pieces.length
    ? pieces.map(p => {
        const parts = p.split(' — ');
        const oem = parts[0] || p;
        const desc = parts[1] || '';
        return `
          <tr>
            <td style="padding:12px 20px;border-bottom:1px solid #1e1e30;">
              <div style="color:#47c4ff;font-size:13px;font-weight:700;font-family:'Courier New',monospace;">${oem}</div>
              ${desc ? `<div style="color:#55556a;font-size:11px;margin-top:3px;">${desc}</div>` : ''}
            </td>
          </tr>`;
      }).join('')
    : '<tr><td style="padding:12px 20px;color:#55556a;font-size:12px;">Références en cours de préparation</td></tr>';
  const vinHTML = vin ? `
    <tr>
      <td style="padding:16px 20px;border-bottom:1px solid #1e1e30;border-right:1px solid #1e1e30;width:50%;">
        <div style="font-size:10px;color:#55556a;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px;">Véhicule</div>
        <div style="color:#f0f0f5;font-size:13px;font-weight:600;">${vehicule}</div>
      </td>
      <td style="padding:16px 20px;border-bottom:1px solid #1e1e30;width:50%;">
        <div style="font-size:10px;color:#55556a;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px;">VIN</div>
        <div style="color:#47c4ff;font-size:12px;font-weight:700;font-family:'Courier New',monospace;">${vin}</div>
      </td>
    </tr>` : `
    <tr>
      <td colspan="2" style="padding:16px 20px;border-bottom:1px solid #1e1e30;">
        <div style="font-size:10px;color:#55556a;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px;">Véhicule</div>
        <div style="color:#f0f0f5;font-size:13px;font-weight:600;">${vehicule}</div>
      </td>
    </tr>`;
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#07070f;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#07070f;padding:48px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="height:3px;background:linear-gradient(90deg,#47ffb0,#47c4ff);border-radius:3px 3px 0 0;"></td></tr>
  <tr><td style="background:#10101a;border:1px solid #1e1e30;border-top:none;padding:36px 44px 28px;text-align:center;">
    <div style="font-size:22px;font-weight:900;color:#f0f0f5;letter-spacing:2px;">AUTOREF<span style="color:#e8ff47;">EXPRESS</span></div>
    <div style="font-size:10px;color:#55556a;letter-spacing:4px;text-transform:uppercase;margin-top:6px;">Recherche de pièces OEM · Nouvelle-Calédonie</div>
    <div style="width:40px;height:2px;background:#47ffb0;margin:18px auto 0;border-radius:2px;"></div>
  </td></tr>
  <tr><td style="background:#10101a;border-left:1px solid #1e1e30;border-right:1px solid #1e1e30;padding:20px 44px 0;text-align:center;">
    <span style="display:inline-block;background:rgba(71,255,176,0.08);border:1px solid rgba(71,255,176,0.25);color:#47ffb0;padding:8px 24px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">
      ✅ Paiement confirmé
    </span>
  </td></tr>
  <tr><td style="background:#10101a;border-left:1px solid #1e1e30;border-right:1px solid #1e1e30;padding:28px 44px 36px;">
    <p style="color:#f0f0f5;font-size:15px;margin:0 0 6px;font-weight:600;">Bonjour,</p>
    <p style="color:#55556a;font-size:13px;margin:0 0 28px;line-height:1.7;">
      Votre paiement a bien été reçu. Voici vos références OEM exactes pour votre véhicule.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#07070f;border:1px solid #1e1e30;border-radius:12px;margin-bottom:20px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #1e1e30;border-right:1px solid #1e1e30;width:50%;">
          <div style="font-size:10px;color:#55556a;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px;">Référence devis</div>
          <div style="color:#f0f0f5;font-size:15px;font-weight:700;">${ref}</div>
        </td>
        <td style="padding:16px 20px;border-bottom:1px solid #1e1e30;width:50%;">
          <div style="font-size:10px;color:#55556a;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px;">Montant payé</div>
          <div style="color:#e8ff47;font-size:18px;font-weight:900;">${montant}</div>
        </td>
      </tr>
      ${vinHTML}
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#07070f;border:1px solid rgba(71,196,255,0.25);border-radius:12px;margin-bottom:28px;overflow:hidden;">
      <tr><td style="padding:14px 20px;border-bottom:1px solid #1e1e30;background:rgba(71,196,255,0.05);">
        <div style="font-size:10px;color:#47c4ff;text-transform:uppercase;letter-spacing:3px;font-weight:700;">🔓 Vos références OEM</div>
      </td></tr>
      ${piecesHTML}
    </table>
    <p style="color:#55556a;font-size:11px;text-align:center;margin:0;line-height:1.6;">
      Merci de votre confiance — AUTOREF EXPRESS 🇳🇨
    </p>
  </td></tr>
  <tr><td style="background:#0c0c18;border:1px solid #1e1e30;border-top:none;border-radius:0 0 12px 12px;padding:20px 44px;text-align:center;">
    <p style="color:#2e2e45;font-size:10px;margin:0;letter-spacing:3px;text-transform:uppercase;">AUTOREF EXPRESS · 🇳🇨 Nouvelle-Calédonie</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: { name: 'AUTOREF EXPRESS', email: process.env.SENDER_EMAIL },
      to: [{ email: to }],
      subject: `✅ Paiement confirmé — ${ref}`,
      htmlContent: html
    })
  });
  if (!response.ok) throw new Error(await response.text());
}

// ========== CREATE CHECKOUT ==========
app.post('/create-checkout', express.json(), async (req, res) => {
  try {
    const { ref, client, email, vehicule, vin, montant, pieces } = req.body;
    if (!montant || montant <= 0) return res.status(400).json({ error: 'Montant requis' });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email || undefined,
      line_items: [{
        price_data: {
          currency: 'xpf',
          product_data: {
            name: `Recherche OEM — ${vehicule}`,
            description: `Devis ${ref} — ${pieces.length} pièce(s)`
          },
          unit_amount: Math.round(montant)
        },
        quantity: 1
      }],
      metadata: {
        ref,           // ← clé unique pour identifier la demande Firebase
        client,
        email: email || '',
        vehicule,
        vin: vin || '',
        pieces: JSON.stringify(pieces)
      },
      success_url: `https://iridescent-naiad-d503c6.netlify.app?paiement=ok&ref=${ref}`,
      cancel_url: `https://iridescent-naiad-d503c6.netlify.app?paiement=annule`
    });
    console.log(`💳 Checkout créé pour ${ref} — ${client}`);
    res.json({ url: session.url });
  } catch (err) {
    console.log('❌ Checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== WEBHOOK STRIPE ==========
const processedEvents = new Set();
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log('❌ Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (processedEvents.has(event.id)) {
    console.log('⚠️ Événement déjà traité, ignoré:', event.id);
    return res.json({ received: true });
  }
  processedEvents.add(event.id);
  setTimeout(() => processedEvents.delete(event.id), 86400000);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email;
    const ref = session.metadata?.ref || '';          // ← ref ARX depuis metadata Stripe
    const vehicule = session.metadata?.vehicule || '';
    const vin = session.metadata?.vin || '';
    const pieces = session.metadata?.pieces ? JSON.parse(session.metadata.pieces) : [];
    const montant = session.amount_total ? Math.round(session.amount_total).toLocaleString('fr-FR') + ' XPF' : '';

    console.log(`✅ Paiement reçu — Ref: ${ref} — Email: ${email} — ${pieces.length} pièce(s)`);

    // Email avec refs OEM
    if (email) {
      try {
        await envoyerEmail(email, ref, montant, vehicule, vin, pieces);
        console.log('📧 Email avec références envoyé à', email);
      } catch(e) {
        console.log('❌ Email error:', e.message);
      }
    }

    // Sync Firebase par ref ARX — identifiant unique, zéro ambiguïté
    if (ref) {
      try {
        const refs = pieces.map(p => {
          const parts = p.split(' — ');
          return { ref: parts[0] || p, desc: parts[1] || '' };
        });
        await syncFirebase(ref, 'livre', refs);
      } catch(e) {
        console.log('❌ Firebase sync error:', e.message);
      }
    }
  }
  res.json({ received: true });
});

// ========== DEMANDE APP MOBILE ==========
app.post('/demande', express.json(), async (req, res) => {
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  const { vehicule, vin, pieces, email } = req.body;
  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'AUTOREF EXPRESS APP', email: process.env.SENDER_EMAIL },
        to: [{ email: process.env.SENDER_EMAIL }],
        subject: `📱 Nouvelle demande APP — ${vehicule}`,
        htmlContent: `<h2>Nouvelle demande via l'app</h2><p><b>Véhicule :</b> ${vehicule}</p><p><b>VIN :</b> ${vin || 'Non renseigné'}</p><p><b>Pièces :</b> ${pieces}</p><p><b>Email client :</b> ${email}</p>`
      })
    });
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'AUTOREF EXPRESS', email: process.env.SENDER_EMAIL },
        to: [{ email: email }],
        subject: '✅ Votre demande AUTOREF EXPRESS a bien été reçue',
        htmlContent: `<h2>Bonjour !</h2><p>Votre demande a bien été reçue.</p><p><b>Véhicule :</b> ${vehicule}</p><p><b>Pièces :</b> ${pieces}</p><p>Notre expert va rechercher vos références OEM et vous enverra un devis par email.</p><br><p>L'équipe AUTOREF EXPRESS 🔧</p>`
      })
    });
    console.log(`📱 Demande app reçue — ${vehicule} — ${email}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur demande app:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.use(express.json());
app.get('/', (req, res) => res.json({ status: '✅ AUTOREF EXPRESS serveur actif' }));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));

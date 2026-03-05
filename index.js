const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// CORS pour autoriser Netlify
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

async function envoyerEmail(to, ref, montant, pieces) {
  const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
  const piecesHTML = pieces && pieces.length
    ? pieces.map(p => `<tr><td style="padding:10px 20px;border-bottom:1px solid #1e1e2e;color:#47c4ff;font-size:14px;font-weight:600;">🔩 ${p}</td></tr>`).join('')
    : '<tr><td style="padding:10px 20px;color:#6b6b80;">Références en cours de préparation</td></tr>';

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender: { name: 'AUTOREF EXPRESS', email: process.env.SENDER_EMAIL },
      to: [{ email: to }],
      subject: `✅ Paiement confirmé - ${ref}`,
      htmlContent: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0">
        <tr><td style="background:#13131a;border:1px solid #1e1e2e;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
          <div style="font-size:24px;font-weight:900;color:#f0f0f5;">AUTOREF<span style="color:#e8ff47;">EXPRESS</span></div>
          <div style="font-size:11px;color:#6b6b80;letter-spacing:2px;margin-top:6px;">RECHERCHE DE PIÈCES OEM</div>
        </td></tr>
        <tr><td style="background:#13131a;border-left:1px solid #1e1e2e;border-right:1px solid #1e1e2e;padding:20px 40px 0;text-align:center;">
          <span style="background:rgba(71,255,176,0.1);border:1px solid rgba(71,255,176,0.3);color:#47ffb0;padding:6px 20px;border-radius:100px;font-size:12px;font-weight:600;">✅ PAIEMENT CONFIRMÉ</span>
        </td></tr>
        <tr><td style="background:#13131a;border-left:1px solid #1e1e2e;border-right:1px solid #1e1e2e;padding:24px 40px 32px;">
          <p style="color:#f0f0f5;font-size:16px;margin:0 0 12px;">Bonjour,</p>
          <p style="color:#6b6b80;font-size:14px;margin:0 0 24px;line-height:1.6;">Votre paiement a bien été reçu. Voici vos références OEM exactes :</p>

          <table width="100%" style="background:#0a0a0f;border:1px solid #1e1e2e;border-radius:10px;margin-bottom:24px;">
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #1e1e2e;">
                <div style="color:#6b6b80;font-size:11px;text-transform:uppercase;">Référence devis</div>
                <div style="color:#f0f0f5;font-size:15px;font-weight:600;margin-top:4px;">${ref}</div>
              </td>
              <td style="padding:14px 20px;border-bottom:1px solid #1e1e2e;">
                <div style="color:#6b6b80;font-size:11px;text-transform:uppercase;">Montant payé</div>
                <div style="color:#e8ff47;font-size:15px;font-weight:700;margin-top:4px;">${montant}</div>
              </td>
            </tr>
          </table>

          <div style="background:#0a0a0f;border:1px solid rgba(71,255,176,0.3);border-radius:10px;margin-bottom:24px;">
            <div style="padding:14px 20px;border-bottom:1px solid #1e1e2e;">
              <div style="color:#47ffb0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">🔓 Vos références OEM</div>
            </div>
            <table width="100%">${piecesHTML}</table>
          </div>

          <p style="color:#6b6b80;font-size:12px;text-align:center;margin:0;">Merci de votre confiance — AUTOREF EXPRESS 🇳🇨</p>
        </td></tr>
        <tr><td style="background:#0d0d14;border:1px solid #1e1e2e;border-top:none;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
          <p style="color:#6b6b80;font-size:11px;margin:0;text-transform:uppercase;letter-spacing:1px;">AUTOREF EXPRESS — Nouvelle-Calédonie</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    })
  });

  if (!response.ok) throw new Error(await response.text());
}

// ======= CRÉER CHECKOUT SESSION =======
app.post('/create-checkout', express.json(), async (req, res) => {
  try {
    const { ref, client, email, vehicule, montant, pieces } = req.body;
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
        ref,
        client,
        email: email || '',
        vehicule,
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

// ======= WEBHOOK STRIPE =======
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log('❌ Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email;
    const ref = session.metadata?.ref || 'Votre devis';
    const pieces = session.metadata?.pieces ? JSON.parse(session.metadata.pieces) : [];
    const montant = session.amount_total ? Math.round(session.amount_total).toLocaleString('fr-FR') + ' FCFP' : '';

    console.log(`✅ Paiement reçu — Email: ${email} — Ref: ${ref} — ${pieces.length} pièce(s)`);

    if (email) {
      try {
        await envoyerEmail(email, ref, montant, pieces);
        console.log('📧 Email avec références envoyé à', email);
      } catch(e) {
        console.log('❌ Email error:', e.message);
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());

app.get('/', (req, res) => res.json({ status: '✅ AUTOREF EXPRESS serveur actif' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));

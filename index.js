const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

const app = express();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log('❌ Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const obj = event.data.object;
    const email = obj.customer_email || obj.receipt_email || (obj.customer_details && obj.customer_details.email);
    const ref = obj.metadata && obj.metadata.ref ? obj.metadata.ref : 'Votre devis';
    const montant = obj.amount_total ? Math.round(obj.amount_total).toLocaleString('fr-FR') + ' FCFP' : '';

    console.log(`✅ Paiement reçu — Email: ${email} — Ref: ${ref}`);

    if (email) {
      try {
        await transporter.sendMail({
          from: `"AUTOREF EXPRESS" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: `✅ Paiement confirmé - ${ref}`,
          html: `
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
          <p style="color:#6b6b80;font-size:14px;margin:0 0 24px;line-height:1.6;">Votre paiement a bien été reçu. Nous allons vous transmettre les références exactes de vos pièces OEM très prochainement.</p>
          <table width="100%" style="background:#0a0a0f;border:1px solid #1e1e2e;border-radius:10px;margin-bottom:24px;">
            <tr>
              <td style="padding:14px 20px;border-bottom:1px solid #1e1e2e;">
                <div style="color:#6b6b80;font-size:11px;text-transform:uppercase;">Référence</div>
                <div style="color:#f0f0f5;font-size:15px;font-weight:600;margin-top:4px;">${ref}</div>
              </td>
              <td style="padding:14px 20px;border-bottom:1px solid #1e1e2e;">
                <div style="color:#6b6b80;font-size:11px;text-transform:uppercase;">Montant payé</div>
                <div style="color:#e8ff47;font-size:15px;font-weight:700;margin-top:4px;">${montant}</div>
              </td>
            </tr>
          </table>
          <div style="background:#0a0a0f;border:1px solid rgba(71,255,176,0.2);border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
            <div style="font-size:32px;margin-bottom:8px;">🔓</div>
            <div style="color:#47ffb0;font-size:15px;font-weight:700;margin-bottom:6px;">Références OEM en préparation</div>
            <div style="color:#6b6b80;font-size:13px;line-height:1.6;">Nous vous contacterons très prochainement.</div>
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
        });
        console.log('📧 Email envoyé à', email);
      } catch(e) {
        console.log('❌ Email error:', e.message);
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: '✅ AUTOREF EXPRESS serveur actif' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));

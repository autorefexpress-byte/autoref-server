const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');

const app = express();

// Pour recevoir les webhooks Stripe (raw body obligatoire)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log('❌ Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Paiement confirmé
  if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
    const obj = event.data.object;
    const email = obj.customer_email || obj.receipt_email || (obj.customer_details && obj.customer_details.email);
    const ref = obj.metadata && obj.metadata.ref ? obj.metadata.ref : null;

    console.log(`✅ Paiement reçu — Email: ${email} — Ref: ${ref}`);

    // Notifier le site Netlify via EmailJS (on envoie un email de confirmation au client)
    if (email) {
      try {
        const fetch = (await import('node-fetch')).default;
        await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: process.env.EMAILJS_SERVICE_ID,
            template_id: process.env.EMAILJS_TEMPLATE_PAID_ID,
            user_id: process.env.EMAILJS_PUBLIC_KEY,
            template_params: {
              email: email,
              ref: ref || 'Votre devis',
              montant: obj.amount_total ? (obj.amount_total / 100).toLocaleString('fr-FR') + ' FCFP' : '',
            }
          })
        });
        console.log('📧 Email de confirmation envoyé à', email);
      } catch(e) {
        console.log('Email error:', e.message);
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: '✅ AUTOREF EXPRESS serveur actif' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Serveur démarré sur le port ${PORT}`));

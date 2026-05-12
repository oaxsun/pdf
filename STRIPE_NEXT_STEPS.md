# Stripe next steps - Compresso

Estructura correcta del repo:

- index.html
- app.js
- styles.css
- config.js
- supabase/functions/create-checkout-session/index.ts
- supabase/functions/stripe-webhook/index.ts

## 1. Deploy checkout function

supabase functions deploy create-checkout-session

## 2. Deploy webhook function

supabase functions deploy stripe-webhook

## 3. Crear webhook en Stripe

Stripe Dashboard > Developers > Webhooks > Add endpoint

Endpoint:
https://hgteuswezxhxtjhwwnkg.supabase.co/functions/v1/stripe-webhook

Eventos iniciales:
- checkout.session.completed
- customer.subscription.deleted
- invoice.paid
- customer.subscription.updated

## 4. Guardar webhook secret

Después de crear el webhook, Stripe te dará un signing secret:

whsec_xxx

Guárdalo con:

supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

## 5. Importante

La Stripe secret key NO va en GitHub.
Debe estar guardada con:

supabase secrets set STRIPE_SECRET_KEY=rk_test_xxx

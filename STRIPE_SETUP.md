# Stripe Setup - Compresso

## Precios configurados

- Pro mensual: $29 MXN
  - Price ID: `price_1TUwUZK5nFoesXlkApbFtwEF`
- Pro anual: $199 MXN
  - Price ID: `price_1TUwVYK5nFoesXlkLOslgwDx`

## Dónde están integrados

- `config.js`
  - `STRIPE_MONTHLY_PRICE_ID`
  - `STRIPE_YEARLY_PRICE_ID`
- `pricing.js`
  - envía `billing_period` y `price_id` a la Edge Function.
- `supabase/functions/create-checkout-session/index.ts`
  - valida los Price IDs y crea Stripe Checkout en modo suscripción.

## Secrets necesarios en Supabase

No subas estas claves a GitHub.

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxx
```

## Pendiente

1. Pegar en `config.js` la URL real de la Edge Function:

```js
CREATE_CHECKOUT_FUNCTION_URL: "https://TU-PROYECTO.supabase.co/functions/v1/create-checkout-session"
```

2. Desplegar Edge Functions:

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

3. Crear webhook en Stripe apuntando a:

```txt
https://TU-PROYECTO.supabase.co/functions/v1/stripe-webhook
```

Eventos recomendados:

- `checkout.session.completed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

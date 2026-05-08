# Compresso

Proyecto listo para Git con:

- Frontend con el look de `compresso.oaxsun.tech`
- Login y registro en popup dentro de la app
- Compresor PDF separado en `app.js`
- Auth con Supabase
- Upgrade a Pro con Stripe + Supabase Edge Functions

## Archivos principales

- `index.html` -> interfaz principal
- `styles.css` -> estilos
- `app.js` -> lógica de compresión
- `auth.js` -> login / registro / plan
- `pricing.js` -> checkout premium
- `supabaseClient.js` -> cliente Supabase
- `config.example.js` -> copia a `config.js`

## Configuración rápida

1. Copia `config.example.js` a `config.js`
2. Pon tu `SUPABASE_URL` y `SUPABASE_ANON_KEY`
3. Ejecuta `supabase/schema.sql` en tu proyecto Supabase
4. Sube las Edge Functions
5. Configura Stripe

## Planes

- guest: 200 MB
- free: 400 MB
- pro: ilimitado

## Nota

No expongas nunca la `SUPABASE_SERVICE_ROLE_KEY` en el frontend.


## Stripe - Compresso Pro

Price IDs configurados en este proyecto:

- Mensual ($29 MXN): `price_1TUwUZK5nFoesXlkApbFtwEF`
- Anual ($199 MXN): `price_1TUwVYK5nFoesXlkLOslgwDx`

La `STRIPE_SECRET_KEY` nunca debe ir en frontend ni en GitHub. Debe configurarse como secret en Supabase Edge Functions.

Secrets necesarios en Supabase:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_xxx
```

La Edge Function `create-checkout-session` ya valida y usa los Price IDs mensual/anual.

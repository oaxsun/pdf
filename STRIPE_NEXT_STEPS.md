# Stripe PRO inmediato - pasos obligatorios

Esta versión NO depende únicamente del webhook.
Al regresar de Stripe, la app recibe `session_id`, llama a `sync-checkout-session`, verifica el pago en Stripe y actualiza Supabase a PRO inmediatamente.

## 1. Ejecuta SQL en Supabase

Supabase > SQL Editor > New query.

Copia y ejecuta:

`supabase/sql/stripe_profile_columns.sql`

## 2. Guarda secrets necesarias

Ya tienes STRIPE_SECRET_KEY. Asegúrate de tener también service role:

```powershell
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
```

La encuentras en:
Supabase > Project Settings > API > Secret / service_role key.

NO la subas a GitHub.

## 3. Deploy functions

```powershell
supabase functions deploy create-checkout-session
supabase functions deploy sync-checkout-session
supabase functions deploy stripe-webhook
```

## 4. Webhook Stripe recomendado

Aunque la activación inmediata ya funciona, deja webhook para renovaciones/cancelaciones.

Endpoint:

```text
https://hgteuswezxhxtjhwwnkg.supabase.co/functions/v1/stripe-webhook
```

Eventos:
- checkout.session.completed
- customer.subscription.updated
- customer.subscription.deleted
- invoice.paid

Guarda signing secret:

```powershell
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

## 5. Prueba

1. Login en Compresso.
2. Hazte PRO.
3. Paga en Stripe test.
4. Al volver, debe aparecer popup de éxito.
5. La página recarga y debe mostrar PRO.


## Deploy cancel subscription function

```powershell
supabase functions deploy cancel-subscription
```

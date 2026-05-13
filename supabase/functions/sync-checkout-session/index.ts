import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function toIsoFromUnix(value?: number | null) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("No hay sesión activa.");
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUserClient.auth.getUser();

    if (userError || !user) {
      throw new Error("No se pudo validar la sesión del usuario.");
    }

    const body = await req.json();
    const sessionId = body.session_id || body.sessionId;

    if (!sessionId) {
      throw new Error("Falta session_id.");
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const metadataUserId = checkoutSession.metadata?.user_id;
    const clientReferenceId = checkoutSession.client_reference_id;
    const checkoutUserId = metadataUserId || clientReferenceId;

    if (checkoutUserId !== user.id) {
      throw new Error("Esta sesión de pago no pertenece al usuario actual.");
    }

    if (checkoutSession.payment_status !== "paid") {
      throw new Error("El pago todavía no aparece como completado.");
    }

    const subscription =
      typeof checkoutSession.subscription === "string"
        ? await stripe.subscriptions.retrieve(checkoutSession.subscription)
        : checkoutSession.subscription as Stripe.Subscription;

    if (!subscription) {
      throw new Error("No se encontró la suscripción de Stripe.");
    }

    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    const priceId = subscription.items.data[0]?.price?.id || null;
    const productId =
      typeof subscription.items.data[0]?.price?.product === "string"
        ? subscription.items.data[0]?.price?.product
        : subscription.items.data[0]?.price?.product?.id || null;

    const isPro =
      subscription.status === "active" ||
      subscription.status === "trialing";

    const profilePayload = {
      id: user.id,
      email: user.email,
      plan: isPro ? "pro" : "free",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      stripe_product_id: productId,
      subscription_status: subscription.status,
      subscription_current_period_start: toIsoFromUnix(subscription.current_period_start),
      subscription_current_period_end: toIsoFromUnix(subscription.current_period_end),
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile, error: upsertError } = await supabaseAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select()
      .single();

    if (upsertError) {
      throw upsertError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        plan: updatedProfile?.plan || profilePayload.plan,
        profile: updatedProfile,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || "No se pudo sincronizar el pago.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

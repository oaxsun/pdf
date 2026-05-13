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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("No hay sesión activa.");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("No se pudo validar la sesión.");
    }

    const body = await req.json();

    const priceId = body.price_id || body.priceId;
    const billingPeriod = body.billing_period || body.billingPeriod || "monthly";

    if (!priceId) {
      throw new Error("Missing Stripe Price ID.");
    }

    const origin = req.headers.get("origin") || "https://compresso.oaxsun.tech";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      customer_email: user.email || undefined,
      client_reference_id: user.id,

      success_url: body.success_url || `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancel_url || `${origin}/?checkout=cancel`,

      metadata: {
        app: "compresso",
        user_id: user.id,
        user_email: user.email || "",
        billing_period: billingPeriod,
      },

      subscription_data: {
        metadata: {
          app: "compresso",
          user_id: user.id,
          user_email: user.email || "",
          billing_period: billingPeriod,
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || "No se pudo crear la sesión de Stripe.",
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

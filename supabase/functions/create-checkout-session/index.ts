import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.25.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10"
});

const STRIPE_PRICES = {
  monthly: "price_1TUwUZK5nFoesXlkApbFtwEF",
  yearly: "price_1TUwVYK5nFoesXlkLOslgwDx"
};

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Falta Authorization header" }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuario no autenticado" }), { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,stripe_customer_id,plan")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil no encontrado" }), { status: 404 });
    }

    const body = await req.json();
    const success_url = body.success_url;
    const cancel_url = body.cancel_url;
    const billingPeriod = body.billing_period === "yearly" ? "yearly" : "monthly";
    const requestedPriceId = body.price_id;
    const priceId = STRIPE_PRICES[billingPeriod as keyof typeof STRIPE_PRICES];

    if (requestedPriceId && requestedPriceId !== priceId) {
      return new Response(JSON.stringify({ error: "Price ID inválido" }), { status: 400 });
    }

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: {
          supabase_user_id: profile.id
        }
      });

      customerId = customer.id;

      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", profile.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url,
      cancel_url,
      metadata: {
        supabase_user_id: profile.id,
        app: "compresso",
        billing_period: billingPeriod
      },
      subscription_data: {
        metadata: {
          supabase_user_id: profile.id,
          app: "compresso",
          billing_period: billingPeriod
        }
      }
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});

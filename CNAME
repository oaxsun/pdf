import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function toIsoFromUnix(value?: number | null) {
  if (!value) return null;
  return new Date(value * 1000).toISOString();
}

async function activateSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.user_id;

  if (!userId) {
    console.warn("Subscription without user_id metadata:", subscriptionId);
    return;
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

  const payload = {
    id: userId,
    email: subscription.metadata?.user_email || null,
    plan: subscription.status === "active" || subscription.status === "trialing" ? "pro" : "free",
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

  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) {
    console.error("Supabase profile update error:", error);
    throw error;
  }
}

async function updateSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;

  if (!userId) {
    console.warn("Subscription update without user_id metadata:", subscription.id);
    return;
  }

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  const isActive = subscription.status === "active" || subscription.status === "trialing";

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plan: isActive ? "pro" : "free",
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_current_period_start: toIsoFromUnix(subscription.current_period_start),
      subscription_current_period_end: toIsoFromUnix(subscription.current_period_end),
      subscription_cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("Supabase subscription update error:", error);
    throw error;
  }
}

async function cancelSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;

  if (!userId) {
    console.warn("Subscription delete without user_id metadata:", subscription.id);
    return;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plan: "free",
      subscription_status: subscription.status || "canceled",
      subscription_cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    console.error("Supabase subscription cancel error:", error);
    throw error;
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;

          await activateSubscription(subscriptionId);
        }

        break;
      }

      case "customer.subscription.updated": {
        await updateSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        await cancelSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          await activateSubscription(subscriptionId);
        }

        break;
      }

      default:
        console.log("Unhandled Stripe event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook handler error:", error);

    return new Response(
      JSON.stringify({
        error: error.message || "Webhook handler failed",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

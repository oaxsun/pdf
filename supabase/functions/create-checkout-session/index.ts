import Stripe from "https://esm.sh/stripe@14.25.0?target=denonext";

const stripe = new Stripe(
  Deno.env.get("STRIPE_SECRET_KEY")!,
  {
    apiVersion: "2024-06-20"
  }
);

Deno.serve(async (req) => {
  try {
    const body = await req.json();

    const priceId =
      body.price_id ||
      body.priceId;

    const customerEmail =
      body.customer_email ||
      body.customerEmail ||
      null;

    const successUrl =
      body.success_url ||
      `${req.headers.get("origin") || "https://compresso.oaxsun.tech"}?checkout=success`;

    const cancelUrl =
      body.cancel_url ||
      `${req.headers.get("origin") || "https://compresso.oaxsun.tech"}?checkout=cancel`;

    if (!priceId) {
      throw new Error("Missing Stripe Price ID");
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      mode: "subscription",

      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],

      customer_email: customerEmail,

      success_url: successUrl,
      cancel_url: cancelUrl,

      metadata: {
        app: "compresso"
      }
    });

    return new Response(
      JSON.stringify({
        url: session.url
      }),
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
});

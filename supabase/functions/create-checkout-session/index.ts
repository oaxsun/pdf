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

    const { priceId, customerEmail } = body;

    const origin =
      req.headers.get("origin") ||
      "https://compresso.oaxsun.tech";

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

      success_url: `${origin}?checkout=success`,
      cancel_url: `${origin}?checkout=cancelled`,

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
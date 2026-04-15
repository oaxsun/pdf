import { supabase } from "./supabaseClient.js";
import { APP_CONFIG } from "./config.js";

export async function startCheckout() {
  const plan = window.currentUserPlan || "guest";

  if (plan === "guest") {
    document.dispatchEvent(new CustomEvent("open-auth-modal", {
      detail: { mode: "register" }
    }));
    return;
  }

  const triggerButtons = [
    document.getElementById("buyProBtn"),
    document.getElementById("buyProBtnPage")
  ];

  triggerButtons.forEach((btn) => {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Redirigiendo...";
    }
  });

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("No hay sesión activa.");
    }

    const res = await fetch(APP_CONFIG.CREATE_CHECKOUT_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        success_url: `${window.location.origin}/?checkout=success`,
        cancel_url: `${window.location.origin}/?checkout=cancel`
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "No se pudo crear la sesión de Stripe.");
    }

    window.location.href = data.url;
  } catch (error) {
    alert(error.message);
  } finally {
    triggerButtons.forEach((btn) => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.id === "buyProBtn" ? "Hazte PRO" : "Hazte Pro";
      }
    });
  }
}

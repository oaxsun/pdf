import { supabase } from "./supabaseClient.js";
import { APP_CONFIG } from "./config.js";

const plansModal = document.getElementById("plansModal");
const closePlansModal = document.getElementById("closePlansModal");
const plansGuestLoginBtn = document.getElementById("plansGuestLoginBtn");
const plansProBtn = document.getElementById("plansProBtn");

export function openPlansModal() {
  plansModal.classList.remove("hidden");
}

export function closePlansModalFn() {
  plansModal.classList.add("hidden");
}

async function goToCheckout() {
  const plan = window.currentUserPlan || "guest";

  if (plan === "guest") {
    document.dispatchEvent(new CustomEvent("open-auth-modal", {
      detail: { mode: "register" }
    }));
    return;
  }

  const triggerButtons = [
    document.getElementById("buyProBtn"),
    document.getElementById("buyProBtnPage"),
    plansProBtn
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
        btn.textContent = "Hazte PRO";
      }
    });
  }
}

export async function startCheckout() {
  openPlansModal();
}

document.getElementById("buyProBtn")?.addEventListener("click", startCheckout);
document.getElementById("buyProBtnPage")?.addEventListener("click", startCheckout);

closePlansModal?.addEventListener("click", closePlansModalFn);

plansModal?.addEventListener("click", (e) => {
  if (e.target === plansModal) {
    closePlansModalFn();
  }
});

plansGuestLoginBtn?.addEventListener("click", () => {
  closePlansModalFn();
  document.dispatchEvent(new CustomEvent("open-auth-modal", {
    detail: { mode: "login" }
  }));
});

plansProBtn?.addEventListener("click", async () => {
  closePlansModalFn();
  await goToCheckout();
});

import { supabase } from "./supabaseClient.js";
import { APP_CONFIG } from "./config.js";

const plansModal = document.getElementById("plansModal");
const closePlansModal = document.getElementById("closePlansModal");
const closePlansModalTop = document.getElementById("closePlansModalTop");
const plansGuestLoginBtn = document.getElementById("plansGuestLoginBtn");
const plansFreeRegisterBtn = document.getElementById("plansFreeRegisterBtn");
const plansProMonthlyBtn = document.getElementById("plansProMonthlyBtn");
const plansProYearlyBtn = document.getElementById("plansProYearlyBtn");
const legacyPlansProBtn = document.getElementById("plansProBtn");

const STRIPE_PRICE_IDS = {
  monthly: APP_CONFIG.STRIPE_MONTHLY_PRICE_ID,
  yearly: APP_CONFIG.STRIPE_YEARLY_PRICE_ID
};

export function openPlansModal() {
  if (!plansModal) {
    console.warn("No existe #plansModal en el HTML.");
    return;
  }
  plansModal.classList.remove("hidden");
}

export function closePlansModalFn() {
  plansModal?.classList.add("hidden");
}

function getPriceId(billingPeriod = "monthly") {
  return billingPeriod === "yearly" ? STRIPE_PRICE_IDS.yearly : STRIPE_PRICE_IDS.monthly;
}

async function goToCheckout(billingPeriod = "monthly") {
  const plan = window.currentUserPlan || "guest";

  if (plan === "guest") {
    closePlansModalFn();
    document.dispatchEvent(new CustomEvent("open-auth-modal", {
      detail: { mode: "register" }
    }));
    return;
  }

  if (!APP_CONFIG.CREATE_CHECKOUT_FUNCTION_URL) {
    alert("Falta configurar CREATE_CHECKOUT_FUNCTION_URL en config.js para activar pagos.");
    return;
  }

  const priceId = getPriceId(billingPeriod);

  if (!priceId) {
    alert("Falta configurar el Price ID de Stripe para este plan.");
    return;
  }

  const triggerButtons = [
    document.getElementById("buyProBtn"),
    document.getElementById("buyProBtnPage"),
    document.getElementById("accountUpgradeBtn"),
    plansProMonthlyBtn,
    plansProYearlyBtn,
    legacyPlansProBtn
  ];

  triggerButtons.forEach((btn) => {
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
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
        billing_period: billingPeriod,
        price_id: priceId,
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
        btn.textContent = btn.dataset.originalText || "Hazte PRO";
        delete btn.dataset.originalText;
      }
    });
  }
}

export async function startCheckout() {
  openPlansModal();
}

document.getElementById("buyProBtn")?.addEventListener("click", startCheckout);
document.getElementById("buyProBtnPage")?.addEventListener("click", startCheckout);
document.getElementById("accountUpgradeBtn")?.addEventListener("click", startCheckout);

document.addEventListener("open-plans-modal", startCheckout);

closePlansModal?.addEventListener("click", closePlansModalFn);
closePlansModalTop?.addEventListener("click", closePlansModalFn);

plansModal?.addEventListener("click", (e) => {
  if (e.target === plansModal) {
    closePlansModalFn();
  }
});

plansGuestLoginBtn?.addEventListener("click", () => {
  closePlansModalFn();
});

plansFreeRegisterBtn?.addEventListener("click", () => {
  closePlansModalFn();
  document.dispatchEvent(new CustomEvent("open-auth-modal", {
    detail: { mode: "register" }
  }));
});

legacyPlansProBtn?.addEventListener("click", async () => {
  await goToCheckout("monthly");
});

plansProMonthlyBtn?.addEventListener("click", async () => {
  await goToCheckout("monthly");
});

plansProYearlyBtn?.addEventListener("click", async () => {
  await goToCheckout("yearly");
});

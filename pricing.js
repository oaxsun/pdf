import { supabase } from "./supabaseClient.js";
import { APP_CONFIG } from "./config.js";

const plansModal = document.getElementById("plansModal");
const closePlansModal = document.getElementById("closePlansModal");
const closePlansModalTop = document.getElementById("closePlansModalTop");
const plansGuestLoginBtn = document.getElementById("plansGuestLoginBtn");
const plansFreeRegisterBtn = document.getElementById("plansFreeRegisterBtn");
const plansMonthlyBtn = document.getElementById("plansMonthlyBtn");
const plansYearlyBtn = document.getElementById("plansYearlyBtn");

function updatePlansModalByCurrentPlan() {
  const plan = window.currentUserPlan || "guest";

  if (plansGuestLoginBtn) {
    plansGuestLoginBtn.disabled = plan !== "guest";
    plansGuestLoginBtn.textContent = plan === "guest" ? "Continuar" : "Nivel superado";
    plansGuestLoginBtn.classList.toggle("btn-disabled-soft", plan !== "guest");
  }

  if (plansFreeRegisterBtn) {
    if (plan === "guest") {
      plansFreeRegisterBtn.disabled = false;
      plansFreeRegisterBtn.textContent = "Regístrate gratis";
      plansFreeRegisterBtn.classList.remove("btn-disabled-soft");
    } else if (plan === "free") {
      plansFreeRegisterBtn.disabled = true;
      plansFreeRegisterBtn.textContent = "Plan actual";
      plansFreeRegisterBtn.classList.add("btn-disabled-soft");
    } else {
      plansFreeRegisterBtn.disabled = true;
      plansFreeRegisterBtn.textContent = "Incluido en PRO";
      plansFreeRegisterBtn.classList.add("btn-disabled-soft");
    }
  }
}

export function openPlansModal() {
  if (!plansModal) {
    console.warn("No existe #plansModal en el HTML.");
    return;
  }

  updatePlansModalByCurrentPlan();
  plansModal.classList.remove("hidden");
}

export function closePlansModalFn() {
  plansModal?.classList.add("hidden");
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

  if (plan === "pro") {
    alert("Tu cuenta ya tiene Compresso PRO activo.");
    return;
  }

  if (!APP_CONFIG.CREATE_CHECKOUT_FUNCTION_URL) {
    alert("Falta configurar CREATE_CHECKOUT_FUNCTION_URL en config.js para activar pagos.");
    return;
  }

  const priceId =
    billingPeriod === "yearly"
      ? APP_CONFIG.STRIPE_YEARLY_PRICE_ID
      : APP_CONFIG.STRIPE_MONTHLY_PRICE_ID;

  if (!priceId) {
    alert("Falta configurar el Price ID de Stripe.");
    return;
  }

  const triggerButtons = [
    document.getElementById("buyProBtn"),
    document.getElementById("buyProBtnPage"),
    document.getElementById("accountUpgradeBtn"),
    plansMonthlyBtn,
    plansYearlyBtn
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
      throw new Error("Inicia sesión para activar Compresso PRO.");
    }

    const res = await fetch(APP_CONFIG.CREATE_CHECKOUT_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        price_id: priceId,
        billing_period: billingPeriod,
        success_url: `${window.location.origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/?checkout=cancel`
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "No se pudo crear la sesión de Stripe.");
    }

    if (!data.url) {
      throw new Error("Stripe no devolvió una URL de Checkout.");
    }

    window.location.href = data.url;
  } catch (error) {
    alert(error.message);
  } finally {
    triggerButtons.forEach((btn) => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || "Hazte PRO";
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
document.addEventListener("plan-updated", updatePlansModalByCurrentPlan);

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

plansMonthlyBtn?.addEventListener("click", async () => {
  await goToCheckout("monthly");
});

plansYearlyBtn?.addEventListener("click", async () => {
  await goToCheckout("yearly");
});

import { supabase } from "./supabaseClient.js";

const accountNavBtn = document.getElementById("accountNavBtn");

const authMessage = document.getElementById("authMessage");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");

const planBadge = document.getElementById("planBadge");
const heroText = document.getElementById("heroText");
const dropzoneText = document.getElementById("dropzoneText");
const accountHelp = document.getElementById("accountHelp");

const accountGuestView = document.getElementById("accountGuestView");
const accountUserView = document.getElementById("accountUserView");
const accountEmail = document.getElementById("accountEmail");
const accountPlan = document.getElementById("accountPlan");
const accountPlanDescription = document.getElementById("accountPlanDescription");
const accountUpgradeBtn = document.getElementById("accountUpgradeBtn");
const accountLogoutBtn = document.getElementById("accountLogoutBtn");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");
const accountPageLead = document.getElementById("accountPageLead");

window.currentUserPlan = "guest";
window.currentUser = null;

function setAuthMessage(text, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = text;
  authMessage.style.color = isError ? "#fca5a5" : "#94a3b8";
}

function goToAccountTab() {
  accountNavBtn?.click();
}

function renderPlanUi(plan, profile = null) {
  window.currentUserPlan = plan;
  window.currentUser = profile;

  if (plan === "pro") {
    planBadge.textContent = "Pro";
    heroText.textContent = "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Tu cuenta Pro te permite comprimir archivos sin límite de tamaño.";
    dropzoneText.textContent = "Haz clic aquí o arrastra un archivo PDF. Límite actual: sin límite.";
    accountHelp.textContent = "Plan activo: Pro · Compresión ilimitada · Controles avanzados desbloqueados";
    accountNavBtn.textContent = "Cuenta";
  } else if (plan === "free") {
    planBadge.textContent = "Gratis";
    heroText.textContent = "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Tu cuenta gratuita permite comprimir archivos de hasta 400 MB. Hazte Pro para comprimir sin límite de tamaño.";
    dropzoneText.textContent = "Haz clic aquí o arrastra un archivo PDF. Límite actual: hasta 400 MB.";
    accountHelp.textContent = "Plan activo: Gratis · Límite por archivo: 400 MB";
    accountNavBtn.textContent = "Cuenta";
  } else {
    planBadge.textContent = "Invitado";
    heroText.textContent = "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Sin iniciar sesión puedes comprimir archivos de hasta 200 MB. Crea una cuenta gratis y aumenta tu límite a 400 MB.";
    dropzoneText.textContent = "Haz clic aquí o arrastra un archivo PDF. Límite actual: hasta 200 MB.";
    accountHelp.textContent = "Sin login: 200 MB · Cuenta gratis: 400 MB · Pro: ilimitado";
    accountNavBtn.textContent = "Login";
  }

  renderAccountPage(plan, profile);
  document.dispatchEvent(new CustomEvent("plan-updated", { detail: { plan } }));
}

function renderAccountPage(plan, profile) {
  if (plan === "guest") {
    accountGuestView.classList.remove("hidden");
    accountUserView.classList.add("hidden");
    accountPageLead.textContent = "Inicia sesión o crea una cuenta gratis para aumentar tu límite a 400 MB.";
    return;
  }

  accountGuestView.classList.add("hidden");
  accountUserView.classList.remove("hidden");

  accountEmail.textContent = profile?.email || "-";
  accountPlan.textContent = plan === "pro" ? "Pro" : "Gratis";

  accountPlanDescription.textContent = plan === "pro"
    ? "Compresión sin límite de tamaño y controles avanzados desbloqueados."
    : "Límite actual: 400 MB por archivo.";

  accountUpgradeBtn.classList.toggle("hidden", plan === "pro");
  accountPageLead.textContent = "Administra tu correo, contraseña, suscripción y sesión.";
}

async function fetchProfilePlan(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan,email")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return {
      plan: "free",
      profile: null
    };
  }

  return {
    plan: data.plan || "free",
    profile: data
  };
}

async function refreshSessionState() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    renderPlanUi("guest", null);
    return;
  }

  const { plan, profile } = await fetchProfilePlan(session.user.id);

  renderPlanUi(plan, {
    ...profile,
    email: profile?.email || session.user.email
  });
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthMessage("Iniciando sesión...");

  const { error } = await supabase.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value
  });

  if (error) {
    setAuthMessage(error.message, true);
    return;
  }

  setAuthMessage("Sesión iniciada.");
  await refreshSessionState();
  goToAccountTab();
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthMessage("Creando cuenta...");

  const { error } = await supabase.auth.signUp({
    email: registerEmail.value.trim(),
    password: registerPassword.value
  });

  if (error) {
    setAuthMessage(error.message, true);
    return;
  }

  setAuthMessage("Cuenta creada. Si activaste confirmación por correo, revisa tu email.");
  await refreshSessionState();
  goToAccountTab();
});

accountLogoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  renderPlanUi("guest", null);
  goToAccountTab();
});

resetPasswordBtn?.addEventListener("click", async () => {
  const email = accountEmail.textContent;

  if (!email || email === "-") {
    setAuthMessage("No encontramos un correo válido.", true);
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  if (error) {
    setAuthMessage(error.message, true);
    return;
  }

  setAuthMessage("Te enviamos un enlace para cambiar tu contraseña.");
});

accountUpgradeBtn?.addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("open-plans-modal"));
});

document.addEventListener("open-auth-modal", () => {
  goToAccountTab();
});

supabase.auth.onAuthStateChange(async () => {
  await refreshSessionState();
});

await refreshSessionState();

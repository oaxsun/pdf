import { supabase } from "./supabaseClient.js";

const authModal = document.getElementById("authModal");
const openAuthBtn = document.getElementById("openAuthBtn");
const closeAuthModal = document.getElementById("closeAuthModal");
const logoutBtn = document.getElementById("logoutBtn");
const authMessage = document.getElementById("authMessage");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const showLoginTab = document.getElementById("showLoginTab");
const showRegisterTab = document.getElementById("showRegisterTab");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");

const planBadge = document.getElementById("planBadge");
const heroText = document.getElementById("heroText");
const dropzoneText = document.getElementById("dropzoneText");
const accountHelp = document.getElementById("accountHelp");

window.currentUserPlan = "guest";
window.currentUser = null;

function setAuthMessage(text, isError = false) {
  authMessage.textContent = text;
  authMessage.style.color = isError ? "#fca5a5" : "#94a3b8";
}

export function openAuthModal(mode = "login") {
  authModal.classList.remove("hidden");
  setAuthMessage("");
  if (mode === "register") {
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  } else {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  }
}

function closeModal() {
  authModal.classList.add("hidden");
  setAuthMessage("");
}

function showLogin() {
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
}

function showRegister() {
  registerForm.classList.remove("hidden");
  loginForm.classList.add("hidden");
}

function renderPlanUi(plan) {
  if (plan === "pro") {
    planBadge.textContent = "Pro";
    heroText.textContent = "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Tu cuenta Pro te permite comprimir archivos sin límite de tamaño.";
    dropzoneText.textContent = "Haz clic aquí o arrastra un archivo PDF. Límite actual: sin límite.";
    accountHelp.textContent = "Plan activo: Pro · Compresión ilimitada · Controles avanzados desbloqueados";
    openAuthBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else if (plan === "free") {
    planBadge.textContent = "Gratis";
    heroText.textContent = "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Tu cuenta gratuita permite comprimir archivos de hasta 400 MB. Hazte Pro para comprimir sin límite de tamaño.";
    dropzoneText.textContent = "Haz clic aquí o arrastra un archivo PDF. Límite actual: hasta 400 MB.";
    accountHelp.textContent = "Plan activo: Gratis · Límite por archivo: 400 MB";
    openAuthBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    planBadge.textContent = "Invitado";
    heroText.textContent = "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Sin iniciar sesión puedes comprimir archivos de hasta 200 MB. Crea una cuenta gratis y aumenta tu límite a 400 MB.";
    dropzoneText.textContent = "Haz clic aquí o arrastra un archivo PDF. Límite actual: hasta 200 MB.";
    accountHelp.textContent = "Sin login: 200 MB · Cuenta gratis: 400 MB · Pro: ilimitado";
    openAuthBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }

  window.currentUserPlan = plan;
  document.dispatchEvent(new CustomEvent("plan-updated", { detail: { plan } }));
}

async function fetchProfilePlan(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan,email")
    .eq("id", userId)
    .single();

  if (error || !data) return "free";

  window.currentUser = data;
  return data.plan || "free";
}

async function refreshSessionState() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    window.currentUser = null;
    renderPlanUi("guest");
    return;
  }

  const plan = await fetchProfilePlan(session.user.id);
  renderPlanUi(plan);
}

openAuthBtn?.addEventListener("click", () => openAuthModal("login"));
closeAuthModal?.addEventListener("click", closeModal);
showLoginTab?.addEventListener("click", showLogin);
showRegisterTab?.addEventListener("click", showRegister);

document.addEventListener("open-auth-modal", (event) => {
  openAuthModal(event.detail?.mode || "login");
});

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

  await refreshSessionState();
  closeModal();
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
});

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.currentUser = null;
  renderPlanUi("guest");
});

supabase.auth.onAuthStateChange(async () => {
  await refreshSessionState();
});

await refreshSessionState();

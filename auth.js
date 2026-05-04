import { supabase } from "./supabaseClient.js";

const accountNavBtn = document.getElementById("accountNavBtn");

const authMessage = document.getElementById("authMessage");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const registerPasswordConfirm = document.getElementById("registerPasswordConfirm");

const showCreateAccountBtn = document.getElementById("showCreateAccountBtn");
const showLoginAccountBtn = document.getElementById("showLoginAccountBtn");
const authPanelTitle = document.getElementById("authPanelTitle");
const authPanelSubtitle = document.getElementById("authPanelSubtitle");

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

const passwordResetView = document.getElementById("passwordResetView");
const passwordResetForm = document.getElementById("passwordResetForm");
const newPassword = document.getElementById("newPassword");
const newPasswordConfirm = document.getElementById("newPasswordConfirm");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const cancelPasswordResetBtn = document.getElementById("cancelPasswordResetBtn");

window.currentUserPlan = "guest";
window.currentUser = null;

const TESTER_PRO_DOMAIN = "@oaxsun.tech";
const TESTER_PRO_EMAILS = ["hello@oaxsun.tech"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isTesterProEmail(email) {
  const normalized = normalizeEmail(email);
  return TESTER_PRO_EMAILS.includes(normalized) || normalized.endsWith(TESTER_PRO_DOMAIN);
}

function getEffectivePlan(plan, email) {
  if (isTesterProEmail(email)) return "pro";
  return plan || "free";
}

let isRefreshingSession = false;
const PASSWORD_CHANGE_COOLDOWN_MONTHS = 6;
let isPasswordRecoveryFlow = false;

function formatDateForUser(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
  } catch (_) {
    return new Date(value).toLocaleDateString();
  }
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getNextPasswordChangeDate(lastChangeAt) {
  if (!lastChangeAt) return null;
  return addMonths(new Date(lastChangeAt), PASSWORD_CHANGE_COOLDOWN_MONTHS);
}

function canChangePassword(lastChangeAt) {
  const next = getNextPasswordChangeDate(lastChangeAt);
  return !next || Date.now() >= next.getTime();
}

function getFriendlyAuthError(error) {
  const message = String(error?.message || error || "");
  const lower = message.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("email rate limit") || lower.includes("too many")) {
    return "Supabase limitó temporalmente los correos. Espera un rato o configura SMTP propio para evitar este límite.";
  }

  return message || "Ocurrió un error. Inténtalo de nuevo.";
}

function setAuthMessage(text, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = text;
  authMessage.style.color = isError ? "#fca5a5" : "#94a3b8";
}

function setSubmitState(form, isLoading, loadingText, defaultText) {
  const button = form?.querySelector("button[type='submit']");
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? loadingText : defaultText;
}

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("La conexión tardó demasiado. Revisa Supabase, tu config.js o tu conexión.")), ms);
    })
  ]);
}

function goToAccountTab() {
  accountNavBtn?.click();
}

function goToHomeTab() {
  const homeTab = document.querySelector(".nav-link[data-tab=\"0\"]");
  homeTab?.click();
}

function showLoginPanel() {
  passwordResetView?.classList.add("hidden");
  accountGuestView?.classList.remove("hidden");
  loginForm?.classList.remove("hidden");
  registerForm?.classList.add("hidden");

  if (authPanelTitle) authPanelTitle.textContent = "Ingresar";
  if (authPanelSubtitle) authPanelSubtitle.textContent = "Accede para administrar tu cuenta, plan y suscripción.";

  setAuthMessage("");
}

function showRegisterPanel() {
  passwordResetView?.classList.add("hidden");
  accountGuestView?.classList.remove("hidden");
  registerForm?.classList.remove("hidden");
  loginForm?.classList.add("hidden");

  if (authPanelTitle) authPanelTitle.textContent = "Crear cuenta";
  if (authPanelSubtitle) authPanelSubtitle.textContent = "Regístrate gratis y aumenta tu límite a 400 MB.";

  setAuthMessage("");
}

function showPasswordResetPanel() {
  accountGuestView?.classList.add("hidden");
  accountUserView?.classList.add("hidden");
  passwordResetView?.classList.remove("hidden");
  safeSetText(accountPageLead, "Crea una nueva contraseña para tu cuenta.");
  setAuthMessage("");
}

showCreateAccountBtn?.addEventListener("click", showRegisterPanel);
showLoginAccountBtn?.addEventListener("click", showLoginPanel);

accountNavBtn?.addEventListener("click", () => {
  if ((window.currentUserPlan || "guest") === "guest") {
    window.setTimeout(showRegisterPanel, 0);
  }
});

function safeSetText(element, value) {
  if (element) element.textContent = value;
}

function renderPlanUi(plan, profile = null) {
  window.currentUserPlan = plan;
  window.currentUser = profile;

  if (plan === "pro") {
    safeSetText(planBadge, "Pro");
    safeSetText(heroText, "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Tu cuenta Pro te permite comprimir archivos sin límite de tamaño.");
    safeSetText(dropzoneText, "Haz clic aquí o arrastra un archivo PDF. Límite actual: sin límite.");
    safeSetText(accountHelp, "Plan activo: Pro · Compresión ilimitada · Controles avanzados desbloqueados");
    safeSetText(accountNavBtn, "Cuenta");
  } else if (plan === "free") {
    safeSetText(planBadge, "Gratis");
    safeSetText(heroText, "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Tu cuenta gratuita permite comprimir archivos de hasta 400 MB. Hazte Pro para comprimir sin límite de tamaño.");
    safeSetText(dropzoneText, "Haz clic aquí o arrastra un archivo PDF. Límite actual: hasta 400 MB.");
    safeSetText(accountHelp, "Plan activo: Gratis · Límite por archivo: 400 MB");
    safeSetText(accountNavBtn, "Cuenta");
  } else {
    safeSetText(planBadge, "Invitado");
    safeSetText(heroText, "Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Sin iniciar sesión puedes comprimir archivos de hasta 200 MB. Crea una cuenta gratis y aumenta tu límite a 400 MB.");
    safeSetText(dropzoneText, "Haz clic aquí o arrastra un archivo PDF. Límite actual: hasta 200 MB.");
    safeSetText(accountHelp, "Sin login: 200 MB · Cuenta gratis: 400 MB · Pro: ilimitado");
    safeSetText(accountNavBtn, "Login");
  }

  renderAccountPage(plan, profile);
  document.dispatchEvent(new CustomEvent("plan-updated", { detail: { plan } }));
}

function renderAccountPage(plan, profile) {
  if (plan === "guest") {
    passwordResetView?.classList.add("hidden");
    accountGuestView?.classList.remove("hidden");
    accountUserView?.classList.add("hidden");
    safeSetText(accountPageLead, "Inicia sesión o crea una cuenta gratis para aumentar tu límite a 400 MB.");
    showRegisterPanel();
    return;
  }

  passwordResetView?.classList.add("hidden");
  accountGuestView?.classList.add("hidden");
  accountUserView?.classList.remove("hidden");

  safeSetText(accountEmail, profile?.email || "-");
  safeSetText(accountPlan, plan === "pro" ? "Pro" : "Gratis");

  const isTester = isTesterProEmail(profile?.email);

  safeSetText(
    accountPlanDescription,
    plan === "pro"
      ? (isTester
          ? "Cuenta tester Oaxsun · Pro activo sin método de pago."
          : "Compresión sin límite de tamaño y controles avanzados desbloqueados.")
      : "Límite actual: 400 MB por archivo."
  );

  accountUpgradeBtn?.classList.toggle("hidden", plan === "pro");
  safeSetText(accountPageLead, "Administra tu correo, contraseña, suscripción y sesión.");
}

async function ensureProfile(user) {
  if (!user?.id) {
    return { plan: "guest", profile: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("plan,email,last_password_change_at")
    .eq("id", user.id)
    .maybeSingle();

  if (data && !error) {
    const email = data.email || user.email;
    const effectivePlan = getEffectivePlan(data.plan || "free", email);

    if (effectivePlan === "pro" && data.plan !== "pro") {
      supabase
        .from("profiles")
        .update({ plan: "pro", email })
        .eq("id", user.id)
        .then(({ error: updateError }) => {
          if (updateError) console.warn("No se pudo marcar tester como Pro:", updateError);
        });
    }

    return {
      plan: effectivePlan,
      profile: {
        ...data,
        email,
        plan: effectivePlan
      }
    };
  }

  console.warn("No se pudo leer profiles; usando fallback según correo.", error);

  const fallbackEmail = user.email;
  const fallbackPlan = getEffectivePlan("free", fallbackEmail);

  try {
    await supabase
      .from("profiles")
      .upsert({ id: user.id, email: fallbackEmail, plan: fallbackPlan }, { onConflict: "id" });
  } catch (insertError) {
    console.warn("No se pudo crear/actualizar profiles desde frontend. Revisa RLS/trigger.", insertError);
  }

  return {
    plan: fallbackPlan,
    profile: {
      email: fallbackEmail,
      plan: fallbackPlan
    }
  };
}

async function refreshSessionState() {
  if (isRefreshingSession) return;
  isRefreshingSession = true;

  try {
    const { data, error } = await withTimeout(supabase.auth.getSession());

    if (error) {
      console.error("Error getSession:", error);
      renderPlanUi("guest", null);
      return;
    }

    const session = data?.session;

    if (!session?.user) {
      renderPlanUi("guest", null);
      return;
    }

    const { plan, profile } = await ensureProfile(session.user);
    renderPlanUi(plan, profile);
  } catch (err) {
    console.error("Error refreshSessionState:", err);
    setAuthMessage(err.message || "No se pudo revisar la sesión.", true);
    renderPlanUi("guest", null);
  } finally {
    isRefreshingSession = false;
  }
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmail?.value.trim();
  const password = loginPassword?.value;

  if (!email || !password) {
    setAuthMessage("Escribe tu correo y contraseña.", true);
    return;
  }

  setSubmitState(loginForm, true, "Ingresando...", "Ingresar");
  setAuthMessage("Iniciando sesión...");

  try {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password })
    );

    if (error) {
      setAuthMessage(getFriendlyAuthError(error), true);
      return;
    }

    if (!data?.user) {
      setAuthMessage("No se pudo iniciar sesión. Revisa tus datos.", true);
      return;
    }

    const { plan, profile } = await ensureProfile(data.user);
    renderPlanUi(plan, profile);

    setAuthMessage("Sesión iniciada.");
    goToHomeTab();
  } catch (err) {
    console.error("Error login:", err);
    setAuthMessage(err.message || "No se pudo iniciar sesión.", true);
  } finally {
    setSubmitState(loginForm, false, "Ingresando...", "Ingresar");
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = registerEmail?.value.trim();
  const password = registerPassword?.value;
  const confirm = registerPasswordConfirm?.value;

  if (!email || !password || !confirm) {
    setAuthMessage("Completa todos los campos.", true);
    return;
  }

  if (password !== confirm) {
    setAuthMessage("Las contraseñas no coinciden.", true);
    return;
  }

  if (password.length < 6) {
    setAuthMessage("La contraseña debe tener al menos 6 caracteres.", true);
    return;
  }

  setSubmitState(registerForm, true, "Creando cuenta...", "Crear cuenta");
  setAuthMessage("Creando cuenta...");

  try {
    const { data, error } = await withTimeout(
      supabase.auth.signUp({ email, password })
    );

    if (error) {
      setAuthMessage(getFriendlyAuthError(error), true);
      return;
    }

    if (data?.user) {
      const { plan, profile } = await ensureProfile(data.user);
      renderPlanUi(plan, profile);
    }

    setAuthMessage("Cuenta creada. Si Supabase pide confirmación, revisa tu correo.");
    await refreshSessionState();
    goToHomeTab();
  } catch (err) {
    console.error("Error registro:", err);
    setAuthMessage(err.message || "No se pudo crear la cuenta.", true);
  } finally {
    setSubmitState(registerForm, false, "Creando cuenta...", "Crear cuenta");
  }
});

accountLogoutBtn?.addEventListener("click", async () => {
  const originalText = accountLogoutBtn.textContent;
  accountLogoutBtn.disabled = true;
  accountLogoutBtn.textContent = "Cerrando...";

  try {
    const { error } = await withTimeout(supabase.auth.signOut(), 10000);
    if (error) throw error;

    renderPlanUi("guest", null);
    showRegisterPanel();
    goToAccountTab();
  } catch (err) {
    console.error("Error logout:", err);
    setAuthMessage(err.message || "No se pudo cerrar sesión.", true);
  } finally {
    accountLogoutBtn.disabled = false;
    accountLogoutBtn.textContent = originalText || "Cerrar sesión";
  }
});

resetPasswordBtn?.addEventListener("click", async () => {
  const email = accountEmail?.textContent;

  if (!email || email === "-") {
    setAuthMessage("No encontramos un correo válido.", true);
    return;
  }

  if (window.currentUser?.last_password_change_at && !canChangePassword(window.currentUser.last_password_change_at)) {
    const nextDate = getNextPasswordChangeDate(window.currentUser.last_password_change_at);
    setAuthMessage(`Por seguridad, solo puedes cambiar tu contraseña una vez cada 6 meses. Podrás cambiarla de nuevo el ${formatDateForUser(nextDate)}.`, true);
    return;
  }

  resetPasswordBtn.disabled = true;
  const originalText = resetPasswordBtn.textContent;
  resetPasswordBtn.textContent = "Enviando...";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}?reset-password=1`
  });

  resetPasswordBtn.disabled = false;
  resetPasswordBtn.textContent = originalText || "Cambiar";

  if (error) {
    setAuthMessage(getFriendlyAuthError(error), true);
    return;
  }

  setAuthMessage("Te enviamos un enlace para cambiar tu contraseña.");
});

forgotPasswordBtn?.addEventListener("click", async () => {
  const email = loginEmail?.value.trim();

  if (!email) {
    setAuthMessage("Escribe tu correo y luego presiona ‘Olvidaste tu contraseña’. Busca el enlace en tu email.", true);
    loginEmail?.focus();
    return;
  }

  forgotPasswordBtn.disabled = true;
  const originalText = forgotPasswordBtn.textContent;
  forgotPasswordBtn.textContent = "Enviando enlace...";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}?reset-password=1`
  });

  forgotPasswordBtn.disabled = false;
  forgotPasswordBtn.textContent = originalText || "¿Olvidaste tu contraseña?";

  if (error) {
    setAuthMessage(getFriendlyAuthError(error), true);
    return;
  }

  setAuthMessage("Te enviamos un enlace para crear una nueva contraseña. Revisa tu correo.");
});

passwordResetForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = newPassword?.value;
  const confirm = newPasswordConfirm?.value;

  if (!password || !confirm) {
    setAuthMessage("Completa ambos campos.", true);
    return;
  }

  if (password !== confirm) {
    setAuthMessage("Las contraseñas no coinciden.", true);
    return;
  }

  if (password.length < 6) {
    setAuthMessage("La contraseña debe tener al menos 6 caracteres.", true);
    return;
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    setAuthMessage("Tu enlace de recuperación expiró o no es válido. Solicita otro enlace.", true);
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_password_change_at,email,plan")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.last_password_change_at && !canChangePassword(profile.last_password_change_at)) {
    const nextDate = getNextPasswordChangeDate(profile.last_password_change_at);
    setAuthMessage(`Por seguridad, solo puedes cambiar tu contraseña una vez cada 6 meses. Podrás cambiarla de nuevo el ${formatDateForUser(nextDate)}.`, true);
    return;
  }

  setSubmitState(passwordResetForm, true, "Actualizando...", "Actualizar contraseña");
  setAuthMessage("Actualizando contraseña...");

  try {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setAuthMessage(getFriendlyAuthError(error), true);
      return;
    }

    await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        plan: getEffectivePlan(profile?.plan || "free", user.email),
        last_password_change_at: new Date().toISOString()
      }, { onConflict: "id" });

    const { plan, profile: ensuredProfile } = await ensureProfile(user);
    renderPlanUi(plan, ensuredProfile);
    setAuthMessage("Contraseña actualizada correctamente.");
    goToAccountTab();
  } catch (err) {
    console.error("Error actualizando contraseña:", err);
    setAuthMessage(getFriendlyAuthError(err), true);
  } finally {
    setSubmitState(passwordResetForm, false, "Actualizando...", "Actualizar contraseña");
  }
});

cancelPasswordResetBtn?.addEventListener("click", async () => {
  isPasswordRecoveryFlow = false;
  await refreshSessionState();
  goToAccountTab();
});

accountUpgradeBtn?.addEventListener("click", () => {
  document.dispatchEvent(new CustomEvent("open-plans-modal"));
});

document.addEventListener("open-auth-modal", (event) => {
  goToAccountTab();
  if (event.detail?.mode === "register") {
    showRegisterPanel();
  } else {
    showLoginPanel();
  }
});

supabase.auth.onAuthStateChange(async (event) => {
  if (event === "PASSWORD_RECOVERY") {
    isPasswordRecoveryFlow = true;
    goToAccountTab();
    showPasswordResetPanel();
    return;
  }

  if (event === "INITIAL_SESSION") return;
  if (isPasswordRecoveryFlow) return;
  await refreshSessionState();
});

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("reset-password") === "1") {
  isPasswordRecoveryFlow = true;
  goToAccountTab();
  showPasswordResetPanel();
} else {
  showRegisterPanel();
  await refreshSessionState();
}

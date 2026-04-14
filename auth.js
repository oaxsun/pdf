import { supabase } from './supabaseClient.js';

const authModal = document.getElementById('authModal');
const authTrigger = document.getElementById('authTrigger');
const closeAuthModal = document.getElementById('closeAuthModal');
const showLoginTab = document.getElementById('showLoginTab');
const showRegisterTab = document.getElementById('showRegisterTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const authMessage = document.getElementById('authMessage');
const heroSubtitle = document.getElementById('heroSubtitle');
const accountSummary = document.getElementById('accountSummary');
const planBadge = document.getElementById('planBadge');
const dropzoneText = document.getElementById('dropzoneText');
const buyProBtn = document.getElementById('buyProBtn');

window.currentUserPlan = 'guest';
window.currentUser = null;

function setAuthMessage(text = '', type = '') {
  authMessage.className = `message ${type}`.trim();
  authMessage.textContent = text;
}

function openAuth(mode = 'login') {
  authModal.classList.remove('hidden');
  if (mode === 'register') {
    showRegister();
  } else {
    showLogin();
  }
}

function closeAuth() {
  authModal.classList.add('hidden');
  setAuthMessage('');
}

function showLogin() {
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  showLoginTab.classList.add('active');
  showRegisterTab.classList.remove('active');
}

function showRegister() {
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  showRegisterTab.classList.add('active');
  showLoginTab.classList.remove('active');
}

function renderPlan(plan) {
  window.currentUserPlan = plan;

  if (plan === 'pro') {
    authTrigger.textContent = 'Mi cuenta';
    heroSubtitle.textContent = 'Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Tu cuenta Pro te permite comprimir archivos sin límite de tamaño.';
    accountSummary.textContent = 'Cuenta Pro · Límite actual ilimitado';
    dropzoneText.textContent = 'Haz clic aquí o arrastra un archivo PDF. Límite actual: sin límite.';
    planBadge.textContent = 'PRO';
    buyProBtn.textContent = 'Ya eres Pro';
    buyProBtn.disabled = true;
  } else if (plan === 'free') {
    authTrigger.textContent = 'Mi cuenta';
    heroSubtitle.textContent = 'Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Tu cuenta gratuita permite comprimir archivos de hasta 400 MB. Hazte Pro para comprimir sin límite de tamaño.';
    accountSummary.textContent = 'Cuenta Gratis · Límite actual 400 MB';
    dropzoneText.textContent = 'Haz clic aquí o arrastra un archivo PDF. Límite actual: hasta 400 MB.';
    planBadge.textContent = 'FREE';
    buyProBtn.textContent = 'Hazte Pro';
    buyProBtn.disabled = false;
  } else {
    authTrigger.textContent = 'Login';
    heroSubtitle.textContent = 'Reduce el tamaño de tus PDFs directamente en tu navegador. Sin subir archivos a servidores. Sin iniciar sesión puedes comprimir archivos de hasta 200 MB. Crea una cuenta gratis y aumenta tu límite a 400 MB.';
    accountSummary.textContent = 'Invitado · Límite actual 200 MB';
    dropzoneText.textContent = 'Haz clic aquí o arrastra un archivo PDF. Límite actual: hasta 200 MB.';
    planBadge.textContent = 'GUEST';
    buyProBtn.textContent = 'Hazte Pro';
    buyProBtn.disabled = false;
  }

  document.dispatchEvent(new CustomEvent('plan-updated', { detail: { plan } }));
}

async function fetchProfilePlan(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,plan')
    .eq('id', userId)
    .single();

  if (error || !data) return 'free';
  window.currentUser = data;
  return data.plan || 'free';
}

async function refreshSessionState() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    window.currentUser = null;
    renderPlan('guest');
    return;
  }

  const plan = await fetchProfilePlan(session.user.id);
  renderPlan(plan);
}

authTrigger?.addEventListener('click', (e) => {
  e.preventDefault();
  openAuth('login');
});
closeAuthModal?.addEventListener('click', closeAuth);
showLoginTab?.addEventListener('click', showLogin);
showRegisterTab?.addEventListener('click', showRegister);

authModal?.addEventListener('click', (e) => {
  if (e.target === authModal) closeAuth();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !authModal.classList.contains('hidden')) {
    closeAuth();
  }
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setAuthMessage('Iniciando sesión...', 'warn');

  const { error } = await supabase.auth.signInWithPassword({
    email: loginEmail.value.trim(),
    password: loginPassword.value
  });

  if (error) {
    setAuthMessage(error.message, 'error');
    return;
  }

  await refreshSessionState();
  setAuthMessage('Sesión iniciada correctamente.', 'success');
  closeAuth();
});

registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setAuthMessage('Creando cuenta...', 'warn');

  const { error } = await supabase.auth.signUp({
    email: registerEmail.value.trim(),
    password: registerPassword.value
  });

  if (error) {
    setAuthMessage(error.message, 'error');
    return;
  }

  await refreshSessionState();
  setAuthMessage('Cuenta creada. Si activaste verificación por correo, revisa tu email.', 'success');
  closeAuth();
});

supabase.auth.onAuthStateChange(async () => {
  await refreshSessionState();
});

window.openAuthModal = openAuth;
window.closeAuthModal = closeAuth;

await refreshSessionState();

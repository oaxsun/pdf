const { jsPDF } = window.jspdf;

const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const filePanel = document.getElementById('filePanel');
const fileName = document.getElementById('fileName');
const fileMeta = document.getElementById('fileMeta');
const originalSize = document.getElementById('originalSize');
const finalSize = document.getElementById('finalSize');
const savedPercent = document.getElementById('savedPercent');
const compressBtn = document.getElementById('compressBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const message = document.getElementById('message');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const preset = document.getElementById('preset');
const presetWrap = document.getElementById('presetWrap');
const scaleRange = document.getElementById('scaleRange');
const qualityRange = document.getElementById('qualityRange');
const scaleValue = document.getElementById('scaleValue');
const qualityValue = document.getElementById('qualityValue');
const scaleWrap = document.getElementById('scaleWrap');
const qualityWrap = document.getElementById('qualityWrap');
const track = document.getElementById('track');
const tabLinks = document.querySelectorAll('.nav-link[data-tab]');
const brandHome = document.getElementById('brandHome');
const limitModal = document.getElementById('limitModal');
const limitTitle = document.getElementById('limitTitle');
const limitDescription = document.getElementById('limitDescription');
const limitBenefits = document.getElementById('limitBenefits');
const limitActions = document.getElementById('limitActions');
const closeLimitX = document.getElementById('closeLimitX');

let selectedFile = null;
let outputUrl = null;
let currentTab = 0;
let defaultCompressBtnHtml = compressBtn.innerHTML;

const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';

function getPlan() {
  return window.currentUserPlan || 'guest';
}

function isProUser() {
  return getPlan() === 'pro';
}

function getUploadLimit() {
  if (getPlan() === 'pro') return Infinity;
  if (getPlan() === 'free') return 400 * 1024 * 1024;
  return 200 * 1024 * 1024;
}

function setTab(index) {
  currentTab = index;
  track.style.transform = `translateX(-${index * 100}%)`;
  tabLinks.forEach((link) => {
    link.classList.toggle('active', Number(link.dataset.tab) === index);
  });
}

tabLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    setTab(Number(link.dataset.tab));
  });
});

brandHome.addEventListener('click', (e) => {
  e.preventDefault();
  setTab(0);
});

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 2)} ${units[i]}`;
}

function setMessage(text = '', type = '') {
  message.className = `message ${type}`.trim();
  message.textContent = text;
}

function setProgress(percent, text) {
  progressWrap.style.display = 'grid';
  progressBar.style.width = `${percent}%`;
  progressText.textContent = text;
}

function resetProgress() {
  progressWrap.style.display = 'none';
  progressBar.style.width = '0%';
  progressText.textContent = 'Preparando...';
}

function resetOutput() {
  finalSize.textContent = '-';
  savedPercent.textContent = '-';
  downloadBtn.style.display = 'none';
  downloadBtn.removeAttribute('href');

  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
    outputUrl = null;
  }
}

function syncPresetControls(name) {
  const presets = {
    light:   { scale: 1.8, quality: 0.95 },
    optimal: { scale: 1.5, quality: 0.90 },
    extreme: { scale: 0.8, quality: 0.40 }
  };

  const p = presets[name];
  scaleRange.value = p.scale;
  qualityRange.value = p.quality;
  updateRangeLabels();
}

function updateRangeLabels() {
  scaleValue.textContent = `${Number(scaleRange.value).toFixed(1)}x`;
  qualityValue.textContent = `${Math.round(Number(qualityRange.value) * 100)}%`;
}

function applyProLock() {
  if (!isProUser()) {
    preset.value = 'optimal';
    preset.disabled = true;
    presetWrap.classList.add('select-lock');
    scaleRange.value = 1.5;
    qualityRange.value = 0.9;
    scaleRange.disabled = true;
    qualityRange.disabled = true;
    scaleWrap.classList.add('locked');
    qualityWrap.classList.add('locked');
    updateRangeLabels();
  } else {
    preset.disabled = false;
    presetWrap.classList.remove('select-lock');
    scaleRange.disabled = false;
    qualityRange.disabled = false;
    scaleWrap.classList.remove('locked');
    qualityWrap.classList.remove('locked');
    updateRangeLabels();
  }
}

function closeLimitModal() {
  limitModal.classList.add('hidden');
}

function openLimitModal() {
  limitBenefits.innerHTML = `
    <div>Procesa archivos grandes sin límite de tamaño.</div>
    <div>Desbloquea presets de compresión avanzados.</div>
    <div>Ajusta resolución y calidad manualmente.</div>
    <div>Comprime varios archivos en una sola sesión.</div>
  `;

  if (getPlan() === 'guest') {
    limitTitle.textContent = 'Tu archivo supera el límite para invitados';
    limitDescription.innerHTML = 'Sin iniciar sesión puedes comprimir archivos de hasta <strong>200 MB</strong>. Crea una cuenta gratis para aumentar tu límite a <strong>400 MB</strong>, o hazte Pro para comprimir <strong>sin límite</strong>.';
    limitActions.innerHTML = `
      <button class="btn btn-primary" id="registerFromLimit" type="button">Crear cuenta gratis</button>
      <button class="btn btn-gold" id="proFromLimit" type="button">Hazte Pro</button>
      <button class="btn btn-secondary" id="continueGuest" type="button">Continuar sin registrarme</button>
    `;
  } else if (getPlan() === 'free') {
    limitTitle.textContent = 'Tu archivo supera el límite de tu cuenta gratuita';
    limitDescription.innerHTML = 'Tu cuenta gratuita permite comprimir archivos de hasta <strong>400 MB</strong>. Actualiza a Pro para comprimir archivos más grandes y desbloquear funciones avanzadas.';
    limitActions.innerHTML = `
      <button class="btn btn-gold" id="proFromLimit" type="button">Hazte Pro</button>
      <button class="btn btn-secondary" id="continueGuest" type="button">Continuar gratis</button>
    `;
  } else {
    limitTitle.textContent = 'Tu cuenta Pro no tiene límite';
    limitDescription.textContent = 'Si estás viendo este mensaje, revisa la validación del backend o la carga del plan.';
    limitActions.innerHTML = `<button class="btn btn-secondary" id="continueGuest" type="button">Cerrar</button>`;
  }

  limitModal.classList.remove('hidden');

  document.getElementById('continueGuest')?.addEventListener('click', closeLimitModal);
  document.getElementById('registerFromLimit')?.addEventListener('click', () => {
    closeLimitModal();
    window.openAuthModal?.('register');
  });
  document.getElementById('proFromLimit')?.addEventListener('click', () => {
    closeLimitModal();
    document.getElementById('buyProBtn')?.click();
  });
}

function triggerAutoDownload() {
  if (!downloadBtn.href) return;
  downloadBtn.click();
}

function setCompressingState(isLoading) {
  if (isLoading) {
    compressBtn.disabled = true;
    compressBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Comprimiendo...</span>';
  } else {
    compressBtn.disabled = !selectedFile;
    compressBtn.innerHTML = defaultCompressBtnHtml;
  }
}

function loadFile(file) {
  if (!file) return;

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    setMessage('Selecciona un archivo PDF válido.', 'error');
    return;
  }

  const uploadLimit = getUploadLimit();
  if (file.size > uploadLimit) {
    selectedFile = null;
    fileInput.value = '';
    filePanel.style.display = 'none';
    originalSize.textContent = '-';
    compressBtn.disabled = true;
    resetOutput();
    resetProgress();
    setMessage('');
    openLimitModal();
    return;
  }

  selectedFile = file;
  filePanel.style.display = 'block';
  fileName.textContent = file.name;
  fileMeta.textContent = `Última modificación: ${new Date(file.lastModified).toLocaleString()}`;
  originalSize.textContent = formatBytes(file.size);
  compressBtn.disabled = false;
  resetOutput();
  resetProgress();
  setMessage('Archivo listo para compresión.', 'warn');
}

async function renderPageToJPEG(page, scale, quality) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });

  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  await page.render({ canvasContext: context, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', quality);

  return {
    dataUrl,
    widthPx: canvas.width,
    heightPx: canvas.height
  };
}

async function compressPdfAggressive(file, scale, quality) {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    useWorkerFetch: true,
    isEvalSupported: false
  });
  const pdf = await loadingTask.promise;

  let doc;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const progressBase = ((pageNum - 1) / pdf.numPages) * 100;
    setProgress(Math.min(95, progressBase), `Procesando página ${pageNum} de ${pdf.numPages}...`);

    const page = await pdf.getPage(pageNum);
    const result = await renderPageToJPEG(page, isProUser() ? Number(scale) : 1.5, isProUser() ? Number(quality) : 0.9);

    const mmPerPx = 25.4 / 96;
    const pageWidthMm = result.widthPx * mmPerPx;
    const pageHeightMm = result.heightPx * mmPerPx;

    if (!doc) {
      doc = new jsPDF({
        orientation: pageWidthMm > pageHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageWidthMm, pageHeightMm],
        compress: true,
        putOnlyUsedFonts: true
      });
    } else {
      doc.addPage([pageWidthMm, pageHeightMm], pageWidthMm > pageHeightMm ? 'landscape' : 'portrait');
    }

    const currentPageIndex = doc.getNumberOfPages();
    doc.setPage(currentPageIndex);
    doc.addImage(result.dataUrl, 'JPEG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'FAST');
  }

  setProgress(98, 'Generando PDF final...');
  const blob = doc.output('blob');
  setProgress(100, 'Compresión terminada.');
  return blob;
}

function showProMessage() {
  if (!isProUser()) {
    setMessage('Esta opción está disponible solo para usuarios Pro.', 'warn');
  }
}

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  loadFile(e.dataTransfer.files?.[0]);
});

fileInput.addEventListener('change', (e) => loadFile(e.target.files?.[0]));
preset.addEventListener('change', () => syncPresetControls(preset.value));
scaleRange.addEventListener('input', updateRangeLabels);
qualityRange.addEventListener('input', updateRangeLabels);
preset.addEventListener('click', showProMessage);
scaleRange.addEventListener('click', showProMessage);
qualityRange.addEventListener('click', showProMessage);
presetWrap.addEventListener('click', () => !isProUser() && showProMessage());
scaleWrap.addEventListener('click', () => !isProUser() && showProMessage());
qualityWrap.addEventListener('click', () => !isProUser() && showProMessage());

clearBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  filePanel.style.display = 'none';
  originalSize.textContent = '-';
  compressBtn.disabled = true;
  resetOutput();
  resetProgress();
  setMessage('');
  setCompressingState(false);
});

closeLimitX?.addEventListener('click', closeLimitModal);
limitModal?.addEventListener('click', (e) => {
  if (e.target === limitModal) closeLimitModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !limitModal.classList.contains('hidden')) {
    closeLimitModal();
  }
});

compressBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  resetOutput();
  setMessage('Procesando PDF...', 'warn');
  setCompressingState(true);

  try {
    const scale = Number(scaleRange.value);
    const quality = Number(qualityRange.value);
    const compressedBlob = await compressPdfAggressive(selectedFile, scale, quality);

    outputUrl = URL.createObjectURL(compressedBlob);

    const baseName = selectedFile.name.replace(/\.pdf$/i, '');
    const newName = `${baseName}_compressed.pdf`;

    downloadBtn.href = outputUrl;
    downloadBtn.download = newName;
    downloadBtn.style.display = 'block';

    finalSize.textContent = formatBytes(compressedBlob.size);
    const reduction = selectedFile.size > 0
      ? ((selectedFile.size - compressedBlob.size) / selectedFile.size) * 100
      : 0;

    savedPercent.textContent = `${Math.max(0, reduction).toFixed(1)}%`;

    if (compressedBlob.size < selectedFile.size) {
      setMessage('PDF comprimido correctamente. La descarga comenzó automáticamente.', 'success');
      triggerAutoDownload();
    } else {
      setMessage('Este PDF ya está optimizado o no se pudo reducir más con este método.', 'warn');
      triggerAutoDownload();
    }
  } catch (err) {
    console.error(err);
    setMessage('No se pudo procesar el PDF. Prueba con otro archivo o con un PDF no protegido.', 'error');
  } finally {
    setCompressingState(false);
  }
});

document.addEventListener('plan-updated', () => {
  applyProLock();
  if (selectedFile && selectedFile.size > getUploadLimit()) {
    selectedFile = null;
    fileInput.value = '';
    filePanel.style.display = 'none';
    originalSize.textContent = '-';
    compressBtn.disabled = true;
    resetOutput();
    resetProgress();
    setMessage('');
  }
});

syncPresetControls('optimal');
updateRangeLabels();
applyProLock();
setTab(0);

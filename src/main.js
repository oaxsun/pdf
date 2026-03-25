import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Compresor PDF v2.2</p>
        <h1>Ghostscript WASM, ahora con archivos locales del proyecto</h1>
        <p class="hero-copy">
          Esta versión usa <strong>Ghostscript compilado a WebAssembly</strong> dentro de un
          <strong>Web Worker</strong>, para evitar depender de workers externos. Procesa el archivo
          en tu navegador y no requiere backend.
        </p>
      </div>
      <div class="hero-card">
        <div class="hero-pill">Sin backend</div>
        <div class="hero-pill">Sin subir PDF</div>
        <div class="hero-pill">Ghostscript WASM</div>
      </div>
    </header>

    <main class="main-grid">
      <section class="panel panel-lg">
        <label class="dropzone" id="dropzone" for="fileInput">
          <input id="fileInput" type="file" accept="application/pdf" />
          <span class="dropzone-title">Sube o arrastra tu PDF</span>
          <span class="dropzone-copy">Haz clic aquí o suelta el archivo en esta zona</span>
        </label>

        <div class="file-panel hidden" id="filePanel">
          <div>
            <div class="file-name" id="fileName">-</div>
            <div class="file-meta" id="fileMeta">-</div>
          </div>
          <button class="btn btn-secondary" id="clearBtn" type="button">Quitar archivo</button>
        </div>

        <div class="stats-grid">
          <article class="stat-card">
            <span class="stat-label">Tamaño original</span>
            <strong class="stat-value" id="originalSize">-</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Tamaño final</span>
            <strong class="stat-value" id="finalSize">-</strong>
          </article>
          <article class="stat-card">
            <span class="stat-label">Reducción</span>
            <strong class="stat-value" id="savedPercent">-</strong>
          </article>
        </div>
      </section>

      <section class="panel controls-panel">
        <div class="field">
          <label for="preset">Preset Ghostscript</label>
          <select id="preset">
            <option value="/screen">/screen · máxima compresión</option>
            <option value="/ebook" selected>/ebook · balanceado</option>
            <option value="/printer">/printer · más calidad</option>
            <option value="/prepress">/prepress · mínima pérdida</option>
          </select>
        </div>

        <div class="field">
          <label for="compatibility">Compatibilidad PDF</label>
          <select id="compatibility">
            <option value="1.4" selected>PDF 1.4</option>
            <option value="1.5">PDF 1.5</option>
            <option value="1.6">PDF 1.6</option>
            <option value="1.7">PDF 1.7</option>
          </select>
        </div>

        <div class="field checkbox-field">
          <label>
            <input id="embedFonts" type="checkbox" checked />
            Intentar incrustar/subconjuntar fuentes
          </label>
        </div>

        <div class="field checkbox-field">
          <label>
            <input id="compressImages" type="checkbox" checked />
            Aplicar compresión/optimización de imágenes del preset
          </label>
        </div>

        <button class="btn btn-primary" id="compressBtn" type="button" disabled>
          Comprimir con Ghostscript
        </button>
        <a class="btn btn-secondary hidden" id="downloadBtn" download="pdf-comprimido-v2.2.pdf">
          Descargar PDF comprimido
        </a>
      </section>

      <section class="panel panel-full">
        <div class="progress-block hidden" id="progressWrap">
          <div class="progress-topline">
            <span id="progressText">Preparando...</span>
            <span id="progressPercent">0%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" id="progressBar"></div>
          </div>
        </div>

        <p class="message" id="message"></p>

        <div class="notes-grid">
          <article class="note-card">
            <h2>Qué cambia</h2>
            <p>
              Ya no dependes de un worker remoto. El proyecto usa un worker local del propio build.
            </p>
          </article>
          <article class="note-card">
            <h2>Cómo probar</h2>
            <p>
              Usa <code>npm install</code> y luego <code>npm run dev</code>. No abras el HTML con doble clic.
            </p>
          </article>
          <article class="note-card">
            <h2>Importante</h2>
            <p>
              Algunos PDFs ya optimizados pueden bajar poco, o incluso crecer. Prueba primero
              <code>/screen</code> y <code>/ebook</code>.
            </p>
          </article>
        </div>
      </section>
    </main>
  </div>
`;

const fileInput = document.querySelector('#fileInput');
const dropzone = document.querySelector('#dropzone');
const filePanel = document.querySelector('#filePanel');
const fileName = document.querySelector('#fileName');
const fileMeta = document.querySelector('#fileMeta');
const originalSize = document.querySelector('#originalSize');
const finalSize = document.querySelector('#finalSize');
const savedPercent = document.querySelector('#savedPercent');
const preset = document.querySelector('#preset');
const compatibility = document.querySelector('#compatibility');
const embedFonts = document.querySelector('#embedFonts');
const compressImages = document.querySelector('#compressImages');
const compressBtn = document.querySelector('#compressBtn');
const clearBtn = document.querySelector('#clearBtn');
const downloadBtn = document.querySelector('#downloadBtn');
const progressWrap = document.querySelector('#progressWrap');
const progressText = document.querySelector('#progressText');
const progressPercent = document.querySelector('#progressPercent');
const progressBar = document.querySelector('#progressBar');
const message = document.querySelector('#message');

let selectedFile = null;
let outputUrl = null;
let worker = null;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./workers/ghostscript.worker.js', import.meta.url), {
      type: 'module'
    });
  }
  return worker;
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const digits = value >= 10 || idx === 0 ? 0 : 2;
  return `${value.toFixed(digits)} ${units[idx]}`;
}

function setMessage(text = '', type = '') {
  message.className = `message ${type}`.trim();
  message.textContent = text;
}

function setProgress(percent, text) {
  progressWrap.classList.remove('hidden');
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  progressBar.style.width = `${safePercent}%`;
  progressPercent.textContent = `${safePercent}%`;
  progressText.textContent = text;
}

function resetProgress() {
  progressWrap.classList.add('hidden');
  progressBar.style.width = '0%';
  progressPercent.textContent = '0%';
  progressText.textContent = 'Preparando...';
}

function resetOutput() {
  finalSize.textContent = '-';
  savedPercent.textContent = '-';
  downloadBtn.classList.add('hidden');
  downloadBtn.removeAttribute('href');
  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
    outputUrl = null;
  }
}

function clearSelection() {
  selectedFile = null;
  fileInput.value = '';
  filePanel.classList.add('hidden');
  originalSize.textContent = '-';
  finalSize.textContent = '-';
  savedPercent.textContent = '-';
  compressBtn.disabled = true;
  resetOutput();
  resetProgress();
  setMessage('');
}

function loadFile(file) {
  if (!file) return;
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) {
    setMessage('Selecciona un archivo PDF válido.', 'error');
    return;
  }

  selectedFile = file;
  filePanel.classList.remove('hidden');
  fileName.textContent = file.name;
  fileMeta.textContent = `Última modificación: ${new Date(file.lastModified).toLocaleString()}`;
  originalSize.textContent = formatBytes(file.size);
  compressBtn.disabled = false;
  resetOutput();
  resetProgress();
  setMessage('Archivo listo para compresión con Ghostscript.', 'warn');
}

async function compressCurrentFile() {
  if (!selectedFile) return;

  compressBtn.disabled = true;
  resetOutput();
  setMessage('Preparando compresión...', 'warn');
  setProgress(5, 'Inicializando worker...');

  const instance = getWorker();
  const bytes = await selectedFile.arrayBuffer();

  const payload = {
    fileName: selectedFile.name,
    bytes,
    preset: preset.value,
    compatibility: compatibility.value,
    embedFonts: embedFonts.checked,
    compressImages: compressImages.checked
  };

  await new Promise((resolve, reject) => {
    let fakeProgress = 10;
    const timer = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 3, 90);
      setProgress(fakeProgress, 'Ghostscript está procesando el PDF...');
    }, 1000);

    const onMessage = (event) => {
      const data = event.data || {};

      if (data.type === 'status') {
        setProgress(data.percent ?? fakeProgress, data.message || 'Procesando...');
        return;
      }

      if (data.type === 'result') {
        clearInterval(timer);
        instance.removeEventListener('message', onMessage);
        instance.removeEventListener('error', onError);

        const blob = new Blob([data.bytes], { type: 'application/pdf' });
        outputUrl = URL.createObjectURL(blob);
        downloadBtn.href = outputUrl;
        downloadBtn.download = selectedFile.name.replace(/\.pdf$/i, '') + '-comprimido-v2.2.pdf';
        downloadBtn.classList.remove('hidden');

        finalSize.textContent = formatBytes(blob.size);
        const reduction = selectedFile.size > 0
          ? ((selectedFile.size - blob.size) / selectedFile.size) * 100
          : 0;
        savedPercent.textContent = `${Math.max(0, reduction).toFixed(1)}%`;

        setProgress(100, 'Compresión terminada.');
        if (blob.size < selectedFile.size) {
          setMessage('PDF comprimido correctamente con Ghostscript WASM.', 'success');
        } else {
          setMessage('El PDF se procesó, pero no redujo tamaño con esta combinación. Prueba otro preset.', 'error');
        }
        resolve();
        return;
      }

      if (data.type === 'error') {
        clearInterval(timer);
        instance.removeEventListener('message', onMessage);
        instance.removeEventListener('error', onError);
        reject(new Error(data.message || 'Ghostscript devolvió un error.'));
      }
    };

    const onError = (error) => {
      clearInterval(timer);
      instance.removeEventListener('message', onMessage);
      instance.removeEventListener('error', onError);
      reject(error instanceof Error ? error : new Error('Error en el worker.'));
    };

    instance.addEventListener('message', onMessage);
    instance.addEventListener('error', onError);
    instance.postMessage(payload, [payload.bytes]);
  });
}

fileInput.addEventListener('change', (event) => {
  loadFile(event.target.files?.[0]);
});

clearBtn.addEventListener('click', clearSelection);

compressBtn.addEventListener('click', async () => {
  try {
    await compressCurrentFile();
  } catch (error) {
    console.error(error);
    setMessage(
      'No se pudo procesar el PDF. Revisa la consola del navegador y confirma que ejecutaste el proyecto con Vite y npm install.',
      'error'
    );
  } finally {
    compressBtn.disabled = !selectedFile;
  }
});

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragover');
  loadFile(event.dataTransfer.files?.[0]);
});

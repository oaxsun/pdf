import createGhostscriptModule from '@jspawn/ghostscript-wasm';

let ghostscriptModulePromise = null;

function postStatus(message, percent) {
  self.postMessage({ type: 'status', message, percent });
}

async function getGhostscript() {
  if (!ghostscriptModulePromise) {
    ghostscriptModulePromise = createGhostscriptModule({
      noInitialRun: true,
      noExitRuntime: true,
      print: () => {},
      printErr: () => {}
    });
  }
  return ghostscriptModulePromise;
}

function buildArgs(config) {
  const args = [
    '-sDEVICE=pdfwrite',
    `-dCompatibilityLevel=${config.compatibility}`,
    `-dPDFSETTINGS=${config.preset}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH'
  ];

  if (config.compressImages) {
    args.push('-dDetectDuplicateImages=true');
    args.push('-dCompressFonts=true');
  }

  if (config.embedFonts) {
    args.push('-dSubsetFonts=true');
    args.push('-dEmbedAllFonts=true');
  }

  args.push('-sOutputFile=/output.pdf');
  args.push('/input.pdf');
  return args;
}

self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data?.bytes) return;

  try {
    postStatus('Inicializando Ghostscript...', 12);
    const mod = await getGhostscript();

    postStatus('Escribiendo PDF en memoria...', 25);

    try {
      mod.FS.unlink('/input.pdf');
    } catch {}
    try {
      mod.FS.unlink('/output.pdf');
    } catch {}

    mod.FS.writeFile('/input.pdf', new Uint8Array(data.bytes));

    const args = buildArgs(data);
    postStatus('Ejecutando Ghostscript...', 50);
    const exitCode = await mod.callMain(args);

    if (exitCode !== 0) {
      throw new Error(`Ghostscript terminó con código ${exitCode}.`);
    }

    postStatus('Leyendo resultado...', 92);
    const output = mod.FS.readFile('/output.pdf');
    self.postMessage({ type: 'result', bytes: output.buffer }, [output.buffer]);
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error?.message || 'Error desconocido en Ghostscript WASM.'
    });
  }
});

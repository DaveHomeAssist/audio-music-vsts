// Syrum desktop shell: serves the existing production build from an app-internal secure origin
// (app://syrum/) in one window. No server, no Node in the renderer, no network.
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
} = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DIST = path.join(__dirname, "..", "serum-wave-gen-vxx", "dist");
const ORIGIN = "app://syrum";
const MAX_SAVE_BYTES = 256 * 1024 * 1024;

// Standard + secure so AudioWorklet, module workers and Blob URLs behave as on HTTPS.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

function serve(request) {
  const { pathname } = new URL(request.url);
  const relative = decodeURIComponent(
    pathname === "/" ? "/index.html" : pathname,
  );
  const file = path.normalize(path.join(DIST, relative));
  if (file !== DIST && !file.startsWith(DIST + path.sep))
    return new Response("Not found", { status: 404 });
  return net.fetch(pathToFileURL(file).toString());
}

// Writes an export. SYRUM_SAVE_DIR (tests only) skips the dialog and writes there.
async function save(event, name, bytes) {
  if (typeof name !== "string" || !(bytes instanceof Uint8Array))
    throw new Error("Invalid export.");
  if (bytes.byteLength > MAX_SAVE_BYTES)
    throw new Error("Export is too large.");
  const base = path.basename(name);
  let target;
  if (process.env.SYRUM_SAVE_DIR) {
    target = path.join(process.env.SYRUM_SAVE_DIR, base);
  } else {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(win, {
      defaultPath: path.join(app.getPath("downloads"), base),
    });
    if (result.canceled || !result.filePath) return false;
    target = result.filePath;
  }
  await fs.writeFile(target, bytes);
  return true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 320,
    minHeight: 256,
    title: "Syrum",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.loadURL(`${ORIGIN}/`);
}

app.on("web-contents-created", (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
});

app.whenReady().then(() => {
  // Offline by design: refuse every network request.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
    (_, callback) => callback({ cancel: true }),
  );
  session.defaultSession.setPermissionRequestHandler((_, __, callback) =>
    callback(false),
  );
  protocol.handle("app", serve);
  ipcMain.handle("syrum:save", save);
  createWindow();
});

// Quitting ends all audio and processing; nothing keeps running in the background.
app.on("window-all-closed", () => app.quit());

import "./style.css";
import { readWav, writeWav, mono, MAX_FILE_BYTES } from "./wav";
import type { Wave } from "./wav";
import { bankFor, demo, FRAME, sample } from "./dsp";
import type { Analysis, Table } from "./dsp";
import voiceURL from "./voice.ts?worker&url";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing control ${id}`);
  return el as T;
};
const number = (id: string) => Number($<HTMLInputElement>(id).value);
const app = $("app");
app.innerHTML = `
<header><a class="brand" href="#import" aria-label="Syrum home"><span class="brand-icon">∿</span><span>SYRUM<small>SFT / WAVETABLE GENERATOR</small></span></a><div class="header-end"><span class="badge">Serum · unverified</span><button id="theme" class="quiet" aria-label="Switch to dark theme">Dark mode</button></div></header>
<div class="workspace">
<aside class="rail"><div class="rail-label">WORKSPACE <span>01</span></div><nav aria-label="Conversion steps" role="tablist" aria-orientation="vertical">
${["Import", "Analyze", "Generate", "Compare", "Explore", "Export"].map((x, i) => `<button role="tab" id="tab-${x.toLowerCase()}" aria-controls="panel-${x.toLowerCase()}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-step="${x.toLowerCase()}"><span class="step-number">0${i + 1}</span><span>${x}</span><span class="step-mark">${i === 0 ? "●" : "○"}</span></button>`).join("")}
</nav><div class="rail-foot"><span class="led"></span> LOCAL AUDIO ENGINE<small>Prototype · 0.1<br>Files stay on this device</small></div></aside>
<main>
<div class="context"><span id="source-name">UNTITLED SESSION</span><span id="source-meta">One-shot → wavetable</span></div>
<section id="panel-import" role="tabpanel" aria-labelledby="tab-import">
<div class="section-heading"><div><p class="eyebrow">01 / SOURCE</p><h1>A moment. Made playable.</h1><p class="subtitle">Start with an isolated, single-note WAV one-shot.</p></div><span class="pill">WAV ONLY</span></div>
<div class="import-grid"><div id="dropzone" class="dropzone"><div class="drop-symbol">↥</div><h2>Drop your one-shot here</h2><p>PCM 16 / 24 / 32 · Float32 · Mono or stereo</p><input type="file" id="file" accept=".wav,audio/wav" class="file-input" aria-label="Choose a WAV one-shot"><button id="choose" class="primary">Choose WAV <span>↗</span></button><button id="demo" class="quiet">Try the original synth demo</button><small>64 MiB memory limit · No one-second cutoff<br>Loops, songs and compressed audio are outside this prototype.</small></div>
<div class="trim-card"><div class="card-heading"><h2>Source selection</h2><span id="duration-label">—</span></div><canvas id="source-canvas" aria-label="Source waveform" role="img"></canvas><div class="field-row"><label>Start <span>seconds</span><input id="trim-start" type="number" min="0" step="0.001" value="0" disabled></label><label>End <span>seconds</span><input id="trim-end" type="number" min="0" step="0.001" value="0" disabled></label></div><label>Analysis channel<select id="channel" disabled><option value="mid">Mono sum (L + R) / 2</option><option value="left">Left</option><option value="right">Right</option></select></label><p class="hint">Stereo width is not retained. A/B uses this same channel selection.</p><button id="analyze" class="primary" disabled>Analyze selection <span>→</span></button></div></div>
</section>
<section id="panel-analyze" role="tabpanel" aria-labelledby="tab-analyze" hidden><div class="section-heading"><div><p class="eyebrow">02 / ANALYSIS</p><h1>Find the fundamental.</h1><p class="subtitle">A working pitch estimate, never a fidelity score.</p></div></div><div class="two-column"><div class="card"><p class="eyebrow">ESTIMATED ROOT</p><div id="pitch-readout" class="big-number">— <small>Hz</small></div><p id="pitch-detail" class="hint">Import and analyze a source first.</p><label>Root override <span>25–1000 Hz</span><input id="root" type="number" min="25" max="1000" step="0.01" value="55"></label><p class="hint">Confirm the octave. A fixed root cannot follow pitch bends or detuned layers.</p><button id="to-generate" class="primary" disabled>Set up frames <span>→</span></button></div><div class="card findings" tabindex="0" data-web2-scroll aria-label="Analysis notes"><h2>Analysis notes</h2><ul id="findings"><li>No source analyzed yet.</li></ul><p class="hint">Pitch search covers 25–1000 Hz. No automatic classification can guarantee that a file contains only one note.</p></div></div></section>
<section id="panel-generate" role="tabpanel" aria-labelledby="tab-generate" hidden><div class="section-heading"><div><p class="eyebrow">03 / RESYNTHESIS</p><h1>Capture the movement.</h1><p class="subtitle">Complete cycles sampled across the selected sound.</p></div><span class="pill">2048 SAMPLES / FRAME</span></div><div class="two-column"><div class="card"><h2>Direct cycle extraction</h2><label>Frame count <span>1–256</span><input id="frames" type="number" min="1" max="256" step="1" value="64"></label><label class="check"><input id="align" type="checkbox" checked> Align adjacent frame phases</label><p class="hint">Alignment improves interpolation but changes relative phase over time. Crossfaded loop points, DC removal and the source Nyquist ceiling also change the source.</p><button id="generate" class="primary" disabled>Generate wavetable <span>→</span></button><progress id="progress" max="100" value="0" aria-label="Generation progress" hidden></progress></div><div class="card"><p class="eyebrow">WHAT SURVIVES?</p><h2>Periodic character.<br>Not a perfect copy.</h2><p>We retain sampled harmonic amplitudes and phase relationships as far as this baseline allows. One table-wide gain preserves relative frame levels.</p><p class="hint">Noise, attacks, stereo effects and overlapping notes may become repeating artifacts or disappear. The hand-designed lab model is not used to claim reconstruction.</p></div></div></section>
<section id="panel-compare" role="tabpanel" aria-labelledby="tab-compare" hidden><div class="section-heading"><div><p class="eyebrow">04 / REFERENCE PLAYBACK</p><h1>Listen to what changed.</h1><p class="subtitle">Both auditions restart at zero and use the selected source duration.</p></div></div><div class="compare-visual"><canvas id="table-canvas" aria-label="Generated wavetable frames" role="img"></canvas><div class="visual-caption"><span id="table-meta">No table generated</span><span>FRAME EVOLUTION →</span></div></div><div class="compare-controls"><button id="play-a" disabled><span class="key">A</span> Source</button><button id="play-b" disabled><span class="key">B</span> Resynthesis</button><button id="stop-compare">■ Stop</button><label>B playback<select id="assist"><option value="raw">Raw table</option><option value="envelope">Envelope-assisted</option></select></label></div><p class="hint">A: selected mono source, original pitch. B: chosen root, fixed pitch. Shared −12 dB monitoring; no hidden loudness matching. B uses 5 ms endpoint fades. Envelope assistance is capped at 4× and is not embedded in the WAV.</p><button id="to-explore" class="primary" disabled>Freeze, scrub & stretch <span>→</span></button></section>
<section id="panel-explore" role="tabpanel" aria-labelledby="tab-explore" hidden><div class="section-heading"><div><p class="eyebrow">05 / PLAYABLE TIMBRE</p><h1>Hold the moment.</h1><p class="subtitle">Move through the sound without changing its pitch.</p></div></div><div class="explore-grid"><div class="card scope-card"><canvas id="frame-canvas" aria-label="Current interpolated waveform" role="img"></canvas><div class="position-label"><span>WAVETABLE POSITION</span><output id="position-readout">0.0%</output></div><input id="position" type="range" min="0" max="1" step="0.001" value="0" aria-label="Wavetable position"><div class="transport"><button id="hold" class="primary" disabled>▶ Hold</button><button id="scan" disabled>↗ Scan</button><button id="stop-explore">■ Stop</button></div><p class="hint">Scrubbing switches to hold. 12 ms smoothing. Scan stops moving at the final frame and keeps sustaining until Stop.</p></div><div class="card timing"><div class="field-row"><label>Audition pitch <span>Hz</span><input id="pitch" type="number" min="25" max="1000" step="0.01" value="55"></label><label>Scan duration <span>seconds</span><input id="seconds" type="number" min="0.02" max="120" step="0.01" value="1.5"></label></div><button id="original" class="quiet">Use source duration</button><details><summary>Optional tempo sync</summary><div class="field-row"><label>BPM<input id="bpm" type="number" min="20" max="400" value="120"></label><label>Beats<input id="beats" type="number" min="0.0625" max="64" step="0.25" value="1"></label></div><button id="tempo">Apply timing</button></details><p class="hint">Pitch changes restart playback. Scan timing remains independent. Explore uses raw tables; preview band-limiting reduces aliasing.</p><button id="to-export" class="primary" disabled>Prepare export <span>→</span></button></div></div></section>
<section id="panel-export" role="tabpanel" aria-labelledby="tab-export" hidden><div class="section-heading"><div><p class="eyebrow">06 / HANDOFF</p><h1>Take it into Serum.</h1><p class="subtitle">Export a candidate table, then verify it in the synthesizer.</p></div></div><div class="two-column"><div class="card"><span class="badge">Serum compatibility · unverified</span><h2>Custom wavetable WAV</h2><p id="export-spec">Generate a table to see its export format.</p><div class="export-buttons"><button id="export-wav" class="primary" disabled>↓ Download WAV</button><button id="export-notes" disabled>↓ Playback notes</button></div><p class="hint">Float32 mono · 44.1 kHz container · 2048 samples/frame · linear metadata · factory flag off. Container sample rate does not set oscillator pitch or scan time.</p></div><div class="card guidance" tabindex="0" data-web2-scroll aria-label="Serum verification guidance"><h2>Verification checklist</h2><ol><li>Use a wavetable oscillator in an initialized Serum preset. Check the expected frame count; avoid importing as a sample or detecting pitch again.</li><li>Start with one voice, warp and effects off, random phase off. Use the root and timing in the downloaded notes.</li><li>Compare a forward scan at the original duration. Test holds and both scrub directions, then save and reopen the preset.</li><li>Record the exact Serum version, OS, settings and rendered result. Compare with Connor’s matching original wavetable and lossless audio.</li></ol><p class="hint">These are proposed test steps, not a verified version-specific import procedure. Noise, residual layers and an amplitude envelope are not stored in this table.</p></div></div></section>
</main><aside class="wide-panel"><p class="eyebrow">SESSION INTENT</p><h2>Sound into<br>instrument.</h2><p>Import one note. Capture its changing cycles. Hold any moment.</p><hr><p>Serum verification remains open until matching tables, audio and settings are available.</p></aside>
</div><footer><div id="status" role="status" aria-live="polite">Ready · Choose a WAV or try the demo.</div><button id="cancel" class="quiet" hidden>Cancel</button><button id="stop-all" class="quiet" aria-label="Stop all audio">■</button><span class="footer-note">LOCAL PROCESSING / NO UPLOADS</span></footer>`;
let wave: Wave | undefined,
  source: Float32Array | undefined,
  table: Table | undefined,
  analysis: Analysis | undefined;
let sourceName = "",
  active = "import",
  busy = false,
  serial = 0;
let worker = new Worker(new URL("./worker.ts", import.meta.url), {
  type: "module",
});
let pending:
  | {
      id: number;
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
    }
  | undefined;
let audio: AudioContext | undefined,
  workletReady = false,
  player: AudioBufferSourceNode | undefined,
  voice: AudioWorkletNode | undefined,
  gain: GainNode | undefined;
let animation = 0,
  scanStart = 0,
  scanDuration = 0,
  playbackToken = 0;
function status(message: string, error = false): void {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}
function updateButtons(): void {
  for (const id of ["analyze"])
    $<HTMLButtonElement>(id).disabled = !source || busy;
  for (const id of ["to-generate", "generate"])
    $<HTMLButtonElement>(id).disabled = !analysis || busy;
  for (const id of [
    "play-a",
    "play-b",
    "to-explore",
    "hold",
    "scan",
    "to-export",
    "export-wav",
    "export-notes",
  ])
    $<HTMLButtonElement>(id).disabled = !table || busy;
  for (const id of [
    "choose",
    "demo",
    "trim-start",
    "trim-end",
    "channel",
    "root",
    "frames",
    "align",
  ]) {
    const control = $<HTMLInputElement>(id);
    control.disabled =
      busy || (["trim-start", "trim-end", "channel"].includes(id) && !wave);
  }
  $("cancel").hidden = !busy;
}
function bindWorker(): void {
  worker.onmessage = (
    event: MessageEvent<{
      id: number;
      progress?: number;
      value?: unknown;
      error?: string;
    }>,
  ) => {
    const x = event.data;
    if (x.id !== pending?.id) return;
    if (x.progress !== undefined) {
      $<HTMLProgressElement>("progress").value = x.progress;
      return;
    }
    const p = pending;
    pending = undefined;
    if (x.error) p.reject(new Error(x.error));
    else p.resolve(x.value);
  };
  worker.onerror = () => {
    pending?.reject(new Error("Audio worker failed. Retry the operation."));
    pending = undefined;
  };
}
bindWorker();
async function task<T>(request: object): Promise<T> {
  if (pending) throw new Error("Another audio operation is running.");
  busy = true;
  updateButtons();
  try {
    return await new Promise<T>((resolve, reject) => {
      pending = {
        id: ++serial,
        resolve: (value) => resolve(value as T),
        reject,
      };
      worker.postMessage({ ...request, id: serial });
    });
  } finally {
    busy = false;
    $("progress").hidden = true;
    updateButtons();
  }
}
$("cancel").onclick = () => {
  worker.terminate();
  pending?.reject(new Error("Operation cancelled. Your source is unchanged."));
  pending = undefined;
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  bindWorker();
};
function step(name: string): void {
  active = name;
  document.querySelectorAll<HTMLButtonElement>("[role=tab]").forEach((el) => {
    const on = el.dataset.step === name;
    el.setAttribute("aria-selected", String(on));
    el.tabIndex = on ? 0 : -1;
    const mark = el.querySelector(".step-mark");
    if (mark) mark.textContent = on ? "●" : "○";
    $(`panel-${el.dataset.step}`).hidden = !on;
  });
  history.replaceState(null, "", `#${name}`);
  draw();
}
const tabs = [...document.querySelectorAll<HTMLButtonElement>("[role=tab]")];
for (const [index, tab] of tabs.entries()) {
  tab.onclick = () => step(tab.dataset.step!);
  tab.onkeydown = (e) => {
    let next: number | undefined;
    if (["ArrowRight", "ArrowDown"].includes(e.key))
      next = (index + 1) % tabs.length;
    if (["ArrowLeft", "ArrowUp"].includes(e.key))
      next = (index + tabs.length - 1) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next !== undefined) {
      e.preventDefault();
      tabs[next]!.focus();
      step(tabs[next]!.dataset.step!);
    }
  };
}
function stop(): void {
  playbackToken++;
  cancelAnimationFrame(animation);
  scanStart = 0;
  if (player) {
    player.onended = null;
    player.stop();
    player.disconnect();
    player = undefined;
  }
  if (voice) {
    const old = voice;
    old.port.postMessage({ stop: true });
    setTimeout(() => old.disconnect(), 80);
    voice = undefined;
  }
  $("hold").textContent = "▶ Hold";
  $("scan").textContent = "↗ Scan";
}
async function context(): Promise<AudioContext> {
  if (!audio) {
    audio = new AudioContext();
    gain = audio.createGain();
    gain.gain.value = Math.pow(10, -12 / 20);
    gain.connect(audio.destination);
  }
  await audio.resume();
  return audio;
}
function invalidate(): void {
  stop();
  table = undefined;
  $("table-meta").textContent = "No table generated";
  $("export-spec").textContent = "Generate a table to see its export format.";
  updateButtons();
  draw();
}
function selection(): void {
  if (!wave) return;
  invalidate();
  analysis = undefined;
  $("pitch-readout").innerHTML = "— <small>Hz</small>";
  $("pitch-detail").textContent = "Analyze the updated source selection.";
  const all = mono(wave, $<HTMLSelectElement>("channel").value),
    start = number("trim-start"),
    end = number("trim-end");
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end > all.length / wave.sampleRate + 0.000001 ||
    end <= start
  ) {
    source = undefined;
    updateButtons();
    throw new Error(
      "Trim must start at or after zero and end within the file, after the start.",
    );
  }
  source = all.slice(
    Math.round(start * wave.sampleRate),
    Math.min(all.length, Math.round(end * wave.sampleRate)),
  );
  $("duration-label").textContent =
    `${(source.length / wave.sampleRate).toFixed(3)} s selected`;
  updateButtons();
  draw();
}
function load(data: Wave, name: string): void {
  wave = data;
  sourceName = name;
  $("source-name").textContent = name;
  $("source-meta").textContent =
    `${data.sampleRate / 1000} kHz · ${data.bits}-bit ${data.encoding} · ${data.channels.length === 1 ? "mono" : "stereo"}`;
  $<HTMLInputElement>("trim-start").value = "0";
  $<HTMLInputElement>("trim-end").value = String(
    data.channels[0]!.length / data.sampleRate,
  );
  $<HTMLSelectElement>("channel").value = "mid";
  selection();
  step("import");
  status("Source loaded. Adjust the trim, then analyze.");
}
async function loadFile(file: File): Promise<void> {
  if (busy) return;
  try {
    if (file.size > MAX_FILE_BYTES)
      throw new Error(
        "Prototype memory limit: choose a WAV smaller than 64 MiB.",
      );
    if (!file.name.toLowerCase().endsWith(".wav"))
      throw new Error(
        "Choose a lossless WAV one-shot. AAC/MP3 references belong in the lab, not this import path.",
      );
    const data = await file.arrayBuffer();
    load(readWav(data), file.name);
  } catch (e) {
    status(message(e), true);
  }
}
function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}
function action(id: string, fn: () => void | Promise<void>): void {
  $(id).onclick = () => {
    Promise.resolve()
      .then(fn)
      .catch((e) => status(message(e), true));
  };
}
action("choose", () => $<HTMLInputElement>("file").click());
$<HTMLInputElement>("file").onchange = (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void loadFile(file);
  input.value = "";
};
$("dropzone").ondragover = (e) => {
  e.preventDefault();
  $("dropzone").classList.add("drag");
};
$("dropzone").ondragleave = () => $("dropzone").classList.remove("drag");
$("dropzone").ondrop = (e) => {
  e.preventDefault();
  $("dropzone").classList.remove("drag");
  const file = e.dataTransfer?.files[0];
  if (file) void loadFile(file);
};
action("demo", () =>
  load(
    { channels: [demo()], sampleRate: 44100, bits: 32, encoding: "float" },
    "Original evolving bass · 55 Hz",
  ),
);
for (const id of ["trim-start", "trim-end", "channel"])
  $(id).onchange = () => {
    try {
      selection();
      status("Selection changed. Analyze again.");
    } catch (e) {
      status(message(e), true);
    }
  };
action("analyze", async () => {
  if (!source || !wave) return;
  stop();
  status("Analyzing pitch and source levels…");
  analysis = await task<Analysis>({
    kind: "analyze",
    source,
    sr: wave.sampleRate,
  });
  $<HTMLInputElement>("root").value = analysis.hz.toFixed(2);
  $<HTMLInputElement>("pitch").value = analysis.hz.toFixed(2);
  $("pitch-readout").innerHTML = `${analysis.hz.toFixed(2)} <small>Hz</small>`;
  const midi = 69 + 12 * Math.log2(analysis.hz / 440);
  $("pitch-detail").textContent =
    `MIDI ${Math.round(midi)} · ${Math.round((midi - Math.round(midi)) * 100)} cents · ${(20 * Math.log10(analysis.rms)).toFixed(1)} dBFS RMS`;
  $("findings").replaceChildren(
    ...analysis.warnings.map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }),
  );
  updateButtons();
  step("analyze");
  status("Analysis complete. Confirm the root before generating.");
});
action("to-generate", () => step("generate"));
for (const id of ["root", "frames", "align"])
  $(id).onchange = () => {
    invalidate();
    status("Generation settings changed. Generate a new table.");
  };
action("generate", async () => {
  if (!source || !wave || !analysis) return;
  stop();
  $("progress").hidden = false;
  $<HTMLProgressElement>("progress").value = 0;
  status("Generating complete cycles and preview banks…");
  table = await task<Table>({
    kind: "generate",
    source,
    sr: wave.sampleRate,
    root: number("root"),
    count: number("frames"),
    aligned: $<HTMLInputElement>("align").checked,
  });
  $<HTMLInputElement>("pitch").value = String(table.root);
  $<HTMLInputElement>("seconds").value = String(table.duration);
  $("table-meta").textContent =
    `${table.count} frames × 2048 samples · ${table.duration.toFixed(3)} s source`;
  $("export-spec").textContent =
    `${table.count} frames × 2048 samples · ${table.root.toFixed(2)} Hz reference root`;
  updateButtons();
  step("compare");
  status(
    "Table generated. Offline preview ready; Serum compatibility remains unverified.",
  );
});
async function playCompare(which: "a" | "b"): Promise<void> {
  if (!table || !source || !wave) return;
  stop();
  const token = playbackToken,
    ctx = await context();
  const data =
    which === "a"
      ? source
      : await task<Float32Array>({
          kind: "render",
          table,
          sr: wave.sampleRate,
          hz: table.root,
          seconds: table.duration,
          assisted: $<HTMLSelectElement>("assist").value === "envelope",
        });
  if (token !== playbackToken) return;
  const buffer = ctx.createBuffer(1, data.length, wave.sampleRate);
  buffer.copyToChannel(new Float32Array(data), 0);
  player = ctx.createBufferSource();
  player.buffer = buffer;
  player.connect(gain!);
  player.onended = () => status("Audition complete.");
  player.start();
  status(
    `Playing ${which === "a" ? "A · source" : `B · ${$<HTMLSelectElement>("assist").value}`} at original duration. Shared −12 dB monitor.`,
  );
}
action("play-a", () => playCompare("a"));
action("play-b", () => playCompare("b"));
for (const id of ["stop-compare", "stop-explore", "stop-all"])
  action(id, () => {
    stop();
    status("Playback stopped.");
  });
action("to-explore", () => step("explore"));
action("to-export", () => step("export"));
async function startVoice(scan: boolean): Promise<void> {
  if (!table) return;
  stop();
  const token = playbackToken,
    hz = number("pitch"),
    seconds = number("seconds");
  if (
    !Number.isFinite(hz) ||
    hz < 25 ||
    hz > 1000 ||
    !Number.isFinite(seconds) ||
    seconds < 0.02 ||
    seconds > 120
  )
    throw new Error("Use pitch 25–1000 Hz and scan duration 0.02–120 seconds.");
  const ctx = await context();
  if (!ctx.audioWorklet)
    throw new Error(
      "Live hold needs AudioWorklet on localhost or HTTPS in a supported browser.",
    );
  if (!workletReady) {
    await ctx.audioWorklet.addModule(voiceURL);
    workletReady = true;
  }
  if (token !== playbackToken) return;
  if (scan) $<HTMLInputElement>("position").value = "0";
  voice = new AudioWorkletNode(ctx, "syrum-voice", { outputChannelCount: [1] });
  voice.connect(gain!);
  voice.port.postMessage({
    bank: bankFor(table, hz, ctx.sampleRate),
    count: table.count,
    hz,
    position: number("position"),
  });
  $("hold").textContent = "● Holding";
  if (scan) {
    scanStart = ctx.currentTime;
    scanDuration = seconds;
    $("scan").textContent = "● Scanning";
    tick();
  }
  status(
    scan
      ? `Scanning in ${seconds.toFixed(3)} s at ${hz.toFixed(2)} Hz. Final frame will hold.`
      : "Holding a periodic frame. Drag position to scrub in either direction.",
  );
  draw();
}
function tick(): void {
  if (!audio || !table || !voice) return;
  const fraction = Math.min(1, (audio.currentTime - scanStart) / scanDuration);
  const time = fraction * table.duration,
    position = Math.max(
      0,
      Math.min(1, (time - table.first) / (table.last - table.first)),
    );
  $<HTMLInputElement>("position").value = String(position);
  voice.port.postMessage({ position });
  draw();
  if (fraction < 1) animation = requestAnimationFrame(tick);
  else {
    $("scan").textContent = "↗ Scan";
    status("Scan complete. Holding the final frame until Stop.");
  }
}
action("hold", () => startVoice(false));
action("scan", () => startVoice(true));
$("position").oninput = () => {
  cancelAnimationFrame(animation);
  voice?.port.postMessage({ position: number("position") });
  $("scan").textContent = "↗ Scan";
  draw();
};
$("pitch").onchange = () => {
  if (voice) void startVoice(false).catch((e) => status(message(e), true));
};
action("original", () => {
  if (table) {
    $<HTMLInputElement>("seconds").value = String(table.duration);
    status("Scan duration restored to the selected source duration.");
  }
});
action("tempo", () => {
  const bpm = number("bpm"),
    beats = number("beats"),
    seconds = (60 / bpm) * beats;
  if (
    !Number.isFinite(seconds) ||
    bpm < 20 ||
    bpm > 400 ||
    beats < 0.0625 ||
    beats > 64 ||
    seconds < 0.02 ||
    seconds > 120
  )
    throw new Error("Tempo timing must fit 0.02–120 seconds (BPM 20–400).");
  $<HTMLInputElement>("seconds").value = String(seconds);
  status(`Tempo timing applied: ${seconds.toFixed(3)} s. Pitch unchanged.`);
});
declare global {
  interface Window {
    // Present only in the desktop app (apps/syrum-desktop); resolves false when cancelled.
    syrumDesktop?: { save(name: string, bytes: Uint8Array): Promise<boolean> };
  }
}
async function download(
  data: BlobPart,
  type: string,
  name: string,
): Promise<boolean> {
  if (window.syrumDesktop)
    return window.syrumDesktop.save(
      name,
      new Uint8Array(await new Blob([data], { type }).arrayBuffer()),
    );
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
action("export-wav", async () => {
  if (!table) return;
  const saved = await download(
    writeWav(table.samples, 44100, true),
    "audio/wav",
    `Syrum_${table.count}x2048.wav`,
  );
  if (!saved) return status("Export cancelled. Nothing was saved.");
  status(
    "WAV downloaded. Serum compatibility remains unverified. Download the playback notes too.",
  );
});
action("export-notes", async () => {
  if (!table) return;
  const midi = 69 + 12 * Math.log2(table.root / 440);
  const notes = `SFT | Syrum Wavetable Generator — prototype 0.1\nSerum compatibility: UNVERIFIED\n\nSource: ${sourceName}\nSource sample rate: ${wave?.sampleRate} Hz\nTrim: ${number("trim-start")}–${number("trim-end")} s\nChannel: ${$<HTMLSelectElement>("channel").value}\nFrames: ${table.count} × 2048\nEncoding: mono IEEE float32 WAV, 44100 Hz container\nclm metadata: <!>2048 10000000 (linear, custom; factory flag off)\nRoot: ${table.root} Hz / MIDI ${Math.round(midi)} ${((midi - Math.round(midi)) * 100).toFixed(1)} cents\nOriginal scan duration: ${table.duration} s\nHold first frame until ${table.first} s, scan linearly to final frame at ${table.last} s, hold until ${table.duration} s. One-frame tables hold throughout.\nExplore duration: ${number("seconds")} s; pitch: ${number("pitch")} Hz\nPhase alignment: ${table.aligned ? "relative circular alignment" : "off"}\nAlgorithm: fixed-root one-cycle extraction, crossfaded loop point, DC removal, harmonics up to source Nyquist (max 1023), one global peak gain. Preview uses pitch-dependent harmonic banks and linear interpolation.\n\nA/B: A is selected mono source at original pitch; B uses fixed root at original duration. B mode selected: ${$<HTMLSelectElement>("assist").value}. Shared -12 dB monitoring, no loudness matching. B has 5 ms endpoint fades. Envelope-assisted mode uses smoothed source RMS, gain capped at 4x. No source envelope is embedded in the table. Explore uses raw table.\n\nSerum test: use a wavetable oscillator, check frame count, one voice, warp/effects/random phase off. Set root and scan as above; recreate envelope separately. Record version, OS, phase settings and render. Test holds, bidirectional scrubbing and save/reopen of a preset. Need Connor's matching original table and lossless audio with settings before compatibility or fidelity acceptance.\n\nLimitations: fixed pitch does not follow source drift. Stereo width, noise, transients, inharmonic components and overlapping notes are not faithfully preserved. Alignment and boundary repair alter phase. No original preset recovery. Offline success is not Serum verification.\n`;
  if (!(await download(notes, "text/plain", "Syrum playback notes.txt")))
    return status("Export cancelled. Nothing was saved.");
  status("Playback notes downloaded. Verification remains open.");
});
function canvas(
  id: string,
): { ctx: CanvasRenderingContext2D; w: number; h: number } | undefined {
  const el = $<HTMLCanvasElement>(id),
    bounds = el.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return undefined;
  const scale = window.devicePixelRatio || 1;
  el.width = Math.round(bounds.width * scale);
  el.height = Math.round(bounds.height * scale);
  const ctx = el.getContext("2d");
  if (!ctx) return undefined;
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, bounds.width, bounds.height);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue(
    "--line",
  );
  ctx.lineWidth = 1;
  for (let x = 0; x < bounds.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, bounds.height);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, bounds.height / 2);
  ctx.lineTo(bounds.width, bounds.height / 2);
  ctx.stroke();
  return { ctx, w: bounds.width, h: bounds.height };
}
function draw(): void {
  const color = getComputedStyle(document.documentElement).getPropertyValue(
    "--accent",
  );
  if (active === "import") {
    const c = canvas("source-canvas");
    if (c && source) {
      c.ctx.strokeStyle = color;
      c.ctx.beginPath();
      for (let x = 0; x < c.w; x++) {
        let lo = 0,
          hi = 0;
        const a = Math.floor((x / c.w) * source.length),
          b = Math.max(a + 1, Math.floor(((x + 1) / c.w) * source.length));
        for (let j = a; j < b; j++) {
          lo = Math.min(lo, source[j] ?? 0);
          hi = Math.max(hi, source[j] ?? 0);
        }
        c.ctx.moveTo(x, c.h / 2 - lo * c.h * 0.4);
        c.ctx.lineTo(x, c.h / 2 - hi * c.h * 0.4);
      }
      c.ctx.stroke();
    }
  }
  if (active === "compare") {
    const c = canvas("table-canvas");
    if (c && table) {
      const rows = Math.min(16, table.count);
      for (let row = rows - 1; row >= 0; row--) {
        const f = Math.round((row / Math.max(1, rows - 1)) * (table.count - 1));
        c.ctx.strokeStyle = color;
        c.ctx.globalAlpha = 1 - (row / Math.max(1, rows)) * 0.6;
        c.ctx.beginPath();
        for (let x = 0; x < c.w - 60; x++) {
          const y =
            table.samples[
              f * FRAME + Math.floor((x / (c.w - 60)) * (FRAME - 1))
            ]!;
          const px = x + (row / Math.max(1, rows)) * 55,
            py =
              c.h * 0.68 -
              (row / Math.max(1, rows)) * c.h * 0.45 -
              y * c.h * 0.18;
          if (x === 0) c.ctx.moveTo(px, py);
          else c.ctx.lineTo(px, py);
        }
        c.ctx.stroke();
      }
      c.ctx.globalAlpha = 1;
    }
  }
  if (active === "explore") {
    const pos = number("position");
    $("position-readout").textContent = `${(pos * 100).toFixed(1)}%`;
    const c = canvas("frame-canvas");
    if (c && table) {
      c.ctx.strokeStyle = color;
      c.ctx.lineWidth = 2;
      c.ctx.beginPath();
      const f = pos * (table.count - 1),
        lo = Math.floor(f),
        hi = Math.min(table.count - 1, lo + 1);
      for (let x = 0; x < c.w; x++) {
        const p = (x / c.w) * (FRAME - 1),
          a = sample(table.samples.subarray(lo * FRAME, (lo + 1) * FRAME), p),
          b = sample(table.samples.subarray(hi * FRAME, (hi + 1) * FRAME), p),
          y = c.h / 2 - (a + (b - a) * (f - lo)) * c.h * 0.4;
        if (x === 0) c.ctx.moveTo(x, y);
        else c.ctx.lineTo(x, y);
      }
      c.ctx.stroke();
    }
  }
}
function setTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
  $("theme").textContent = theme === "dark" ? "Light mode" : "Dark mode";
  $("theme").setAttribute(
    "aria-label",
    `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
  );
  draw();
}
try {
  setTheme(localStorage.getItem("syrum-theme") === "dark" ? "dark" : "light");
} catch {
  setTheme("light");
}
action("theme", () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(theme);
  try {
    localStorage.setItem("syrum-theme", theme);
  } catch {
    /* A blocked store does not prevent using either theme. */
  }
});
window.addEventListener("resize", draw);
window.addEventListener("pagehide", stop);
if (tabs.some((tab) => tab.dataset.step === location.hash.slice(1)))
  step(location.hash.slice(1));
updateButtons();
draw();
// Two compact subpages preserve all controls at extreme zoom without page scrolling.
for (const name of ["import", "analyze", "generate", "explore", "export"]) {
  const panel = $(`panel-${name}`),
    grid = panel.querySelector(".import-grid,.two-column,.explore-grid");
  if (!grid) continue;
  const children = [...grid.children] as HTMLElement[];
  const pager = document.createElement("div");
  pager.className = "compact-pager";
  const previous = document.createElement("button"),
    next = document.createElement("button");
  previous.textContent = "1";
  next.textContent = "2";
  previous.setAttribute("aria-label", `${name} controls page 1`);
  next.setAttribute("aria-label", `${name} controls page 2`);
  let index = 0;
  const media = matchMedia("(max-width:480px) and (max-height:450px)");
  const update = () => {
    children.forEach((child, i) =>
      child.classList.toggle("compact-hide", media.matches && i !== index),
    );
    previous.setAttribute("aria-pressed", String(index === 0));
    next.setAttribute("aria-pressed", String(index === 1));
    draw();
  };
  previous.onclick = () => {
    index = 0;
    update();
  };
  next.onclick = () => {
    index = 1;
    update();
  };
  media.addEventListener("change", update);
  pager.append(previous, next);
  panel.querySelector(".section-heading")?.append(pager);
  update();
}
window.addEventListener("hashchange", () => {
  const name = location.hash.slice(1);
  if (tabs.some((tab) => tab.dataset.step === name)) step(name);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    stop();
    status("Playback stopped.");
  }
});

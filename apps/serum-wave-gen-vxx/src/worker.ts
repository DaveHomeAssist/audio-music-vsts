import { analyze, generate, render } from "./dsp";
import type { Table } from "./dsp";
type Request =
  | { id: number; kind: "analyze"; source: Float32Array; sr: number }
  | {
      id: number;
      kind: "generate";
      source: Float32Array;
      sr: number;
      root: number;
      count: number;
      aligned: boolean;
    }
  | {
      id: number;
      kind: "render";
      table: Table;
      sr: number;
      hz: number;
      seconds: number;
      assisted: boolean;
    };
self.onmessage = (event: MessageEvent<Request>) => {
  const r = event.data;
  try {
    const value =
      r.kind === "analyze"
        ? analyze(r.source, r.sr)
        : r.kind === "generate"
          ? generate(r.source, r.sr, r.root, r.count, r.aligned, (progress) =>
              self.postMessage({ id: r.id, progress }),
            )
          : render(r.table, r.sr, r.hz, r.seconds, r.assisted);
    self.postMessage({ id: r.id, value });
  } catch (error) {
    self.postMessage({
      id: r.id,
      error:
        error instanceof Error ? error.message : "Audio processing failed.",
    });
  }
};

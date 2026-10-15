import { oscillator } from "./dsp";
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(
  name: string,
  processor: typeof AudioWorkletProcessor,
): void;
class SyrumVoice extends AudioWorkletProcessor {
  bank: Float32Array = new Float32Array(0);
  count = 1;
  hz = 55;
  phase = 0;
  position = 0;
  target = 0;
  gain = 0;
  active = true;
  constructor() {
    super();
    this.port.onmessage = (
      event: MessageEvent<{
        bank?: Float32Array;
        count?: number;
        hz?: number;
        position?: number;
        stop?: boolean;
      }>,
    ) => {
      const x = event.data;
      if (x.bank) {
        this.bank = x.bank;
        this.count = x.count ?? 1;
        this.hz = x.hz ?? 55;
        this.position = x.position ?? 0;
        this.target = this.position;
      }
      if (x.position !== undefined)
        this.target = Math.max(0, Math.min(1, x.position));
      if (x.stop) this.active = false;
    };
  }
  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]?.[0];
    if (!out) return true;
    for (let i = 0; i < out.length; i++) {
      this.position +=
        (this.target - this.position) *
        (1 - Math.exp(-1 / (sampleRate * 0.012)));
      this.gain +=
        ((this.active ? 1 : 0) - this.gain) *
        (1 - Math.exp(-1 / (sampleRate * 0.005)));
      out[i] = this.bank.length
        ? oscillator(this.bank, this.count, this.position, this.phase) *
          this.gain
        : 0;
      this.phase = (this.phase + this.hz / sampleRate) % 1;
    }
    return this.active || this.gain > 0.00001;
  }
}
registerProcessor("syrum-voice", SyrumVoice);

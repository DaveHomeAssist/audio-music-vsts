#!/usr/bin/env python3
"""Inspect Serum `clm ` metadata and build probe tables for the frame-count question.

Standard library only.

  python3 tools/clm_probe_tables.py inspect FILE.wav [...]
      Print format, 2048-sample frame count and the `clm ` text of each WAV.

  python3 tools/clm_probe_tables.py probes [TABLE.wav] [--out DIR] [--frames N]
      From a 2048-sample table (default: fixtures/syrum-demo/Syrum_64x2048.wav), write
      N evenly spaced frames (default 8) with the interpolation digit set to 0, 1 and 2,
      one flag-0 copy in Serum's own chunk layout (JUNK, fmt, clm, data), and full-length
      copies of the table with flags 0 and 2. Default output: work/clm-probes (gitignored).

Loading the probes in Serum and reading the frame box at full WT POS tests whether the
first digit of `<!>2048 X0000000` changes the reported frame count.
"""

import argparse
import os
import struct
import sys

FRAME = 2048
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TABLE = os.path.join(ROOT, "fixtures", "syrum-demo", "Syrum_64x2048.wav")


def chunks(data):
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("not a RIFF/WAVE file")
    p = 12
    while p + 8 <= len(data):
        cid = data[p : p + 4]
        size = struct.unpack("<I", data[p + 4 : p + 8])[0]
        yield cid, data[p + 8 : p + 8 + size]
        p += 8 + size + (size & 1)


def read(path):
    with open(path, "rb") as f:
        data = f.read()
    info = {"chunks": [], "clm": None, "fmt": None, "data": b""}
    for cid, body in chunks(data):
        info["chunks"].append(cid.decode("latin1"))
        if cid == b"fmt ":
            info["fmt"] = struct.unpack("<HHIIHH", body[:16])
        elif cid == b"clm ":
            info["clm"] = body.decode("latin1", "replace").rstrip("\x00")
        elif cid == b"data":
            info["data"] = body
    return info


def inspect(paths):
    for path in paths:
        try:
            info = read(path)
        except (OSError, ValueError) as e:
            print(f"{path}: {e}")
            continue
        fmt = info["fmt"]
        if not fmt:
            print(f"{path}: no fmt chunk")
            continue
        encoding, channels, rate, _, align, bits = fmt
        samples = len(info["data"]) // align if align else 0
        kind = {1: "PCM", 3: "float"}.get(encoding, f"format {encoding}")
        print(
            f"{os.path.basename(path)}: {kind} {bits}-bit {channels}ch {rate} Hz, "
            f"{samples} samples = {samples / FRAME:g} frames of {FRAME}; "
            f"chunks {' '.join(info['chunks'])}; clm {info['clm']!r}"
        )


def wav(frames, clm_text, serum_layout):
    n = len(frames) // 4
    fmt = b"fmt " + struct.pack("<IHHIIHH", 16, 3, 1, 44100, 44100 * 4, 4, 32)
    meta = clm_text.encode("latin1")
    clm = b"clm " + struct.pack("<I", len(meta)) + meta + (b"\x00" if len(meta) & 1 else b"")
    if serum_layout:
        head = b"JUNK" + struct.pack("<I", 28) + bytes(28) + fmt + clm
    else:
        head = fmt + b"fact" + struct.pack("<II", 4, n) + clm
    body = head + b"data" + struct.pack("<I", len(frames)) + frames
    return b"RIFF" + struct.pack("<I", 4 + len(body)) + b"WAVE" + body


def probes(table, out, count):
    info = read(table)
    if not info["fmt"] or info["fmt"][0] != 3 or info["fmt"][5] != 32 or info["fmt"][1] != 1:
        sys.exit("Probe source must be a mono float32 table.")
    data = info["data"]
    total = len(data) // (FRAME * 4)
    if total < 1 or len(data) % (FRAME * 4):
        sys.exit("Probe source is not a whole number of 2048-sample frames.")
    count = max(1, min(count, total))
    picks = [round(i * (total - 1) / max(1, count - 1)) for i in range(count)]
    subset = b"".join(data[i * FRAME * 4 : (i + 1) * FRAME * 4] for i in picks)
    os.makedirs(out, exist_ok=True)
    stem = f"{count}x{FRAME}"
    files = {
        f"Probe_flag0_{stem}.wav": wav(subset, "<!>2048 00000000 Syrum probe", False),
        f"Probe_flag1_{stem}.wav": wav(subset, "<!>2048 10000000 Syrum probe", False),
        f"Probe_flag2_{stem}.wav": wav(subset, "<!>2048 20000000 Syrum probe", False),
        f"Probe_flag0_serumlayout_{stem}.wav": wav(
            subset, "<!>2048 00000000 wavetable (www.xferrecords.com)", True
        ),
        f"Table_flag0_{total}x{FRAME}.wav": wav(data, "<!>2048 00000000 Syrum prototype", False),
        f"Table_flag2_{total}x{FRAME}.wav": wav(data, "<!>2048 20000000 Syrum prototype", False),
    }
    for name, content in files.items():
        with open(os.path.join(out, name), "wb") as f:
            f.write(content)
    print(f"Source: {total} frames; probe frames {picks}; wrote {len(files)} files to {out}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    a = sub.add_parser("inspect")
    a.add_argument("files", nargs="+")
    b = sub.add_parser("probes")
    b.add_argument("table", nargs="?", default=DEFAULT_TABLE)
    b.add_argument("--out", default=os.path.join(ROOT, "work", "clm-probes"))
    b.add_argument("--frames", type=int, default=8)
    args = parser.parse_args()
    if args.command == "inspect":
        inspect(args.files)
    else:
        probes(args.table, args.out, args.frames)


if __name__ == "__main__":
    main()

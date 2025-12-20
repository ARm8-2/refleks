import { Point } from '../types/ipc';

export function tsMs(v: any): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const n = Date.parse(String(v))
  return Number.isFinite(n) ? n : 0
}

export function decodeTraceData(base64: string): Point[] {
  if (!base64) return [];

  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const view = new DataView(bytes.buffer);
    let offset = 0;

    // Read count (uint32)
    if (len < 4) return [];
    const count = view.getUint32(offset, true);
    offset += 4;

    const points: Point[] = new Array(count);
    const pointSize = 20;

    for (let i = 0; i < count; i++) {
      if (offset + pointSize > len) break;

      const tsNano = view.getBigInt64(offset, true);
      const x = view.getInt32(offset + 8, true);
      const y = view.getInt32(offset + 12, true);
      const buttons = view.getUint32(offset + 16, true);

      // Convert nano to milliseconds
      const tsMs = Number(tsNano / BigInt(1000000));

      points[i] = {
        ts: tsMs,
        x,
        y,
        buttons
      };

      offset += pointSize;
    }
    return points;
  } catch (e) {
    console.error("Failed to decode trace data", e);
    return [];
  }
}

import { MousePoint } from '../types/ipc';

export function decodeTraceData(base64: string): MousePoint[] {
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

    const points: MousePoint[] = new Array(count);
    const pointSize = 20;

    for (let i = 0; i < count; i++) {
      if (offset + pointSize > len) break;

      const tsNano = view.getBigInt64(offset, true);
      const x = view.getInt32(offset + 8, true);
      const y = view.getInt32(offset + 12, true);
      const buttons = view.getUint32(offset + 16, true);

      // Convert nano to milliseconds
      const ms = Number(tsNano / BigInt(1000000));

      points[i] = {
        ts: ms,
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

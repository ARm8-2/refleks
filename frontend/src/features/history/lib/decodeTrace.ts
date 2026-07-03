import type { MousePoint } from "@/shared/types/ipc";

/**
 * Decode base64-encoded binary trace data into an array of MousePoint.
 *
 * Wire format (little-endian):
 *   [count: uint32] [point × count]
 *   point = [ts: int64 nanoseconds | x: int32 | y: int32 | buttons: uint32]  (20 bytes)
 */
export function decodeTrace(base64: string): MousePoint[] {
  if (!base64) return [];

  const bin = atob(base64);
  const len = bin.length;
  if (len < 4) return [];

  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);

  const view = new DataView(bytes.buffer);
  const count = view.getUint32(0, true);
  const pointSize = 20;
  const points: MousePoint[] = new Array(count);

  for (
    let i = 0, off = 4;
    i < count && off + pointSize <= len;
    i++, off += pointSize
  ) {
    points[i] = {
      ts: Number(view.getBigInt64(off, true) / BigInt(1_000_000)),
      x: view.getInt32(off + 8, true),
      y: view.getInt32(off + 12, true),
      buttons: view.getUint32(off + 16, true),
    };
  }

  return points;
}

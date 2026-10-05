import { describe, expect, it } from "vitest";
import { decodeTrace } from "./decodeTrace";

type PointInput = {
  timestampNs: bigint;
  x: number;
  y: number;
  buttons: number;
};

function encodeTrace(points: PointInput[], declaredCount = points.length): string {
  const bytes = new Uint8Array(4 + points.length * 20);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, declaredCount, true);

  points.forEach((point, index) => {
    const offset = 4 + index * 20;
    view.setBigInt64(offset, point.timestampNs, true);
    view.setInt32(offset + 8, point.x, true);
    view.setInt32(offset + 12, point.y, true);
    view.setUint32(offset + 16, point.buttons, true);
  });

  return Buffer.from(bytes).toString("base64");
}

describe("decodeTrace", () => {
  it("decodes point fields from the little-endian wire format", () => {
    const encoded = encodeTrace([
      { timestampNs: 1_234_567_890n, x: -120, y: 450, buttons: 3 },
      { timestampNs: 9_876_543_210n, x: 1920, y: -1080, buttons: 0 },
    ]);

    expect(decodeTrace(encoded)).toEqual([
      { ts: 1234, x: -120, y: 450, buttons: 3 },
      { ts: 9876, x: 1920, y: -1080, buttons: 0 },
    ]);
  });

  it("returns an empty list for empty, short, or zero-point data", () => {
    expect(decodeTrace("")).toEqual([]);
    expect(decodeTrace(Buffer.from([1, 2, 3]).toString("base64"))).toEqual(
      [],
    );
    expect(decodeTrace(encodeTrace([]))).toEqual([]);
  });

  it("returns only complete points when the payload is truncated", () => {
    const encoded = encodeTrace(
      [{ timestampNs: 2_000_000n, x: 10, y: 20, buttons: 1 }],
      2,
    );

    expect(decodeTrace(encoded)).toEqual([
      { ts: 2, x: 10, y: 20, buttons: 1 },
    ]);
  });
});

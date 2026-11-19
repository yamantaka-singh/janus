import { describe, expect, it } from "vitest";
import {
  CameraCropConfig,
  cropImageBuffer,
  DEFAULT_CAMERA_CROPS,
  preprocessCameraFiles,
} from "./image-processor";

describe("Image processor (Edge-safe buffer pass-through)", () => {
  it("passes image buffer through cleanly without native dependencies", async () => {
    const sampleBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const cropConfig: CameraCropConfig = {
      camera: 1,
      top: 10,
      bottom: 10,
      left: 10,
      right: 10,
    };

    const result = await cropImageBuffer(sampleBuffer, cropConfig);
    expect(result).toBeInstanceOf(Buffer);
    expect(result).toEqual(sampleBuffer);
  });

  it("preprocesses camera files array converting Files to Buffers", async () => {
    const file1 = new File([new Uint8Array([0xff, 0xd8, 0xff])], "cam1.jpg", {
      type: "image/jpeg",
    });
    const file2 = new File([new Uint8Array([0x00, 0x01])], "cam2.jpg", {
      type: "image/jpeg",
    });

    const results = await preprocessCameraFiles([file1, file2], DEFAULT_CAMERA_CROPS);
    expect(results).toHaveLength(2);
    expect(results[0]).toBeInstanceOf(Buffer);
    expect(results[1]).toBeInstanceOf(Buffer);
    expect(results[0].length).toBe(3);
    expect(results[1].length).toBe(2);
  });
});

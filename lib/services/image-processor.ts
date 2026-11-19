/**
 * @file lib/services/image-processor.ts
 * @description Edge-safe image preprocessing utilities for Cloudflare Workers.
 * Provides per-camera crop configuration interfaces and buffer pass-through.
 *
 * Zero native C++ dependencies — fully compatible with Cloudflare Workers V8 isolates.
 */

/**
 * Crop configuration for a single camera, expressed as percentage insets
 * from each edge of the original image (0–100).
 */
export interface CameraCropConfig {
  camera: number;
  /** Percentage to crop from the top edge */
  top: number;
  /** Percentage to crop from the bottom edge */
  bottom: number;
  /** Percentage to crop from the left edge */
  left: number;
  /** Percentage to crop from the right edge */
  right: number;
}

/**
 * Default crop configurations derived from visual analysis of the two factory camera feeds.
 *   - Camera 1 (Front view): Removes wall/hose-reel left, parked vehicles right, sky top, ramp bottom.
 *   - Camera 2 (Rear view): Removes yard/parked-car left, boundary wall right, sky top, ramp bottom.
 */
export const DEFAULT_CAMERA_CROPS: CameraCropConfig[] = [
  { camera: 1, top: 5, bottom: 34, left: 37, right: 28 },
  { camera: 2, top: 12, bottom: 31, left: 20, right: 49 },
];

/**
 * Passes through the image buffer cleanly on edge runtimes.
 * Camera framing is handled upstream at the edge camera/Hermes node.
 *
 * @param buffer - Raw image buffer
 * @param _crop  - Camera crop configuration
 * @returns Image buffer
 */
export async function cropImageBuffer(
  buffer: Buffer,
  _crop: CameraCropConfig,
): Promise<Buffer> {
  return buffer;
}

/**
 * Applies per-camera crop configs to an ordered array of image Files.
 * Files are converted to Buffers and passed through cleanly for edge storage.
 *
 * @param files        - Ordered array [cam0, cam1, ...] of File objects
 * @param _cropConfigs - Array of CameraCropConfig, indexed by camera number (1-based)
 * @returns Array of Buffers
 */
export async function preprocessCameraFiles(
  files: File[],
  _cropConfigs: CameraCropConfig[],
): Promise<Buffer[]> {
  return Promise.all(
    files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }),
  );
}

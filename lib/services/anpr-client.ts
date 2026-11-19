/**
 * ANPR Client Service for communicating with Argus ANPR Microservice.
 * Conforms strictly to Argus REST schema with Cloudflare Tunnel & Access Token support.
 */

export interface PlateResult {
  plate: string;
  vehicle_box?: [number, number, number, number] | null;
  execution_time_ms: number;
}

export interface RecognitionResponse {
  results: PlateResult[];
  execution_time_ms: number;
}

export interface AnprClientConfig {
  baseUrl?: string;
  apiKey?: string;
  accessClientId?: string;
  accessClientSecret?: string;
  timeoutMs?: number;
}

export class AnprServiceError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = "AnprServiceError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function recognizePlate(
  image: Buffer | Uint8Array,
  filename = "plate.jpg",
  config?: AnprClientConfig,
): Promise<RecognitionResponse> {
  const baseUrl = config?.baseUrl || process.env.ARGUS_API_URL || "http://127.0.0.1:8000";
  const apiKey = config?.apiKey || process.env.ARGUS_API_KEY;
  const accessClientId = config?.accessClientId || process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
  const accessClientSecret = config?.accessClientSecret || process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  const timeoutMs = config?.timeoutMs ?? 10000;

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/recognize`;

  const formData = new FormData();
  const blob = new Blob([image as BlobPart], { type: "image/jpeg" });
  formData.append("file", blob, filename);

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (accessClientId) {
    headers["CF-Access-Client-Id"] = accessClientId;
  }
  if (accessClientSecret) {
    headers["CF-Access-Client-Secret"] = accessClientSecret;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
    });
  } catch (err: unknown) {
    if (err instanceof AnprServiceError) {
      throw err;
    }
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new AnprServiceError(`ANPR service request failed: ${errorMsg}`, 503, err);
  }

  if (!response.ok) {
    let errorMessage = `ANPR service responded with HTTP ${response.status}`;
    let errorDetails: unknown = null;
    try {
      const errorJson = await response.json();
      if (errorJson && typeof errorJson === "object") {
        errorDetails = errorJson;
        if ("message" in errorJson && typeof (errorJson as { message: unknown }).message === "string") {
          errorMessage = (errorJson as { message: string }).message;
        }
      }
    } catch {
      try {
        const text = await response.text();
        if (text) {
          errorMessage = `${errorMessage}: ${text}`;
        }
      } catch {
        // ignore text extraction failure
      }
    }
    throw new AnprServiceError(errorMessage, response.status, errorDetails);
  }

  return (await response.json()) as RecognitionResponse;
}

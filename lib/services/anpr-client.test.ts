import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recognizePlate, AnprServiceError } from "./anpr-client";

describe("ANPR Client Service", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ARGUS_API_URL;
    delete process.env.ARGUS_API_KEY;
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
    delete process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("submits image buffer as multipart/form-data to default endpoint", async () => {
    const mockResponse = {
      results: [{ plate: "MH12AB1234", vehicle_box: [10, 20, 100, 200], execution_time_ms: 45.2 }],
      execution_time_ms: 62.5,
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });
    vi.stubGlobal("fetch", fetchMock);

    const dummyBuffer = Buffer.from("fake-jpeg-data");
    const result = await recognizePlate(dummyBuffer, "test_truck.jpg");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/recognize");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(result).toEqual(mockResponse);
  });

  it("attaches Cloudflare Access and X-API-Key headers when configured in env", async () => {
    process.env.ARGUS_API_URL = "https://anpr-edge.gluvok.com";
    process.env.ARGUS_API_KEY = "test-argus-secret-key";
    process.env.CLOUDFLARE_ACCESS_CLIENT_ID = "cf-id-12345.access";
    process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET = "cf-secret-67890";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [], execution_time_ms: 10 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await recognizePlate(Buffer.from("fake-image"));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://anpr-edge.gluvok.com/recognize");
    expect(init.headers).toEqual({
      "X-API-Key": "test-argus-secret-key",
      "CF-Access-Client-Id": "cf-id-12345.access",
      "CF-Access-Client-Secret": "cf-secret-67890",
    });
  });

  it("allows options to override base URL and credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [], execution_time_ms: 15 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await recognizePlate(Buffer.from("fake-image"), "vehicle.png", {
      baseUrl: "https://custom-tunnel.gluvok.com/",
      apiKey: "custom-api-key",
      accessClientId: "custom-cf-id",
      accessClientSecret: "custom-cf-secret",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://custom-tunnel.gluvok.com/recognize");
    expect(init.headers).toEqual({
      "X-API-Key": "custom-api-key",
      "CF-Access-Client-Id": "custom-cf-id",
      "CF-Access-Client-Secret": "custom-cf-secret",
    });
  });

  it("throws AnprServiceError on non-200 HTTP response with detailed error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        status_code: 401,
        message: "Invalid or missing API key",
        error_type: "UNAUTHORIZED",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(recognizePlate(Buffer.from("image"))).rejects.toThrow(AnprServiceError);
    await expect(recognizePlate(Buffer.from("image"))).rejects.toThrow(
      /Invalid or missing API key/,
    );
  });

  it("handles non-JSON error response from Cloudflare edge gracefully", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 524,
      json: async () => {
        throw new Error("Invalid JSON");
      },
      text: async () => "A timeout occurred (Cloudflare 524)",
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await recognizePlate(Buffer.from("image"));
      expect.fail("Should have thrown AnprServiceError");
    } catch (err) {
      expect(err).toBeInstanceOf(AnprServiceError);
      expect((err as AnprServiceError).statusCode).toBe(524);
      expect((err as AnprServiceError).message).toContain("Cloudflare 524");
    }
  });
});

/**
 * @jest-environment node
 */
import { jest } from "@jest/globals";
import { verifyAccessToken } from "../app/autional/server-auth";

const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

function okResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data }),
  } as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as Response;
}

describe("verifyAccessToken", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("returns user when /auth/me succeeds", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({ id: "u-100", username: "alice", email: "alice@example.com" }),
    );
    const user = await verifyAccessToken("token-ok-1");
    expect(user).toEqual({
      id: "u-100",
      username: "alice",
      email: "alice@example.com",
    });
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/bff/identity/api/v1/auth/me");
  });

  test("returns null for empty token without fetching", async () => {
    expect(await verifyAccessToken("")).toBeNull();
    expect(await verifyAccessToken(null)).toBeNull();
    expect(await verifyAccessToken(undefined)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("returns null when /auth/me is not ok (e.g. revoked token)", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(401));
    expect(await verifyAccessToken("token-revoked-2")).toBeNull();
  });

  test("returns null when response lacks data.id", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ username: "ghost" }));
    expect(await verifyAccessToken("token-nodata-3")).toBeNull();
  });

  test("returns null on network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await verifyAccessToken("token-neterr-4")).toBeNull();
  });

  test("caches positive result within TTL (single fetch)", async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ id: "u-cache" }));
    const first = await verifyAccessToken("token-cache-5");
    const second = await verifyAccessToken("token-cache-5");
    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("caches negative result briefly and recovers after expiry", async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockResolvedValueOnce(errorResponse(401));
      expect(await verifyAccessToken("token-neg-6")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // 负缓存 TTL（10s）内不再打 /auth/me
      fetchMock.mockResolvedValueOnce(okResponse({ id: "u-recovered" }));
      expect(await verifyAccessToken("token-neg-6")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // 过期后重新校验并恢复
      jest.advanceTimersByTime(11_000);
      const recovered = await verifyAccessToken("token-neg-6");
      expect(recovered?.id).toBe("u-recovered");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });
});

/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { AUTIONAL_TOKEN_COOKIE } from "../app/autional/config";

function makeRequest(pathname: string, token?: string): NextRequest {
  const headers = new Headers();
  if (token) {
    headers.set("cookie", `${AUTIONAL_TOKEN_COOKIE}=${encodeURIComponent(token)}`);
  }
  return new NextRequest(new URL(`http://localhost:3000${pathname}`), {
    headers,
  });
}

describe("middleware gate", () => {
  test("redirects / without session cookie to /login with callbackUrl", () => {
    const res = middleware(makeRequest("/"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl=%2F");
  });

  test("passes / through when session cookie exists", () => {
    const res = middleware(makeRequest("/", "jwt-token-value"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  test("passes non-root paths through (public pages, assets)", () => {
    for (const p of ["/login", "/oauth/callback", "/api/config"]) {
      const res = middleware(makeRequest(p));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });
});

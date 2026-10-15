// 服务端会话校验（edge 与 nodejs 运行时通用的 fetch 路径）。
// token → /auth/me 权威校验（能感知吊销）；60s 微缓存降压，负结果短缓存防打爆。
import { NextRequest, NextResponse } from "next/server";
import {
  AUTIONAL_ISSUER,
  AUTIONAL_TOKEN_COOKIE,
  decodeCookieToken,
} from "./config";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

const CACHE_TTL_MS = 60_000;
const NEGATIVE_CACHE_TTL_MS = 10_000;
const CACHE_MAX = 1000;
const cache = new Map<string, { user: AuthUser | null; exp: number }>();

function apiBase(): string {
  return `${AUTIONAL_ISSUER.replace(/\/+$/, "")}/bff`;
}

export async function verifyAccessToken(
  token: string | null | undefined,
): Promise<AuthUser | null> {
  const t = token?.trim();
  if (!t) return null;

  const now = Date.now();
  const hit = cache.get(t);
  if (hit && hit.exp > now) return hit.user;

  let user: AuthUser | null = null;
  try {
    const res = await fetch(`${apiBase()}/identity/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${t}` },
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { id?: unknown; username?: unknown; email?: unknown };
      };
      const data = json?.data;
      if (data?.id) {
        user = {
          id: String(data.id),
          username: String(data.username ?? ""),
          email: String(data.email ?? ""),
        };
      }
    }
  } catch {
    user = null;
  }

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(t, {
    user,
    exp: now + (user ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
  });
  return user;
}

// 路由级会话门：未登录返回 401 NextResponse，已登录返回 null。
export async function requireSession(
  req: NextRequest,
): Promise<NextResponse | null> {
  const token = decodeCookieToken(
    req.cookies.get(AUTIONAL_TOKEN_COOKIE)?.value,
  );
  const user = await verifyAccessToken(token);
  if (user) return null;
  return NextResponse.json(
    { error: true, msg: "unauthorized: please sign in" },
    { status: 401 },
  );
}

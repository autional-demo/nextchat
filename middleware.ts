import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTIONAL_TOKEN_COOKIE } from "./app/autional/config";

// 本地实现（不引 @autional/next：SDK 0.3.x dist 丢失 "use client"，
// 从 middleware 引会把 provider 的 React hooks 带进 react-server 条件编译 → 编译失败；
// 同源缺陷见 lab AI-ONBOARDING-NOTES C7 类问题）。
// 语义：仅做 cookie 存在性门（与 SDK 一致）；真伪由服务端逐请求 /auth/me 校验。
export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (pathname !== "/") return NextResponse.next();

  const token = request.cookies.get(AUTIONAL_TOKEN_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", "/");
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // 排除：API（各自做会话门）、静态资源、反代 /bff、公开页 /login /oauth、带扩展名文件。
  matcher: [
    "/((?!api|_next/static|_next/image|bff|.well-known|login|oauth|favicon.ico|site.webmanifest|serviceWorkerRegister.js|.*\\..*).*)",
  ],
};

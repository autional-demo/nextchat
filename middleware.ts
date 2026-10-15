import { autionalMiddleware } from "@autional/next/middleware";

// 2026-10-15 跟版：@autional/next 0.4.0 起 ./middleware 子路径零 react 引用且保留
// "use client"，C7/C3N 缺陷已修，本地等价实现（cookie 存在性门）弃用。

export const middleware = autionalMiddleware({
  protectedPaths: ["/"],
  loginPath: "/login",
});

export const config = {
  // 排除：API（各自做会话门）、静态资源、反代 /bff、公开页 /login /oauth、带扩展名文件。
  matcher: [
    "/((?!api|_next/static|_next/image|bff|.well-known|login|oauth|favicon.ico|site.webmanifest|serviceWorkerRegister.js|.*\\..*).*)",
  ],
};

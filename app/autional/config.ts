// Autional 集成配置（公开常量，无密钥）。
export const AUTIONAL_APP_ID =
  process.env.NEXT_PUBLIC_AUTIONAL_APP_ID ?? "client-TgTEqF0vse53";

export const AUTIONAL_ISSUER =
  process.env.NEXT_PUBLIC_AUTIONAL_ISSUER ?? "https://api.autional.cn";

export const AUTIONAL_TENANT_SLUG =
  process.env.NEXT_PUBLIC_AUTIONAL_TENANT_SLUG ?? "nextchat-demo";

export const AUTIONAL_CALLBACK_PATH = "/oauth/callback";

// 反代形态下 SDK 无法推导登录页（默认把 authorize 指到同源），必须显式引脚到 auth 域。
export const AUTIONAL_AUTHORIZE_URL =
  process.env.NEXT_PUBLIC_AUTIONAL_AUTHORIZE_URL ??
  "https://auth.autional.cn/oauth/api/v1/oauth/authorize";

// OIDC RP-Initiated Logout（end_session_endpoint，必须整页跳转）。
export const AUTIONAL_LOGOUT_PATH = "/oauth/api/v1/oauth/logout";

// SDK 只写 localStorage，应用侧把 access token 镜像进同名 cookie 供
// middleware / 服务端路由读取（服务端不信任其内容，逐请求 /auth/me 校验）。
export const AUTIONAL_TOKEN_COOKIE = "autional_token";

// 浏览器走同源反代 /bff（next.config.mjs rewrites → api.autional.cn）；服务端直连绝对地址。
export function getAutionalApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/bff`;
  }
  return `${AUTIONAL_ISSUER.replace(/\/+$/, "")}/bff`;
}

// 账号门户（租户工作区入口）。
export function getPortalUrl(): string {
  return `https://user.autional.cn/${AUTIONAL_TENANT_SLUG}`;
}

// cookie 值由应用侧 encodeURIComponent 写入，读取侧对称解码（JWT 的 "=" 填充会转义）。
export function decodeCookieToken(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

"use client";

// 登出 = 本地清理 + OIDC RP-Initiated Logout（终结 OP 会话）。
// 顺序：flush 同步 → 构造登出 URL（必须先读 id_token_hint，SDK logout() 会清空本地载荷）
// → 清本地用户数据 → SDK logout() → 整页跳转登出端点（无条件兜底：SDK discovery
// 未加载时只清本域，不跳转；幂等，重复导航无害）。
import type { Autional } from "@autional/core";
import {
  AUTIONAL_APP_ID,
  AUTIONAL_AUTH_BASE,
  AUTIONAL_ISSUER,
  AUTIONAL_LOGOUT_CONFIRM_PATH,
  AUTIONAL_LOGOUT_PATH,
} from "./config";
import { StoreKey } from "@/app/constant";
import { indexedDBStorage } from "@/app/utils/indexedDB-storage";
import { safeLocalStorage } from "@/app/utils";

let beforeLogoutHook: (() => Promise<void>) | null = null;

export function registerBeforeLogout(fn: () => Promise<void>): void {
  beforeLogoutHook = fn;
}

/** 读 localStorage 载荷里的 idToken（best-effort）。过期或解码失败一律省略
 *（过期 hint 服务端 400 拒绝）。 */
function readStoredIdTokenHint(): string | undefined {
  try {
    const raw = window.localStorage.getItem("autional_tokens");
    if (!raw) return undefined;
    const idToken = (JSON.parse(raw) as { idToken?: unknown }).idToken;
    if (typeof idToken !== "string" || !idToken) return undefined;
    const base64 = idToken.split(".")[1] ?? "";
    const payload = JSON.parse(
      atob(base64.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: unknown };
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
      return undefined;
    }
    return idToken;
  } catch {
    return undefined;
  }
}

function generateLogoutState(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function buildStandardLogoutUrl(): string {
  const params = new URLSearchParams();
  const hint = readStoredIdTokenHint();
  if (hint) params.set("id_token_hint", hint);
  // post_logout_redirect_uri 须在客户端白名单内；未注册时服务端忽略（不开放重定向）。
  params.set("client_id", AUTIONAL_APP_ID);
  params.set("post_logout_redirect_uri", `${window.location.origin}/`);
  params.set("state", generateLogoutState());
  // 平台缺陷绕行（2026-10-15 生产实测）：无 id_token_hint 时标准端点 302 到
  // auth.autional.tianv.mobi/logout-confirm（死域 404，OP 会话不终结）；同一确认页
  // 在 auth 域可用且能完成登出。hint 取自持久化载荷 idToken（0.3.x 活跃会话实测
  // 非 null；仅清除态或未持久化时为 null）——有 hint 走标准端点，无 hint 直达
  // auth 域确认页；平台修复后本分支可移除。
  const endpoint = hint
    ? `${AUTIONAL_ISSUER.replace(/\/+$/, "")}${AUTIONAL_LOGOUT_PATH}`
    : `${AUTIONAL_AUTH_BASE.replace(
        /\/+$/,
        "",
      )}${AUTIONAL_LOGOUT_CONFIRM_PATH}`;
  return `${endpoint}?${params.toString()}`;
}

/** 防跨用户数据泄漏：清除本机持久化的会话数据（IndexedDB + localStorage 镜像）。 */
async function clearLocalUserData(): Promise<void> {
  const keys = [
    StoreKey.Chat,
    StoreKey.Access,
    StoreKey.Config,
    StoreKey.Mask,
    StoreKey.Prompt,
    StoreKey.Sync,
  ];
  const ls = safeLocalStorage();
  for (const key of keys) {
    try {
      await indexedDBStorage.removeItem(key);
    } catch {
      // 存储不可用：忽略（页面即将整体跳转离开）
    }
    try {
      ls?.removeItem(key);
    } catch {
      // ignore
    }
  }
}

export async function performLogout(autional: Autional): Promise<void> {
  try {
    await beforeLogoutHook?.();
  } catch {
    // 同步失败不阻塞登出
  }
  const logoutUrl = buildStandardLogoutUrl();
  await clearLocalUserData();
  try {
    await autional.logout();
  } catch {
    // SDK 清理失败仍继续跳转（cookie 由 LOGGED_OUT 事件清理；此处兜底再清一次）
  }
  window.location.assign(logoutUrl);
}

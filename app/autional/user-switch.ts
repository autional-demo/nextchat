"use client";

// 换号守卫 + 本机用户数据清理。
// 背景：登录门只拦未登录访问，会话结束（cookie 过期 / 平台侧终结）后换号登录时
// 无登出路径，本地 IndexedDB 残留会被 mergeAppState 并入新账号视图并上推其 blob。
// 判定策略：本地记录的上次 userId 与当前登录 userId 不一致（含 null → 有残留但
// 从未记录过）即清理；本应用匿名使用不可达，本地有数据必是上一账号残留。
import { StoreKey } from "@/app/constant";
import { indexedDBStorage } from "@/app/utils/indexedDB-storage";
import { safeLocalStorage } from "@/app/utils";

export const LAST_USER_ID_KEY = "autional_last_user_id";

// 登出与换号共用此清单：登出原清 Chat/Access/Config/Mask/Prompt/Sync，
// 换号场景补充 Plugin/SdList（含用户配置内容）。Access 与 Sync 属凭据类，
// 跨账号残留风险最高，两条路径都必须清。
const USER_DATA_KEYS = [
  StoreKey.Chat,
  StoreKey.Access,
  StoreKey.Config,
  StoreKey.Mask,
  StoreKey.Prompt,
  StoreKey.Sync,
  StoreKey.Plugin,
  StoreKey.SdList,
] as const;

export function resolveUserSwitch(
  lastUserId: string | null,
  currentUserId: string,
): "same" | "switch" {
  return lastUserId === currentUserId ? "same" : "switch";
}

export function getLastUserId(): string | null {
  try {
    return safeLocalStorage()?.getItem(LAST_USER_ID_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setLastUserId(userId: string): void {
  try {
    safeLocalStorage()?.setItem(LAST_USER_ID_KEY, userId);
  } catch {
    // 存储不可用：守卫退化为"每次登录都清"，本地数据仍可用
  }
}

/** 清除本机持久化的用户数据（IndexedDB + localStorage 镜像）。 */
export async function clearLocalUserData(): Promise<void> {
  const ls = safeLocalStorage();
  for (const key of USER_DATA_KEYS) {
    try {
      await indexedDBStorage.removeItem(key);
    } catch {
      // 存储不可用：忽略
    }
    try {
      ls?.removeItem(key);
    } catch {
      // ignore
    }
  }
}

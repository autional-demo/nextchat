"use client";

// 平台持久化同步：登录后拉取远端 AppState 并与本地合并；此后本地变更防抖上推。
// 同步范围 = Chat / Config / Mask / Prompt 四个 store；不含 Access（API key 属
// 隐私，不上云）与 Sync（云同步凭据）。登出前 flush 一次。
import { useEffect } from "react";
import { useAutional } from "@autional/react";
import {
  getLocalAppState,
  mergeAppState,
  type AppState,
} from "@/app/utils/sync";
import { StoreKey } from "@/app/constant";
import { useAppConfig, useChatStore } from "../store";
import { useMaskStore } from "../store/mask";
import { usePromptStore } from "../store/prompt";
import { registerBeforeLogout } from "@/app/autional/logout";
import {
  clearLocalUserData,
  getLastUserId,
  resolveUserSwitch,
  setLastUserId,
} from "@/app/autional/user-switch";

const SYNC_KEYS = [
  StoreKey.Chat,
  StoreKey.Config,
  StoreKey.Mask,
  StoreKey.Prompt,
] as const;

const PUSH_DEBOUNCE_MS = 1500;

type SyncedKey = (typeof SYNC_KEYS)[number];

function pickSynced(full: AppState): Partial<AppState> {
  const out: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) out[key] = full[key];
  return out as Partial<AppState>;
}

function setSynced(key: SyncedKey, value: unknown): void {
  switch (key) {
    case StoreKey.Chat:
      useChatStore.setState(value as never);
      break;
    case StoreKey.Config:
      useAppConfig.setState(value as never);
      break;
    case StoreKey.Mask:
      useMaskStore.setState(value as never);
      break;
    case StoreKey.Prompt:
      usePromptStore.setState(value as never);
      break;
  }
}

function subscribeSynced(key: SyncedKey, listener: () => void): () => void {
  switch (key) {
    case StoreKey.Chat:
      return useChatStore.subscribe(listener);
    case StoreKey.Config:
      return useAppConfig.subscribe(listener);
    case StoreKey.Mask:
      return useMaskStore.subscribe(listener);
    case StoreKey.Prompt:
      return usePromptStore.subscribe(listener);
  }
}

export function PlatformSync() {
  const { isAuthenticated, isLoading, user } = useAutional();

  useEffect(() => {
    // 换号守卫：本机残留属上一账号时先清理再整页重载（重载后判定为 same，
    // 走正常 pull）。否则残留会经 mergeAppState 并入新账号视图并上推其 blob。
    if (!isLoading && isAuthenticated && user?.id) {
      if (resolveUserSwitch(getLastUserId(), user.id) === "switch") {
        setLastUserId(user.id);
        void clearLocalUserData().finally(() => window.location.assign("/"));
        return;
      }
    }

    const S = { ready: false, dirty: false, authed: false };
    // 推送串行化：飞行中的请求放在这里，后到的 pushNow 等它结束再决定
    let inflight: Promise<void> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubs: Array<() => void> = [];

    const pushNow = async (): Promise<void> => {
      if (!S.ready || !S.authed) return;
      // 推送中延后：等飞行中的请求结束（不丢弃本次推送意图）
      while (inflight) await inflight;
      if (!S.ready || !S.authed || !S.dirty) return;
      // 发送前消费脏标记：发送期间的新变更会重新置脏，不会被成功回调抹掉
      S.dirty = false;
      const body = JSON.stringify({ state: pickSynced(getLocalAppState()) });
      inflight = (async () => {
        try {
          const res = await fetch("/api/user-state", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body,
          });
          if (res.status === 413) {
            // 超出平台存储上限（4MB）：放弃，数据仍保留在本地。
            console.warn("[PlatformSync] state too large, skipped upload");
          } else if (res.status === 401) {
            S.authed = false;
          } else if (!res.ok) {
            S.dirty = true; // 5xx 等：恢复脏标记
          }
        } catch {
          // 网络抖动：恢复脏标记
          S.dirty = true;
        }
      })();
      try {
        await inflight;
      } finally {
        inflight = null;
        // 兜底重排：失败恢复的脏标记 / 飞行期间的新变更都要再推
        if (S.dirty) schedule();
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void pushNow(), PUSH_DEBOUNCE_MS);
    };

    const arm = () => {
      for (const key of SYNC_KEYS) {
        unsubs.push(
          subscribeSynced(key, () => {
            if (!S.ready || !S.authed) return;
            S.dirty = true;
            schedule();
          }),
        );
      }
    };

    const pull = async () => {
      try {
        const res = await fetch("/api/user-state", { cache: "no-store" });
        if (res.status === 401) {
          S.authed = false;
          return;
        }
        if (!res.ok) return;
        const json = (await res.json()) as { state?: unknown };
        const remote = json?.state;
        if (remote && typeof remote === "object") {
          const remoteSubset: Record<string, unknown> = {};
          for (const key of SYNC_KEYS) {
            const value = (remote as Record<string, unknown>)[key];
            if (value && typeof value === "object") remoteSubset[key] = value;
          }
          const keys = SYNC_KEYS.filter(
            (key) => remoteSubset[key] !== undefined,
          );
          if (keys.length) {
            const full = getLocalAppState();
            const local: Record<string, unknown> = {};
            for (const key of keys) local[key] = full[key];
            const merged = mergeAppState(
              local as unknown as AppState,
              remoteSubset as unknown as AppState,
            );
            for (const key of keys) {
              setSynced(key, (merged as Record<string, unknown>)[key]);
            }
          }
        }
        S.ready = true;
        S.authed = true;
        arm();
      } catch {
        // 拉取失败：保持未就绪；本次挂载不上推（不影响本地使用）
      }
    };

    // 页签隐藏时立即 flush：压缩"关页丢最后 1.5s 变更"的窗口。
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && S.dirty) void pushNow();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    registerBeforeLogout(async () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (S.ready && S.authed) {
        // 强制一次最终快照（含登出窗口内的最新变更）
        S.dirty = true;
        await pushNow();
      }
    });

    if (!isLoading && isAuthenticated) {
      void pull();
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unsubs.splice(0).forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore
        }
      });
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, [isAuthenticated, isLoading, user?.id]);

  return null;
}

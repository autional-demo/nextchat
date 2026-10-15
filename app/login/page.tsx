"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAutional } from "@autional/react";
import {
  AUTIONAL_APP_ID,
  AUTIONAL_AUTHORIZE_URL,
  AUTIONAL_CALLBACK_PATH,
} from "@/app/autional/config";

export default function LoginPage() {
  const { isAuthenticated, isLoading, loginWithOAuth } = useAutional();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const handleLogin = useCallback(async () => {
    setError(null);
    setPending(true);
    try {
      const callbackUrl = new URLSearchParams(window.location.search).get(
        "callbackUrl",
      );
      if (callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")) {
        sessionStorage.setItem("autional_callback_url", callbackUrl);
      }
      await loginWithOAuth({
        clientId: AUTIONAL_APP_ID,
        redirectUri: `${window.location.origin}${AUTIONAL_CALLBACK_PATH}`,
        authorizeUrl: AUTIONAL_AUTHORIZE_URL,
      });
    } catch (e) {
      setPending(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [loginWithOAuth]);

  // 会话过期的静默续登：SDK 刷新链随 cookie 播种失效（lab C12/C13），
  // 带残留会话 cookie 到本页时自动重走 SSO —— IdP 会话在则免点击回来。
  const autoAttempted = useRef(false);
  useEffect(() => {
    if (isLoading || isAuthenticated || autoAttempted.current) return;
    if (!document.cookie.includes("autional_token=")) return;
    autoAttempted.current = true;
    void handleLogin();
  }, [isLoading, isAuthenticated, handleLogin]);

  const disabled = pending || isLoading;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--gray)",
        color: "var(--black)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--white)",
          border: "var(--border-in-light)",
          borderRadius: 12,
          padding: "36px 32px",
          textAlign: "center",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <img
          src="/android-chrome-192x192.png"
          alt="NextChat"
          width={56}
          height={56}
          style={{ borderRadius: 14 }}
        />
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "16px 0 0" }}>
          NextChat · 多用户演示
        </h1>
        <p
          style={{
            fontSize: 13,
            opacity: 0.7,
            marginTop: 10,
            lineHeight: 1.6,
          }}
        >
          使用 Autional
          账号登录。你的聊天记录与设置按账号隔离，并保存在平台存储。
        </p>
        {error ? (
          <p
            style={{
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 12,
              wordBreak: "break-all",
              textAlign: "left",
              background: "rgba(220,38,38,0.1)",
              color: "#dc2626",
            }}
          >
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleLogin}
          disabled={disabled}
          style={{
            marginTop: 24,
            width: "100%",
            padding: "10px 16px",
            borderRadius: 8,
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
            background: "var(--black)",
            color: "var(--white)",
            transition: "opacity 0.2s ease",
            opacity: disabled ? 0.6 : 1,
          }}
        >
          {pending ? "跳转中…" : "使用 Autional 登录"}
        </button>
        <p style={{ margin: "20px 0 0", fontSize: 11, opacity: 0.45 }}>
          基于 ChatGPTNextWeb/NextChat（MIT 许可）· Autional demo
        </p>
      </div>
    </div>
  );
}

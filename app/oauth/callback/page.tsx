"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAutionalContext } from "@autional/react";
import { setSessionCookie } from "@/app/autional/session-cookie";

export default function OAuthCallbackPage() {
  const { autional } = useAutionalContext();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      try {
        await autional.handleOAuthCallback(window.location.href);
        const token = await autional.getAccessToken();
        if (token) setSessionCookie(token);
        const callbackUrl = sessionStorage.getItem("autional_callback_url");
        sessionStorage.removeItem("autional_callback_url");
        router.replace(
          callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//")
            ? callbackUrl
            : "/",
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    void run();
  }, [autional, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          border: "1px solid rgba(127,127,127,0.25)",
          borderRadius: 12,
          padding: "32px 28px",
          textAlign: "center",
        }}
      >
        {error ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
              登录未完成
            </h1>
            <p
              style={{
                marginTop: 10,
                fontSize: 12,
                wordBreak: "break-all",
                color: "#dc2626",
              }}
            >
              {error}
            </p>
            <Link
              href="/login"
              style={{ display: "inline-block", marginTop: 20, fontSize: 14 }}
            >
              返回登录
            </Link>
          </>
        ) : (
          <p style={{ fontSize: 14, opacity: 0.7 }}>正在完成登录…</p>
        )}
      </div>
    </div>
  );
}

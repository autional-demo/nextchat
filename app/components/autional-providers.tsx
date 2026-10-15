"use client";

import { type ReactNode } from "react";
import { AutionalProvider } from "@autional/next";
import {
  AUTIONAL_APP_ID,
  AUTIONAL_ISSUER,
  getAutionalApiUrl,
} from "@/app/autional/config";

export function AutionalProviders({ children }: { children: ReactNode }) {
  return (
    <AutionalProvider
      config={{
        appId: AUTIONAL_APP_ID,
        issuer: AUTIONAL_ISSUER,
        apiUrl: getAutionalApiUrl(),
      }}
    >
      {children}
    </AutionalProvider>
  );
}

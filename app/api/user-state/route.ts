import { NextRequest, NextResponse } from "next/server";
import {
  AUTIONAL_TOKEN_COOKIE,
  decodeCookieToken,
} from "@/app/autional/config";
import { verifyAccessToken } from "@/app/autional/server-auth";
import {
  MAX_STATE_BYTES,
  readUserState,
  writeUserState,
} from "@/app/autional/state-store";

export const runtime = "nodejs";

async function requireUser(req: NextRequest) {
  const token = decodeCookieToken(
    req.cookies.get(AUTIONAL_TOKEN_COOKIE)?.value,
  );
  return verifyAccessToken(token);
}

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = await readUserState(user.id);
  return NextResponse.json(
    { state },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const state = (body as { state?: unknown })?.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return NextResponse.json({ error: "missing state" }, { status: 400 });
  }

  const size = Buffer.byteLength(JSON.stringify(state), "utf8");
  if (size > MAX_STATE_BYTES) {
    return NextResponse.json(
      { error: "state too large", limit: MAX_STATE_BYTES, size },
      { status: 413 },
    );
  }

  await writeUserState(user.id, state as Record<string, unknown>);
  return NextResponse.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}

// 多用户数据持久化：state/<userId>.json → Vercel Blob（private）或本地 .data/ 回退。
import { promises as fs } from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";

// userId 来自 /auth/me（服务端信任源），仍做格式校验防路径注入。
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Vercel 路由处理器请求体上限 4.5MB；留出 JSON 包装余量。
export const MAX_STATE_BYTES = 4 * 1024 * 1024;

export function isValidUserId(id: string): boolean {
  return USER_ID_RE.test(id);
}

function blobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function blobPathname(userId: string): string {
  return `state/${userId}.json`;
}

function fsFile(userId: string): string {
  return path.join(process.cwd(), ".data", "state", `${userId}.json`);
}

function extractState(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as { state?: unknown };
    return parsed?.state && typeof parsed.state === "object"
      ? (parsed.state as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function readUserState(
  userId: string,
): Promise<Record<string, unknown> | null> {
  if (!isValidUserId(userId)) return null;
  if (blobEnabled()) {
    try {
      const result = await get(blobPathname(userId), {
        access: "private",
        useCache: false,
      });
      if (!result) return null;
      return extractState(await new Response(result.stream).text());
    } catch {
      return null;
    }
  }
  try {
    return extractState(await fs.readFile(fsFile(userId), "utf8"));
  } catch {
    return null;
  }
}

export async function writeUserState(
  userId: string,
  state: Record<string, unknown>,
): Promise<void> {
  if (!isValidUserId(userId)) throw new Error("invalid user id");
  const body = JSON.stringify({ state, savedAt: new Date().toISOString() });
  if (blobEnabled()) {
    await put(blobPathname(userId), body, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return;
  }
  const file = fsFile(userId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, "utf8");
}

/**
 * @jest-environment node
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  isValidUserId,
  readUserState,
  writeUserState,
} from "../app/autional/state-store";

const TEST_USER = "jest-state-user";

function fsFileFor(userId: string): string {
  return path.join(process.cwd(), ".data", "state", `${userId}.json`);
}

describe("isValidUserId", () => {
  test("accepts platform id charset", () => {
    expect(isValidUserId("01M4YNQ323YT61WW2AA9SM9AJ3")).toBe(true);
    expect(isValidUserId("abc_DEF-123")).toBe(true);
  });

  test("rejects empty, overlong, and path-like ids", () => {
    expect(isValidUserId("")).toBe(false);
    expect(isValidUserId("a".repeat(65))).toBe(false);
    expect(isValidUserId("../etc/passwd")).toBe(false);
    expect(isValidUserId("a/b")).toBe(false);
    expect(isValidUserId("a b")).toBe(false);
  });
});

describe("state-store fs fallback (no BLOB_READ_WRITE_TOKEN)", () => {
  beforeAll(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  afterEach(async () => {
    await fs.rm(fsFileFor(TEST_USER), { force: true });
  });

  test("roundtrip: write then read returns the same state", async () => {
    const state = {
      "chat-next-web-store": { sessions: [{ id: "s1" }] },
      "app-config": { theme: "dark" },
    };
    await writeUserState(TEST_USER, state);
    expect(await readUserState(TEST_USER)).toEqual(state);
  });

  test("read returns null for unknown user", async () => {
    expect(await readUserState("jest-no-such-user")).toBeNull();
  });

  test("read returns null for corrupt stored file", async () => {
    const file = fsFileFor(TEST_USER);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "{broken", "utf8");
    expect(await readUserState(TEST_USER)).toBeNull();
  });

  test("write rejects invalid user ids (path injection guard)", async () => {
    await expect(
      writeUserState("../evil", { a: 1 }),
    ).rejects.toThrow("invalid user id");
  });
});

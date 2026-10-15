import {
  LAST_USER_ID_KEY,
  clearLocalUserData,
  getLastUserId,
  resolveUserSwitch,
  setLastUserId,
} from "../app/autional/user-switch";
import { StoreKey } from "../app/constant";

describe("resolveUserSwitch", () => {
  test("treats missing stored id (null) as switch", () => {
    expect(resolveUserSwitch(null, "user-b")).toBe("switch");
  });

  test("treats identical id as same", () => {
    expect(resolveUserSwitch("user-a", "user-a")).toBe("same");
  });

  test("treats different id as switch", () => {
    expect(resolveUserSwitch("user-a", "user-b")).toBe("switch");
  });
});

describe("last user id persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("round-trips the last user id through localStorage", () => {
    expect(getLastUserId()).toBeNull();
    setLastUserId("user-a");
    expect(window.localStorage.getItem(LAST_USER_ID_KEY)).toBe("user-a");
    expect(getLastUserId()).toBe("user-a");
  });
});

describe("clearLocalUserData", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("clears user-data keys, keeps marker and non-user stores", async () => {
    const userDataKeys = [
      StoreKey.Chat,
      StoreKey.Access,
      StoreKey.Config,
      StoreKey.Mask,
      StoreKey.Prompt,
      StoreKey.Sync,
      StoreKey.Plugin,
      StoreKey.SdList,
    ];
    for (const key of userDataKeys) {
      window.localStorage.setItem(key, "user data");
    }
    setLastUserId("user-a");
    window.localStorage.setItem(StoreKey.Update, "app flag");

    await clearLocalUserData();

    for (const key of userDataKeys) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
    // 标记必须存活：否则每次挂载都会重复触发清理 + 重载
    expect(getLastUserId()).toBe("user-a");
    // Update 为应用级标记，非用户数据，不在清理范围
    expect(window.localStorage.getItem(StoreKey.Update)).toBe("app flag");
  });
});

import {
  AUTIONAL_APP_ID,
  AUTIONAL_TOKEN_COOKIE,
  decodeCookieToken,
  getAutionalApiUrl,
  getPortalUrl,
} from "../app/autional/config";

describe("autional config", () => {
  test("app id and cookie name are stable public identifiers", () => {
    expect(AUTIONAL_APP_ID).toMatch(/^client-/);
    expect(AUTIONAL_TOKEN_COOKIE).toBe("autional_token");
  });

  test("decodeCookieToken decodes percent-encoded JWT padding", () => {
    expect(decodeCookieToken("abc%3D%3D")).toBe("abc==");
  });

  test("decodeCookieToken passes through non-encoded values", () => {
    expect(decodeCookieToken("abc.def-ghi_jkl")).toBe("abc.def-ghi_jkl");
  });

  test("decodeCookieToken returns null for missing values", () => {
    expect(decodeCookieToken(undefined)).toBeNull();
    expect(decodeCookieToken(null)).toBeNull();
    expect(decodeCookieToken("")).toBeNull();
  });

  test("decodeCookieToken falls back to raw value on malformed encoding", () => {
    expect(decodeCookieToken("%zz")).toBe("%zz");
  });

  test("getAutionalApiUrl uses same-origin /bff in browser context", () => {
    // jest 环境为 jsdom（window 存在），应走同源反代分支
    expect(getAutionalApiUrl()).toBe(`${window.location.origin}/bff`);
  });

  test("getPortalUrl points to tenant workspace on portal domain", () => {
    expect(getPortalUrl()).toBe("https://user.autional.cn/nextchat-demo");
  });
});

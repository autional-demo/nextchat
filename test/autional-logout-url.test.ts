import {
  AUTIONAL_APP_ID,
  AUTIONAL_AUTH_BASE,
  AUTIONAL_ISSUER,
  AUTIONAL_LOGOUT_CONFIRM_PATH,
  AUTIONAL_LOGOUT_PATH,
} from "../app/autional/config";
import { buildStandardLogoutUrl } from "../app/autional/logout";

function makeIdToken(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: "user-1", exp: expSeconds }));
  return `${header}.${payload}.signature`;
}

const CONFIRM_PAGE = `${AUTIONAL_AUTH_BASE}${AUTIONAL_LOGOUT_CONFIRM_PATH}`;

describe("buildStandardLogoutUrl", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("uses standard logout endpoint when id_token_hint is available", () => {
    const token = makeIdToken(Math.floor(Date.now() / 1000) + 3600);
    window.localStorage.setItem(
      "autional_tokens",
      JSON.stringify({ idToken: token, accessToken: "at" }),
    );
    const url = new URL(buildStandardLogoutUrl());
    expect(url.origin + url.pathname).toBe(
      `${AUTIONAL_ISSUER}${AUTIONAL_LOGOUT_PATH}`,
    );
    expect(url.searchParams.get("id_token_hint")).toBe(token);
    expect(url.searchParams.get("client_id")).toBe(AUTIONAL_APP_ID);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      `${window.location.origin}/`,
    );
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  test("falls back to auth-host confirm page when stored idToken is expired", () => {
    const token = makeIdToken(Math.floor(Date.now() / 1000) - 60);
    window.localStorage.setItem(
      "autional_tokens",
      JSON.stringify({ idToken: token, accessToken: "at" }),
    );
    const url = new URL(buildStandardLogoutUrl());
    expect(url.origin + url.pathname).toBe(CONFIRM_PAGE);
    expect(url.searchParams.get("id_token_hint")).toBeNull();
    expect(url.searchParams.get("client_id")).toBe(AUTIONAL_APP_ID);
  });

  test("falls back to confirm page when no stored payload exists", () => {
    const url = new URL(buildStandardLogoutUrl());
    expect(url.origin + url.pathname).toBe(CONFIRM_PAGE);
    expect(url.searchParams.get("id_token_hint")).toBeNull();
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  test("falls back to confirm page when payload is malformed", () => {
    window.localStorage.setItem("autional_tokens", "{not-json");
    const url = new URL(buildStandardLogoutUrl());
    expect(url.origin + url.pathname).toBe(CONFIRM_PAGE);
    expect(url.searchParams.get("id_token_hint")).toBeNull();
  });

  test("falls back to confirm page when idToken is null (cleared/legacy payload)", () => {
    window.localStorage.setItem(
      "autional_tokens",
      JSON.stringify({ idToken: null, accessToken: "at" }),
    );
    const url = new URL(buildStandardLogoutUrl());
    expect(url.origin + url.pathname).toBe(CONFIRM_PAGE);
    expect(url.searchParams.get("id_token_hint")).toBeNull();
  });
});

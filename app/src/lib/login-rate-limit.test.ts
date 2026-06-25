import { describe, expect, it } from "vitest";
import { getLoginRateLimitIdentifier } from "@/lib/login-rate-limit";

describe("login rate limit identifier", () => {
  it("scopes attempts by IP and normalized email", () => {
    expect(getLoginRateLimitIdentifier(" 127.0.0.1 ", " Owner@NorthbridgeFuels.com ")).toBe(
      "login:127.0.0.1:owner@northbridgefuels.com"
    );
  });

  it("does not share buckets across different emails on the same IP", () => {
    const first = getLoginRateLimitIdentifier("127.0.0.1", "owner@northbridgefuels.com");
    const second = getLoginRateLimitIdentifier("127.0.0.1", "superadmin@axioneraglobal.com");

    expect(first).not.toBe(second);
  });
});

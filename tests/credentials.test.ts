import { describe, expect, it } from "vitest";
import { decryptPassword, protectPassword, verifyPassword } from "@/lib/server/credentials";

const key = Buffer.alloc(32, 7).toString("base64url");

describe("credential protection", () => {
  it("stores a login hash and independently encrypted recoverable copy", async () => {
    const protectedPassword = await protectPassword("Rahasia!234", key);
    expect(protectedPassword.passwordHash).not.toContain("Rahasia!234");
    expect(protectedPassword.passwordEncrypted).not.toContain("Rahasia!234");
    await expect(verifyPassword("Rahasia!234", protectedPassword.passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("salah", protectedPassword.passwordHash)).resolves.toBe(false);
    expect(decryptPassword(protectedPassword.passwordEncrypted, key)).toBe("Rahasia!234");
  });
});

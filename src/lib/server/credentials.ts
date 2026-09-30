import { createCipheriv, createDecipheriv, randomBytes, scrypt as nodeScrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const KEY_LENGTH = 64;

function scrypt(password: string, salt: Buffer, length: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => nodeScrypt(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key)));
}

function encryptionKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10 || password.length > 128) throw new Error("Password must contain 10-128 characters");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });
  return ["scrypt", SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELIZATION, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, costText, blockText, parallelText, saltText, hashText] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !costText || !blockText || !parallelText || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  if (!expected.length) return false;
  try {
    const actual = await scrypt(password, Buffer.from(saltText, "base64url"), expected.length, {
      N: Number(costText), r: Number(blockText), p: Number(parallelText), maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function encryptPassword(password: string, encodedKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["aes-256-gcm", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join("$");
}

export function decryptPassword(value: string, encodedKey: string): string {
  const [algorithm, ivText, tagText, encryptedText] = value.split("$");
  if (algorithm !== "aes-256-gcm" || !ivText || !tagText || !encryptedText) throw new Error("Encrypted credential is malformed");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(encodedKey), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export async function protectPassword(password: string, encodedKey: string) {
  return { passwordHash: await hashPassword(password), passwordEncrypted: encryptPassword(password, encodedKey) };
}

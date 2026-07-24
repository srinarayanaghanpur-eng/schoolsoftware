import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.AI_SECRET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("Missing AI_SECRET_ENCRYPTION_KEY environment variable");
  }
  const hash = crypto.createHash("sha256").update(key).digest();
  return hash;
}

export function encrypt(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${tag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format");
  }
  const [ivHex, tagHex, data] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return apiKey;
  const first = apiKey.slice(0, 4);
  const last = apiKey.slice(-4);
  return `${first}${"*".repeat(apiKey.length - 8)}${last}`;
}

export function hasEncryptionKey(): boolean {
  return Boolean(process.env.AI_SECRET_ENCRYPTION_KEY);
}

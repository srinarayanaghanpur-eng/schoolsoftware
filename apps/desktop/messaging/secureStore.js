const fs = require("fs");
const path = require("path");

/**
 * Stores small secrets (SMS gateway token) outside the campaign database.
 * Uses Electron safeStorage when available; falls back to base64 only for
 * development environments where OS encryption is unavailable.
 */
class SecureStore {
  constructor(filePath, safeStorage) {
    this.filePath = filePath;
    this.safeStorage = safeStorage || null;
    this.data = {};
  }

  init() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.data = {};
      this.save();
      return;
    }
    try {
      this.data = JSON.parse(fs.readFileSync(this.filePath, "utf8")) || {};
    } catch {
      this.data = {};
      this.save();
    }
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
  }

  encryptionAvailable() {
    try {
      return Boolean(this.safeStorage && this.safeStorage.isEncryptionAvailable());
    } catch {
      return false;
    }
  }

  encode(value) {
    if (this.encryptionAvailable()) {
      return {
        encrypted: true,
        value: this.safeStorage.encryptString(String(value)).toString("base64")
      };
    }
    return {
      encrypted: false,
      value: Buffer.from(String(value), "utf8").toString("base64")
    };
  }

  decode(record) {
    if (!record || typeof record.value !== "string") return "";
    try {
      if (record.encrypted) {
        if (!this.encryptionAvailable()) return "";
        return this.safeStorage.decryptString(Buffer.from(record.value, "base64"));
      }
      return Buffer.from(record.value, "base64").toString("utf8");
    } catch {
      return "";
    }
  }

  get(name) {
    return this.decode(this.data[name]);
  }

  has(name) {
    return Boolean(this.get(name));
  }

  set(name, value) {
    const text = String(value ?? "");
    if (!text) {
      delete this.data[name];
    } else {
      this.data[name] = this.encode(text);
    }
    this.save();
  }

  clear(name) {
    delete this.data[name];
    this.save();
  }
}

module.exports = { SecureStore };

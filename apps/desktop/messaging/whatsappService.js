const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const makeWASocket = require("baileys").default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("baileys");
const { normalizePhone } = require("./recipients");

const silentLogger = {
  level: "silent",
  child() {
    return this;
  },
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {}
};

function whatsappJid(phone) {
  const digits = normalizePhone(phone);
  if (!digits) throw new Error("Invalid WhatsApp phone number");
  return `${digits}@s.whatsapp.net`;
}

function whatsappLink(phone, message) {
  const digits = normalizePhone(phone);
  if (!digits) throw new Error("Invalid WhatsApp phone number");
  return `https://wa.me/${digits}?text=${encodeURIComponent(String(message || ""))}`;
}

class WhatsAppService {
  constructor({ authDir }) {
    this.authDir = authDir;
    this.socket = null;
    this.status = "disconnected";
    this.connected = false;
    this.qrDataUrl = "";
    this.me = "";
    this.error = "";
    this.manualStop = false;
    this.generation = 0;
    this.reconnectTimer = null;
    this.connectPromise = null;
  }

  state() {
    return {
      status: this.status,
      connected: this.connected,
      qrDataUrl: this.qrDataUrl,
      me: this.me,
      error: this.error,
      hasAuth: Boolean(this.authDir && fs.existsSync(this.authDir))
    };
  }

  async start() {
    if (this.socket || this.connectPromise) return this.state();
    this.connectPromise = this.connect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  async connect() {
    this.manualStop = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.generation += 1;
    const generation = this.generation;
    this.status = "connecting";
    this.connected = false;
    this.error = "";

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {
      version = undefined;
    }

    if (generation !== this.generation) return this.state();

    const socket = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      logger: silentLogger,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false
    });

    this.socket = socket;
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", (update) => {
      if (generation !== this.generation) return;
      void this.handleUpdate(update, generation);
    });

    return this.state();
  }

  async handleUpdate(update, generation) {
    const { connection, lastDisconnect, qr } = update || {};
    if (generation !== this.generation) return;

    if (qr) {
      this.status = "qr";
      this.connected = false;
      this.error = "";
      try {
        this.qrDataUrl = await QRCode.toDataURL(qr, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 320
        });
      } catch {
        this.qrDataUrl = "";
      }
    }

    if (connection === "connecting") {
      this.status = "connecting";
    }

    if (connection === "open") {
      this.status = "connected";
      this.connected = true;
      this.qrDataUrl = "";
      this.error = "";
      this.me = String(this.socket?.user?.id || "").split(":")[0];
      return;
    }

    if (connection !== "close") return;

    const statusCode = lastDisconnect?.error?.output?.statusCode;
    this.socket = null;
    this.connected = false;
    this.qrDataUrl = "";
    this.me = "";

    if (this.manualStop) {
      this.status = "disconnected";
      return;
    }

    if (statusCode === DisconnectReason.loggedOut) {
      this.status = "logged_out";
      this.error = "WhatsApp was logged out. Reset the session and scan the QR code again.";
      return;
    }

    this.status = "reconnecting";
    this.error = "WhatsApp connection closed. Reconnecting...";
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.start();
    }, 4000);
  }

  async sendText(phone, message) {
    if (!this.connected || !this.socket) {
      return {
        ok: false,
        retryable: false,
        messageId: "",
        error: "WhatsApp is not connected. Connect it in Settings and scan the QR code."
      };
    }

    try {
      const jid = whatsappJid(phone);
      const sent = await this.socket.sendMessage(jid, { text: String(message || "") });
      return {
        ok: true,
        retryable: false,
        messageId: String(sent?.key?.id || sent?.id || ""),
        error: ""
      };
    } catch (error) {
      return {
        ok: false,
        retryable: true,
        messageId: "",
        error: error instanceof Error ? error.message : "WhatsApp send failed"
      };
    }
  }

  async logout() {
    this.manualStop = true;
    this.generation += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try {
      await this.socket?.logout();
    } catch {
      // Best effort only.
    }
    try {
      this.socket?.end(undefined);
    } catch {
      // Best effort only.
    }
    this.socket = null;
    this.connected = false;
    this.qrDataUrl = "";
    this.me = "";
    this.status = "disconnected";
    this.error = "";
    fs.rmSync(this.authDir, { recursive: true, force: true });
    return this.state();
  }

  async reset() {
    this.manualStop = true;
    this.generation += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try {
      this.socket?.end(undefined);
    } catch {
      // Best effort only.
    }
    this.socket = null;
    this.connected = false;
    this.qrDataUrl = "";
    this.me = "";
    this.status = "disconnected";
    this.error = "";
    fs.rmSync(this.authDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(this.authDir), { recursive: true });
    return this.start();
  }

  stop() {
    this.manualStop = true;
    this.generation += 1;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try {
      this.socket?.end(undefined);
    } catch {
      // Best effort only.
    }
    this.socket = null;
    this.connected = false;
    this.qrDataUrl = "";
    this.me = "";
    this.status = "disconnected";
  }
}

module.exports = {
  WhatsAppService,
  whatsappJid,
  whatsappLink
};

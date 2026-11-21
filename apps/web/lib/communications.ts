export const SMS_PROVIDERS = [
  { value: "ctrlshiftm", label: "CtrlShiftM" },
  { value: "msg91", label: "MSG91" },
  { value: "custom", label: "Custom HTTP API" }
] as const;

export type SmsProvider = (typeof SMS_PROVIDERS)[number]["value"];

export type CommunicationSettings = {
  smsEnabled: boolean;
  smsProvider: SmsProvider;
  smsApiUrl: string;
  smsApiKey: string;
  smsSenderId: string;
  smsTemplateId: string;
  whatsappEnabled: boolean;
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  whatsappTemplateName: string;
  whatsappLanguage: string;
  autoSendEnabled: boolean;
};

export const DEFAULT_COMMUNICATION_SETTINGS: CommunicationSettings = {
  smsEnabled: false,
  smsProvider: "ctrlshiftm",
  smsApiUrl: "",
  smsApiKey: "",
  smsSenderId: "",
  smsTemplateId: "",
  whatsappEnabled: false,
  whatsappToken: "",
  whatsappPhoneNumberId: "",
  whatsappTemplateName: "",
  whatsappLanguage: "en",
  autoSendEnabled: false
};

export const MASKED_SECRET = "********";

export function normalizeCommunicationSettings(raw: Record<string, unknown> | undefined | null): CommunicationSettings {
  const source = raw ?? {};
  const pick = <T extends string | boolean>(key: keyof CommunicationSettings, fallback: T): T => {
    const value = source[key as string];
    return (value === undefined ? fallback : (typeof fallback === "boolean" ? Boolean(value) : String(value))) as T;
  };
  const provider = String(source.smsProvider ?? DEFAULT_COMMUNICATION_SETTINGS.smsProvider);
  return {
    smsEnabled: pick("smsEnabled", DEFAULT_COMMUNICATION_SETTINGS.smsEnabled),
    smsProvider: (SMS_PROVIDERS.some((item) => item.value === provider) ? provider : "custom") as SmsProvider,
    smsApiUrl: pick("smsApiUrl", ""),
    smsApiKey: String(source.smsApiKey ?? ""),
    smsSenderId: pick("smsSenderId", ""),
    smsTemplateId: pick("smsTemplateId", ""),
    whatsappEnabled: pick("whatsappEnabled", DEFAULT_COMMUNICATION_SETTINGS.whatsappEnabled),
    whatsappToken: String(source.whatsappToken ?? ""),
    whatsappPhoneNumberId: pick("whatsappPhoneNumberId", ""),
    whatsappTemplateName: pick("whatsappTemplateName", ""),
    whatsappLanguage: String(source.whatsappLanguage ?? "en"),
    autoSendEnabled: pick("autoSendEnabled", DEFAULT_COMMUNICATION_SETTINGS.autoSendEnabled)
  };
}

export function maskCommunicationSettings(settings: CommunicationSettings): CommunicationSettings {
  return {
    ...settings,
    smsApiKey: settings.smsApiKey ? MASKED_SECRET : "",
    whatsappToken: settings.whatsappToken ? MASKED_SECRET : ""
  };
}

export function keepSecret(incoming: unknown, stored: unknown): string {
  const value = String(incoming ?? "");
  if (!value || value === MASKED_SECRET) return String(stored ?? "");
  return value;
}

export function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/[^\d]/g, "");
}

export function toWhatsAppNumber(value: unknown): string {
  let digits = normalizePhone(value);
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.startsWith("0") && digits.length === 11) digits = `91${digits.slice(1)}`;
  return digits;
}

export function maskPhone(value: unknown): string {
  const digits = normalizePhone(value);
  if (digits.length <= 4) return digits;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function smsSegments(message: string): number {
  return Math.max(1, Math.ceil(message.length / 160));
}

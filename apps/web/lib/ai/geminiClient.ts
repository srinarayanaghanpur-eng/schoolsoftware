import "server-only";

import { GoogleGenAI } from "@google/genai";
import { adminDb } from "@/lib/firebaseAdmin";
import { decrypt, hasEncryptionKey } from "./encryption";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

export type GeminiConfig = {
  model: string;
  temperature: number;
  maxOutputTokens: number;
};

export type AiSettingsDoc = {
  enabled: boolean;
  provider: "gemini";
  encryptedApiKey: string;
  maskedApiKey: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  features: {
    feeReminder: boolean;
    noticeGenerator: boolean;
    reportSummary: boolean;
    studentSummary: boolean;
  };
  updatedBy: string;
  updatedAt: FirebaseFirestore.FieldValue;
  createdAt: FirebaseFirestore.FieldValue;
};

async function getApiKey(): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  if (!hasEncryptionKey()) {
    throw new Error("Gemini API key is not configured. Please add it in AI Settings.");
  }

  try {
    const db = adminDb();
    const snapshot = await db.collection("aiSettings").doc("default-school").get();
    if (!snapshot.exists) {
      throw new Error("Gemini API key is not configured. Please add it in AI Settings.");
    }
    const data = snapshot.data() as AiSettingsDoc;
    if (!data?.encryptedApiKey) {
      throw new Error("Gemini API key is not configured. Please add it in AI Settings.");
    }
    return decrypt(data.encryptedApiKey);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Gemini API key is not configured")) {
      throw error;
    }
    throw new Error("Gemini API key is not configured. Please add it in AI Settings.");
  }
}

export function getGeminiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

export async function getGeminiConfig(): Promise<GeminiConfig> {
  try {
    const db = adminDb();
    const snapshot = await db.collection("aiSettings").doc("default-school").get();
    if (snapshot.exists) {
      const data = snapshot.data() as AiSettingsDoc;
      return {
        model: data.model || DEFAULT_MODEL,
        temperature: typeof data.temperature === "number" ? data.temperature : DEFAULT_TEMPERATURE,
        maxOutputTokens: typeof data.maxOutputTokens === "number" ? data.maxOutputTokens : DEFAULT_MAX_OUTPUT_TOKENS,
      };
    }
  } catch {
    // fall through to defaults
  }
  return {
    model: DEFAULT_MODEL,
    temperature: DEFAULT_TEMPERATURE,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
  };
}

export async function createAiClient() {
  const apiKey = await getApiKey();
  const config = await getGeminiConfig();
  const client = getGeminiClient(apiKey);
  return { client, config };
}

export async function testGeminiConnection(apiKey: string): Promise<boolean> {
  try {
    const client = getGeminiClient(apiKey);
    const response = await client.models.generateContent({
      model: DEFAULT_MODEL,
      contents: "Reply only: Gemini connected.",
    });
    const text = response.text?.trim().toLowerCase() || "";
    return text.includes("gemini connected");
  } catch {
    return false;
  }
}

export { DEFAULT_MODEL, DEFAULT_TEMPERATURE, DEFAULT_MAX_OUTPUT_TOKENS };

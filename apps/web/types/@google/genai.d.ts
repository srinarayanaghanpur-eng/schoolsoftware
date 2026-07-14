declare module "@google/genai" {
  export interface GenerateContentRequest {
    model: string;
    contents: string | Array<{ role: string; parts: Array<{ text: string }> }>;
    config?: {
      systemInstruction?: { text: string; role?: string };
      temperature?: number;
      maxOutputTokens?: number;
    };
  }

  export interface GenerateContentResponse {
    text?: string;
    usageMetadata?: Record<string, unknown>;
  }

  export interface Models {
    generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse>;
  }

  export interface GoogleGenAIOptions {
    apiKey: string;
  }

  export class GoogleGenAI {
    constructor(options: GoogleGenAIOptions);
    models: Models;
  }

  export interface BaseUrlParams {
    geminiUrl?: string;
    vertexUrl?: string;
  }

  export function setDefaultBaseUrls(baseUrlParams: BaseUrlParams): void;
}

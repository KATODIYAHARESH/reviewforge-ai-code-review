import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
  gemini: "gemini-2.5-flash",
};

export interface ResolvedModel {
  model: LanguageModel;
  provider: string;
  modelId: string;
}

/**
 * Builds the language model from server-only env vars.
 * LLM_PROVIDER: "openai" | "anthropic" (default openai)
 * LLM_MODEL:    provider model id (optional, has per-provider default)
 * LLM_API_KEY:  secret, server-side only
 */
export function resolveModel(): ResolvedModel {
  const provider = (process.env.LLM_PROVIDER ?? "google").toLowerCase();
  const apiKey =
    process.env.LLM_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new LlmConfigError(
      "No API key is set on the server. Set LLM_API_KEY or a provider-specific key such as GEMINI_API_KEY.",
    );
  }

  const modelId = process.env.LLM_MODEL || DEFAULT_MODELS[provider];
  if (!modelId) {
    throw new LlmConfigError(
      `Unsupported LLM_PROVIDER "${provider}". Use "openai", "anthropic", or "google".`,
    );
  }

  switch (provider) {
    case "openai":
      return { model: createOpenAI({ apiKey }).chat(modelId), provider, modelId };
    case "anthropic":
      return { model: createAnthropic({ apiKey })(modelId), provider, modelId };
    case "google":
    case "gemini":
      return { model: createGoogle({ apiKey }).chat(modelId), provider: "google", modelId };
    default:
      throw new LlmConfigError(
        `Unsupported LLM_PROVIDER "${provider}". Use "openai", "anthropic", or "google".`,
      );
  }
}

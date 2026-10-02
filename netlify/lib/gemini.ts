import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env.js";

/*
 * Gemini client wired to Netlify AI Gateway with explicit credentials.
 *
 * `new GoogleGenAI({})` relies on the gateway having injected GEMINI_API_KEY
 * and GOOGLE_GEMINI_BASE_URL into the invocation. When an invocation landed
 * without them, the SDK did not fail fast: it fell back to Google Cloud
 * Application Default Credentials, which do not exist on Netlify, and threw
 * "Could not load the default credentials". The chat answered 502 on roughly
 * a third of requests that way, on desktop and mobile alike.
 *
 * Passing the key and base URL explicitly keeps the SDK on the API-key path,
 * and falling back to the gateway's own NETLIFY_AI_GATEWAY_* variables (always
 * set, and serving the Gemini REST API directly at its base URL) covers the
 * invocations where the provider-specific pair is missing.
 */
export const createGeminiClient = (): GoogleGenAI | null => {
  const providerKey = getEnv("GEMINI_API_KEY");
  const apiKey = providerKey || getEnv("NETLIFY_AI_GATEWAY_KEY");
  const baseUrl = (
    providerKey
      ? getEnv("GOOGLE_GEMINI_BASE_URL") || getEnv("NETLIFY_AI_GATEWAY_BASE_URL")
      : getEnv("NETLIFY_AI_GATEWAY_BASE_URL")
  ).replace(/\/$/, "");

  if (!apiKey) {
    console.error("AI Gateway credentials are missing from this invocation.");
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  });
};

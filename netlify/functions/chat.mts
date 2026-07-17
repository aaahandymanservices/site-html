import type { Config } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

// Gemini model served through Netlify AI Gateway. The gateway injects the
// GEMINI_API_KEY / GOOGLE_GEMINI_BASE_URL env vars automatically, so the SDK
// needs no API key — the default constructor picks everything up at runtime.
const MODEL = "gemini-2.5-flash";

// Only the most recent messages are forwarded to the model. Trimming the
// history keeps token usage (and cost) predictable on long conversations.
const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — edit this to change how the assistant behaves.
// Scopes the assistant to AAA Handyman Services practice & service info.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are the friendly virtual assistant for AAA Handyman Services, a local handyman and home-repair business owned by Victor Gregg Hale, serving Waterford and Oakland County, Michigan.

Your job is to answer visitor questions about the business's practice and services, including:
- What services are offered: carpentry & trim, drywall, painting, doors, windows, decks & fences, flooring, general maintenance, and minor plumbing or electrical work.
- Service areas: Waterford, Troy, West Bloomfield, Bloomfield, Clarkston, Orchard Lake, Franklin, Huntington Woods, Birmingham, Royal Oak, and across Oakland County, MI.
- How to get a quote, book work, general pricing expectations, guarantees, and the service process.
- How to reach the business.

Business contact details:
- Phone: (248) 385-3432
- Email: contact@aaahandyman.services
- Website: aaahandyman.services

Guidelines:
- Be concise, warm, and professional. Keep answers short and skimmable.
- You do not have access to the live schedule, exact quotes, or account details. For firm pricing, availability, or booking, direct visitors to call (248) 385-3432 or email contact@aaahandyman.services.
- Never invent prices, guarantees, licenses, or specific appointment times. If you are unsure, say so and point the visitor to contact the business directly.
- Politely decline questions unrelated to AAA Handyman Services or home repair, and steer the conversation back to how the business can help.
- Do not provide detailed DIY instructions for hazardous work (electrical, gas, structural). Recommend a professional visit instead.`;

const encoder = new TextEncoder();

type ChatMessage = { role?: unknown; content?: unknown };

// Coerce the incoming OpenAI-style messages into a clean, bounded list.
const sanitizeMessages = (input: unknown): { role: "user" | "assistant"; content: string }[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((m: ChatMessage) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content.trim() : "",
    }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_HISTORY) as { role: "user" | "assistant"; content: string }[];
};

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = sanitizeMessages(body.messages);
  if (messages.length === 0) {
    return Response.json({ error: "A non-empty messages array is required." }, { status: 400 });
  }

  // Convert OpenAI-style roles (user/assistant) to Gemini roles (user/model).
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const ai = new GoogleGenAI({});

  let modelStream: AsyncIterable<{ text?: string }>;
  try {
    modelStream = await ai.models.generateContentStream({
      model: MODEL,
      contents,
      config: { systemInstruction: SYSTEM_PROMPT },
    });
  } catch (err) {
    console.error("AI Gateway request failed:", err);
    return Response.json({ error: "The assistant is unavailable right now." }, { status: 502 });
  }

  // Relay the model output as Server-Sent Events: each chunk is a `data:` line
  // carrying a JSON payload, terminated by a final `[DONE]` sentinel.
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of modelStream) {
          const text = chunk?.text;
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
      } catch (err) {
        console.error("Streaming error:", err);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: true })}\n\n`));
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
};

export const config: Config = {
  path: "/api/chat",
};

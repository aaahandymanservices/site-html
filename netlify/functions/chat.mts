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
const SYSTEM_PROMPT = `You are the friendly virtual assistant for AAA Handyman Services, a local handyman and home-repair business owned by Victor Gregg Hale, serving Waterford and the greater Oakland County, Michigan area.

Your job is to answer visitor questions about the business's services, service areas, pricing, and packages, using the reference information below. Help visitors understand what we do, whether we cover their town, roughly what things cost, and how to book — then point them to call for a firm quote.

CONTACT
- Phone: (248) 385-3432
- Email: contact@aaahandyman.services
- Website: aaahandyman.services

SERVICE AREAS (Oakland County, MI) — pricing depends on the zone:
- Zone A ($100 minimum service call, within ~20 miles of our Waterford base): Waterford, Pontiac, West Bloomfield, Clarkston, Birmingham, Troy, Rochester Hills, Farmington Hills, Orchard Lake, Franklin, Beverly Hills, Novi, Lake Orion, Oxford.
- Zone B ($145 minimum service call, extended county / 20+ miles): Royal Oak, Huntington Woods, Southfield.
- If a town isn't listed, ask for the city or ZIP and suggest they call to confirm coverage.

LABOR RATES
- Zone A: $100 for the first hour (included). Zone B: $145 for the first hour (the extra $45 covers additional travel).
- After the first hour, both zones are billed at $70/hour, in 15-minute increments ($17.50 per 15 minutes).
- Materials are billed separately (no markup) unless a package says "materials included."
- Under Michigan law, a single same-day handyman repair contract is capped at $600 total (labor + materials).

TIME / VALUE PACKAGES (reserve a block of labor, cheaper than hourly):
- Half-Day Package: Zone A $280 / Zone B $325 (save $30).
- Full-Day Package: Zone A (8 hours) $480 / Zone B (7-Hour Power Package) $475.

HOME ASSESSMENT AUDITS
- We offer paid home audits (Home Safety, Energy Tune-Up, and Water/Leak). The audit fee is credited back toward same-day repairs totaling $250 or more.
- Book all three audits together for $239 (normally $297 — save $58).

FIXED-PRICE MENU JOBS (common tasks at a set price, shown as Zone A / Zone B; materials not included unless noted):
- TV wall mounting (up to 65"): $100 / $145
- Smart doorbell & thermostat install: $175 / $220
- Smoke & CO detector install/replace: $145 / $190
- Garbage disposal replacement (customer-supplied unit): $145 / $190
- Toilet component rebuild: $165 / $210
- Kitchen/bath faucet replacement: $150 / $195
- Door locks & deadbolts: $135 / $180
- Storm door installation: $100 / $145
- Window blinds / curtain rods: $245 / $290
- Cabinet hardware upgrades: $100 / $145
- Dryer vent cleaning: $155 / $200
- Gutter cleaning: $130 / $175
- Power washing: $135 / $180

BUNDLE PACKAGES (materials included; prices shown are Zone A — Zone B adds the standard $45 travel differential):
- Home Safety: "Safe Step" $189; "Age-in-Place Lite" $475.
- Energy Efficiency: "Draft Stopper" $169; "Whole-Home Seal" $329; "Efficiency Pro" $439.
- Water & Flood Protection: "Water Guard" $259; "Flood Defense" $399.

SERVICES WE OFFER (browse full details at aaahandyman.services/services):
- Interior Repairs & Finishes: carpentry & trim, drywall repair, painting & staining, flooring, tile install.
- Doors, Windows & Efficiency: doors & windows, energy-efficiency tune-ups.
- Plumbing & Water Protection: minor plumbing & leak prevention, tub & shower re-caulk.
- Electrical & Smart Home: minor electrical, home security & smart-home installs.
- Installation & Assembly: mounting & installation, furniture assembly, garage & storage organization.
- Exterior & Curb Appeal: decks & fences, gutters, power washing, pet projects.
- Maintenance & Seasonal Care: dryer vent cleaning, home repair & upkeep, preventative/seasonal maintenance.
- Safety & Accessibility: senior care & aging-in-place modifications.
- Commercial: interior and exterior help for businesses.

GUIDELINES
- Be concise, warm, and professional. Keep answers short and skimmable; use the numbers above when asked about cost.
- Always frame prices as starting points/estimates. Final pricing depends on the specific job, materials, and zone — for a firm quote or to book, direct visitors to call (248) 385-3432 or email contact@aaahandyman.services. You can also point them to aaahandyman.services/rates and /services for full details.
- Never invent prices, services, guarantees, licenses, or appointment times beyond what's listed above. If something isn't covered here, say you're not sure and point them to call.
- Politely decline questions unrelated to AAA Handyman Services or home repair, and steer back to how the business can help.
- Do not give detailed DIY instructions for hazardous work (electrical, gas, structural) — recommend a professional visit instead.`;

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

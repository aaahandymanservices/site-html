import type { Config } from "@netlify/functions";
import { GoogleGenAI, createPartFromBase64 } from "@google/genai";
import { getStore } from "@netlify/blobs";
import { db } from "../../db/index.js";
import { aiEstimates } from "../../db/schema.js";
import { resolveServiceLocation } from "../lib/service-area.js";

// Gemini model served through Netlify AI Gateway. The gateway injects
// GEMINI_API_KEY / GOOGLE_GEMINI_BASE_URL automatically, so the default
// constructor needs no key at runtime.
const MODEL = "gemini-2.5-flash";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// The estimator accepts a primary photo plus up to two optional extra angles
// (a wide/context shot and an additional angle). Only the primary photo is
// sent to the model; the others are stored for the human dispatch review.
const MAX_PHOTOS = 3;
const MAX_NAME_LENGTH = 120;
const MAX_ADDRESS_LENGTH = 160;
const MAX_CITY_LENGTH = 80;

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

const errorJson = (message: string, status = 500) =>
  json({ error: message }, { status });

const contentTypeFor = (key: string) => {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
};

// ---------------------------------------------------------------------------
// SYSTEM PROMPT — scopes Gemini as the AAA Handyman Services construction &
// handyman estimator. It returns a strict JSON object the page renders in the
// exact output format the brief specifies.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are the AI Construction & Handyman Estimator for AAA Handyman Services LLC, a local handyman and home-repair business based in Waterford, Michigan, serving Waterford and the greater Oakland County area.

AAA Handyman Services LLC labor rates (use these to ground every estimate):
- Zone A (within ~20 miles of Waterford): $100 first hour / $70 per additional hour.
- Zone B (extended Oakland County, 20+ miles): $145 first hour / $115 per additional hour (the $45 Zone B travel differential is already baked into the first hour).
- After-hours emergency service: $155 first hour / $100 per additional hour.
- Materials are ALWAYS billed separately and never included in a labor price. Supply them yourself at no markup, or have us source them with a standard 20% supply markup. When you list materials, give a rough materials-only dollar guess separate from labor.

YOUR JOB
1. Examine the uploaded photo or video frame carefully.
2. Identify the specific damage or repair needed (e.g., Drywall Repair, Minor Plumbing, Carpentry, Door/Window Adjustment, Deck Maintenance, Gutter Cleaning, Caulking, Trim Work, Tile Repair).
3. Estimate spatial measurements from what is visible (approximate hole size, square footage, pipe diameter, board length, etc.). State clearly these are visual estimates subject to an in-person check.
4. List required materials or supplies.
5. Estimate labor time using standard handyman production rates, and output a preliminary price range (labor + estimated materials) in whole US dollars.
6. Flag anything out of minor scope (major structural damage, full roof replacement, major electrical service panels, unpermitted work, HVAC, gas line work, full re-pipes, foundation issues) as "Requires In-Scope Inspection / Out of Minor Scope" and set outOfScope true. For those, still give a best-guess range but make clear a human tech must inspect.
7. Note potential hidden/unseen complications.

Never invent services, licenses, or guarantees AAA Handyman does not offer. Frame every dollar figure as a PRELIMINARY estimate subject to an in-person inspection and final confirmation by the human dispatch team.

OUTPUT FORMAT — respond with ONLY a single JSON object, no markdown, no prose outside the JSON. Use exactly these keys:
{
  "detectedIssue": "brief one-line summary of the damage, e.g. \\"~6 x 6 inch drywall puncture near baseboard\\"",
  "serviceCategory": "e.g. Drywall Repair",
  "estimatedMaterials": ["item 1", "item 2"],
  "estimatedLaborDuration": "e.g. 1.5 to 2 hours",
  "priceLow": 150,
  "priceHigh": 225,
  "outOfScope": false,
  "outOfScopeReason": "null or a short reason if outOfScope is true",
  "technicianNotes": ["any key details or potential hidden risks"],
  "customerNextStep": "short friendly call to action"
}`;

export default async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { allow: "POST, OPTIONS" } });
  }
  if (request.method !== "POST") {
    return errorJson("This endpoint only accepts photo uploads for an estimate.", 405);
  }

  try {
    const formData = await request.formData();

    // Collect the primary photo plus up to two optional extra angles. The
    // form sends them as `photo`, `photo2`, `photo3`. Older callers that only
    // send `photo` keep working unchanged.
    const rawPhotos = [formData.get("photo"), formData.get("photo2"), formData.get("photo3")];
    const photos: File[] = [];
    for (const entry of rawPhotos) {
      if (entry == null) continue;
      // `formData.get` returns a File for file uploads and a string for plain
      // fields; a stray empty string here just means "no photo in this slot".
      if (typeof entry === "string") continue;
      if (entry.size === 0) continue;
      if (entry.size > MAX_IMAGE_SIZE) {
        return errorJson("Each photo must be 5 MB or smaller.", 400);
      }
      if (!IMAGE_TYPES.has(entry.type)) {
        return errorJson("Upload JPG, PNG, or WebP photos only.", 400);
      }
      photos.push(entry);
      if (photos.length > MAX_PHOTOS) {
        return errorJson("You can upload at most 3 photos.", 400);
      }
    }

    const photo = photos[0];
    if (!photo) {
      return errorJson("Please upload a photo of the repair so we can analyze it.", 400);
    }

    // Optional contact + location fields the customer may include on a first
    // pass (analyze) or a second pass (submit). All optional; the photo is the
    // only required input for an estimate.
    const customerName = String(formData.get("customerName") || "").trim().slice(0, MAX_NAME_LENGTH);
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const address = String(formData.get("address") || "").trim().slice(0, MAX_ADDRESS_LENGTH);
    const cityFromForm = String(formData.get("city") || "").trim().slice(0, MAX_CITY_LENGTH);
    const zip = String(formData.get("zip") || "").trim();
    const mode = String(formData.get("mode") || "analyze").trim();

    let location = null as null | ReturnType<typeof resolveServiceLocation>;
    if (zip) {
      location = resolveServiceLocation(zip);
      if (!location) {
        return errorJson("Please provide a valid 5-digit ZIP code.", 400);
      }
      if (!location.served) {
        return errorJson(
          "That ZIP code is outside our Oakland County service area. Call us at (248) 385-3432 and we'll let you know if we can make the trip.",
          400,
        );
      }
    }

    // Store every uploaded photo in Netlify Blobs so a human tech can pull
    // them up later during the in-person follow-up, exactly like the booking
    // photos. Only the primary photo is sent to the model for analysis; the
    // others are reference angles for dispatch.
    const photoStore = getStore("ai-estimate-photos");
    const storedKeys: string[] = [];
    const storePhoto = async (file: File) => {
      const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
      const key = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
      await photoStore.set(key, await file.arrayBuffer());
      storedKeys.push(key);
      return key;
    };

    const photoKey = await storePhoto(photo);
    const photoKey2 = photos[1] ? await storePhoto(photos[1]) : null;
    const photoKey3 = photos[2] ? await storePhoto(photos[2]) : null;

    // Best-effort cleanup of every blob already written if anything below
    // throws, so an orphaned photo never outlives the request that failed.
    const cleanupStoredPhotos = () =>
      Promise.all(storedKeys.map((k) => photoStore.delete(k).catch(() => undefined)));

    // Send the primary photo to Gemini for visual analysis.
    const imageBase64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
    const ai = new GoogleGenAI({});

    let modelText = "";
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          { role: "user", parts: [createPartFromBase64(imageBase64, photo.type)] },
        ],
        config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json" },
      });
      modelText = (response.text ?? "").trim();
    } catch (err) {
      console.error("AI Gateway vision request failed:", err);
      await cleanupStoredPhotos();
      return errorJson(
        "We couldn't analyze the photo right now. Please try again in a moment, or call us at (248) 385-3432.",
        502,
      );
    }

    // Parse the strict JSON the model was asked to emit. If it is malformed we
    // still surface a friendly failure rather than crashing, and drop the blobs.
    let parsed: any;
    try {
      parsed = JSON.parse(modelText);
    } catch {
      console.error("Model returned non-JSON:", modelText.slice(0, 500));
      await cleanupStoredPhotos();
      return errorJson(
        "The estimate came back in a format we couldn't read. Please try a clearer photo, or call us at (248) 385-3432.",
        502,
      );
    }

    const detectedIssue = String(parsed.detectedIssue ?? "").trim();
    const serviceCategory = String(parsed.serviceCategory ?? "").trim();
    const materials = Array.isArray(parsed.estimatedMaterials)
      ? parsed.estimatedMaterials.map((m: unknown) => String(m)).filter(Boolean)
      : [];
    const laborDuration = String(parsed.estimatedLaborDuration ?? "").trim();
    const priceLow = Number.isFinite(parsed.priceLow) ? Math.round(parsed.priceLow) : null;
    const priceHigh = Number.isFinite(parsed.priceHigh) ? Math.round(parsed.priceHigh) : null;
    const outOfScope = Boolean(parsed.outOfScope);
    const outOfScopeReason = parsed.outOfScopeReason ? String(parsed.outOfScopeReason) : null;
    const technicianNotes = Array.isArray(parsed.technicianNotes)
      ? parsed.technicianNotes.map((n: unknown) => String(n)).filter(Boolean)
      : [];
    const customerNextStep = String(parsed.customerNextStep ?? "").trim();

    // Render the canonical output block once, here, so the page, the stored
    // row, and the dispatch review all read the same text.
    const estimateText = renderEstimateText({
      detectedIssue,
      serviceCategory,
      materials,
      laborDuration,
      priceLow,
      priceHigh,
      outOfScope,
      outOfScopeReason,
      technicianNotes,
      customerNextStep,
    });

    const [row] = await db
      .insert(aiEstimates)
      .values({
        customerName: customerName || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: (location?.city || cityFromForm) || null,
        zip: location ? location.zip : zip || null,
        detectedIssue: detectedIssue || null,
        serviceCategory: serviceCategory || null,
        estimateText,
        priceLow,
        priceHigh,
        outOfScope,
        photoKey,
        photoKey2,
        photoKey3,
        status: mode === "submit" ? "submitted" : "pending",
      })
      .returning();

    return json({
      estimate: {
        id: row.id,
        detectedIssue,
        serviceCategory,
        estimatedMaterials: materials,
        estimatedLaborDuration: laborDuration,
        priceLow,
        priceHigh,
        outOfScope,
        outOfScopeReason,
        technicianNotes,
        customerNextStep,
        rendered: estimateText,
      },
      photoUrl: `/api/ai-estimate/photo/${photoKey}`,
      photoUrls: storedKeys.map((k) => `/api/ai-estimate/photo/${k}`),
      submitted: mode === "submit",
    }, { status: 201 });
  } catch (err: any) {
    console.error("AI estimate failed:", err);
    return errorJson(
      err?.message || "We couldn't generate an estimate just now. Please try again, or call us at (248) 385-3432.",
      500,
    );
  }
};

function renderEstimateText(input: {
  detectedIssue: string;
  serviceCategory: string;
  materials: string[];
  laborDuration: string;
  priceLow: number | null;
  priceHigh: number | null;
  outOfScope: boolean;
  outOfScopeReason: string | null;
  technicianNotes: string[];
  customerNextStep: string;
}): string {
  const { detectedIssue, serviceCategory, materials, laborDuration, priceLow, priceHigh,
    outOfScope, outOfScopeReason, technicianNotes, customerNextStep } = input;

  const lines: string[] = [];
  lines.push(`**Detected Issue:** ${detectedIssue || "Not clearly identifiable from the photo — an in-person inspection is recommended."}`);
  lines.push(`**Service Category:** ${serviceCategory || "General Handyman Repair"}`);
  lines.push("**Estimated Materials Needed:**");
  if (materials.length) {
    for (const m of materials) lines.push(`- ${m}`);
  } else {
    lines.push("- To be confirmed after in-person inspection");
  }
  lines.push(`**Estimated Labor Duration:** ${laborDuration || "To be determined on site"}`);

  if (priceLow != null && priceHigh != null) {
    lines.push(`**Preliminary Price Estimate:** $${priceLow} – $${priceHigh} *(Labor + Materials)*`);
  } else {
    lines.push("**Preliminary Price Estimate:** Requires In-Person Inspection");
  }

  if (outOfScope) {
    lines.push("");
    lines.push("**⚠️ Requires In-Person Inspection / Out of Minor Scope**");
    if (outOfScopeReason) lines.push(outOfScopeReason);
  }

  lines.push("");
  lines.push("**Technician Notes / Complications to Watch For:**");
  if (technicianNotes.length) {
    for (const n of technicianNotes) lines.push(`- ${n}`);
  } else {
    lines.push("- None noted from the photo; confirm scope on site.");
  }

  lines.push("");
  lines.push("**Customer Next Step:**");
  lines.push(
    customerNextStep ||
      "Click \"Submit Quote\" to send this AI assessment to our human dispatch team for final confirmation, or call us at (248) 385-3432.",
  );

  return lines.join("\n");
}

export const config: Config = {
  path: "/api/ai-estimate",
};

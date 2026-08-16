import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

/*
 * Serves a contact-quote repair photo back from Netlify Blobs. The path is
 * public so the owner can open a photo straight from the row, but it is only
 * ever linked from the dispatch workflow and the success screen -- the keys
 * are unguessable UUIDs, so the only way to reach a photo is to already know
 * the key from the contact_requests row that references it.
 */
const contentTypeFor = (key: string) => {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".gif")) return "image/gif";
  // The form no longer accepts HEIC, but photos stored while it did are still
  // referenced by contact_requests rows and have to keep serving correctly.
  if (key.endsWith(".heic")) return "image/heic";
  if (key.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
};

export default async (request: Request) => {
  let key = "";
  try {
    key = decodeURIComponent(new URL(request.url).pathname.replace("/api/contact-quote/photo/", ""));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (!key || key.includes("..") || key.includes("/")) {
    return new Response("Not found", { status: 404 });
  }

  const image = await getStore("contact-quote-photos").get(key, { type: "arrayBuffer" }).catch((error: unknown) => {
    console.error("contact quote photo lookup failed", error);
    return null;
  });

  if (!image) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  return new Response(image, {
    headers: {
      "content-type": contentTypeFor(key),
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
};

export const config: Config = {
  path: "/api/contact-quote/photo/:key",
};
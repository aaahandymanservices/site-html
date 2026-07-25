import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Strong consistency matters here: the reviews page re-renders the moment an
// upload returns, so the photo must be readable immediately. The default
// eventual store can take up to a minute to propagate, which shows the visitor
// a broken image for their own brand-new review.
const photoStore = () => getStore({ name: "customer-reviews", consistency: "strong" });

const contentTypeFor = (key: string) => {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
};

export default async (request: Request) => {
  let key = "";
  try {
    key = decodeURIComponent(new URL(request.url).pathname.replace("/api/reviews/photo/", ""));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (!key || key.includes("..") || key.includes("/")) {
    return new Response("Not found", { status: 404 });
  }

  const image = await photoStore().get(key, { type: "arrayBuffer" }).catch((error: unknown) => {
    console.error("review photo lookup failed", error);
    return null;
  });

  // A miss must never be cached. The Image CDN fetches through this route, and
  // a cached miss would pin a broken thumbnail for the life of the cache entry.
  if (!image) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  return new Response(image, {
    headers: {
      "content-type": contentTypeFor(key),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/api/reviews/photo/:key",
};

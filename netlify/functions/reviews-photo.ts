import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const contentTypeFor = (key: string) => {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
};

export default async (request: Request) => {
  const key = decodeURIComponent(new URL(request.url).pathname.replace("/api/reviews/photo/", ""));

  if (!key || key.includes("..") || key.includes("/")) {
    return new Response("Not found", { status: 404 });
  }

  const store = getStore("customer-reviews");
  const image = await store.get(key, { type: "arrayBuffer" });

  if (!image) {
    return new Response("Not found", { status: 404 });
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

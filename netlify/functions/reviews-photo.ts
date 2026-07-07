import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

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

  const image = await getStore("customer-reviews").get(key, { type: "arrayBuffer" }).catch((error) => {
    console.error("review photo lookup failed", error);
    return null;
  });

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

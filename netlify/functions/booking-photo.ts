import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const contentTypeFor = (key: string) => {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
};

export default async (request: Request) => {
  let key = "";
  try {
    key = decodeURIComponent(new URL(request.url).pathname.replace("/api/booking/photo/", ""));
  } catch {
    return new Response("Not found", { status: 404 });
  }

  if (!key || key.includes("..") || key.includes("/")) {
    return new Response("Not found", { status: 404 });
  }

  const image = await getStore("booking-repair-photos").get(key, { type: "arrayBuffer" }).catch((error: unknown) => {
    console.error("booking photo lookup failed", error);
    return null;
  });

  if (!image) {
    return new Response("Not found", { status: 404 });
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
  path: "/api/booking/photo/:key",
};

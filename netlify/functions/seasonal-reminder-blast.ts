import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { seasonalSubscribers } from "../../db/schema.js";

const json = (body: unknown, init?: ResponseInit) =>
  Response.json(body, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });

const errorJson = (message = "Something went wrong. Please try again soon.", status = 500) =>
  json({ error: message }, { status });

export default async (request: Request) => {
  // Allow GET to query or POST to execute the simulated email blast
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        allow: "GET, POST, OPTIONS",
      },
    });
  }

  try {
    const url = new URL(request.url);
    // Determine the month / touch-point to send
    // April (month index 3) -> Spring
    // October (month index 9) -> Fall
    // Or let the caller pass a custom query param `touch` (values: "spring" or "fall")
    let touch = url.searchParams.get("touch");

    if (!touch) {
      const currentMonth = new Date().getMonth();
      if (currentMonth >= 3 && currentMonth <= 8) {
        touch = "spring";
      } else {
        touch = "fall";
      }
    }

    if (touch !== "spring" && touch !== "fall") {
      return errorJson("Invalid touch param. Use 'spring' or 'fall'.", 400);
    }

    // Get all subscribers who are opted in
    const activeSubscribers = await db
      .select()
      .from(seasonalSubscribers)
      .where(eq(seasonalSubscribers.optIn, true));

    // Choose subject line and body depending on Spring (April) or Fall (October)
    let subject = "";
    let emailBody = "";

    if (touch === "spring") {
      subject = "Spring is here—time for gutter cleaning and deck checkups!";
      emailBody = `Hi [Name],\n\nSpring is finally here! It's the perfect time to get your home ready for the warmer months ahead. Contact AAA Handyman Services today for your gutter cleaning, deck safety checkups, and minor exterior repairs.\n\nWarm regards,\nVictor Gregg Hale\nAAA Handyman Services\nPhone: (248) 385-3432\nEmail: contact@aaahandyman.services`;
    } else {
      subject = "Prepare for cold weather—weatherproofing and winterization";
      emailBody = `Hi [Name],\n\nFall has arrived and winter is just around the corner. Prevent drafty rooms and high heating bills by scheduling your weatherproofing and winterization checks with AAA Handyman Services today!\n\nWarm regards,\nVictor Gregg Hale\nAAA Handyman Services\nPhone: (248) 385-3432\nEmail: contact@aaahandyman.services`;
    }

    // Simulate sending email blasts
    const sentCount = activeSubscribers.length;
    const recipients = activeSubscribers.map(sub => {
      const personalBody = emailBody.replace("[Name]", sub.name || "Valued Customer");
      return {
        email: sub.email,
        name: sub.name,
        subject,
        body: personalBody,
      };
    });

    return json({
      success: true,
      touch,
      subject,
      totalSubscribers: sentCount,
      simulatedSentList: recipients,
      info: "This function executes the Two-Touch Annual Schedule email blast (April for Spring, October for Fall)."
    });
  } catch (err: any) {
    return errorJson(err.message || "Failed to execute seasonal blast simulation.", 500);
  }
};

export const config: Config = {
  path: "/api/seasonal-reminder-blast",
};

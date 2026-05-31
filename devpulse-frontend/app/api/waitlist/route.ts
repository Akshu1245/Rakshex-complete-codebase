import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();

    // Try to persist via InsForge REST API if service_role key is configured
    const insforgeUrl = process.env.INSFORGE_URL || "https://yc7y9pq9.ap-southeast.insforge.app";
    const serviceRoleKey = process.env.INSFORGE_SERVICE_ROLE_KEY;

    if (serviceRoleKey) {
      try {
        const res = await fetch(`${insforgeUrl}/rest/v1/waitlist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            email: normalized,
            plan: "Free",
            source: body.source || "homepage_waitlist",
          }),
        });
        if (!res.ok && res.status !== 409) {
          console.error("[Waitlist] InsForge insert failed:", res.status, await res.text());
        }
      } catch (dbErr) {
        console.error("[Waitlist] InsForge error:", dbErr);
      }
    }

    // Always return success so the UI never hangs
    console.log(
      "[Waitlist] New signup:",
      normalized,
      "source:",
      body.source || "homepage_waitlist",
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Waitlist] Error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

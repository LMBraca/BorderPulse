import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const VALID_TYPES = ["bug", "feature", "other"] as const;
const MAX_MESSAGE_LENGTH = 1000;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const submissions = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = submissions.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  submissions.set(ip, recent);
  return recent.length >= RATE_LIMIT_MAX;
}

function recordSubmission(ip: string) {
  const timestamps = submissions.get(ip) ?? [];
  timestamps.push(Date.now());
  submissions.set(ip, timestamps);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const feedbackEmail = process.env.FEEDBACK_EMAIL;

  if (!apiKey || !feedbackEmail) {
    return NextResponse.json(
      { error: "Feedback service not configured" },
      { status: 500 }
    );
  }

  // Rate limit by IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }

  let body: { type?: string; message?: string; website?: string; _t?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, message, website, _t } = body;

  if (website) {
    return NextResponse.json({ success: true });
  }

  if (_t && Date.now() - _t < 3000) {
    return NextResponse.json({ success: true });
  }

  if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be under ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  const resend = new Resend(apiKey);
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const subject = `[BorderPulse] ${typeLabel}: ${message.slice(0, 50)}${message.length > 50 ? "..." : ""}`;

  try {
    await resend.emails.send({
      from: "BorderPulse <onboarding@resend.dev>",
      to: feedbackEmail,
      subject,
      text: `Type: ${typeLabel}\nIP: ${ip}\n\n${message.trim()}`,
    });

    recordSubmission(ip);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to send feedback" },
      { status: 500 }
    );
  }
}

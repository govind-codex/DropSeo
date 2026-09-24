import { NextResponse } from "next/server";
import { authConfig, cookieOptions, FLOW_COOKIE, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  let config: ReturnType<typeof authConfig>;
  try { config = authConfig(); }
  catch { return Response.json({ error: "Authentication is not configured." }, { status: 503 }); }
  if (request.headers.get("origin") !== config.origin || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const response = NextResponse.redirect(new URL("/", config.origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  response.cookies.set(FLOW_COOKIE, "", cookieOptions(0));
  return response;
}

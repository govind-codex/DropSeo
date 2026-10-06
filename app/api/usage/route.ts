import { getSession } from "@/lib/auth";
import { getPlanUsageForUser } from "@/lib/plan-entitlements";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Sign in to view plan usage." }, { status: 401 });
  try {
    return Response.json(await getPlanUsageForUser(user));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Plan usage is unavailable." }, { status: 503 });
  }
}

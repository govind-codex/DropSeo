import { getSession } from "@/lib/auth";
import { investigationSummary, listInvestigations } from "@/lib/investigations";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getSession();
  if (!user) return Response.json({ error: "Sign in to view investigations." }, { status: 401 });
  try { return Response.json({ investigations: (await listInvestigations(user.id)).map(investigationSummary) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch { return Response.json({ error: "Investigation history is unavailable. Please try again." }, { status: 503 }); }
}

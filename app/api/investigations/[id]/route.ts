import { getSession } from "@/lib/auth";
import { getInvestigation } from "@/lib/investigations";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return Response.json({ error: "Sign in to view investigations." }, { status: 401 });
  try {
    const record = await getInvestigation(user.id, (await context.params).id);
    if (!record) return Response.json({ error: "Investigation not found." }, { status: 404 });
    const data = { ...record, userId: undefined };
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Investigation history is unavailable." }, { status: 503 }); }
}

import { getSession, validMutationOrigin } from "@/lib/auth";
import { analyzeAuthenticatedWebsite } from "@/lib/website-analysis";

export async function POST(request: Request) {
  if (!(await getSession())) return Response.json({ error: "Sign in with Google to analyze a website." }, { status: 401 });
  if (!validMutationOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  return analyzeAuthenticatedWebsite(request);
}

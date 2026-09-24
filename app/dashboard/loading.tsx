import { Loader2 } from "lucide-react";

export default function Loading() {
  return <main className="dashboard-loading" role="status"><Loader2 className="spin" style={{ margin: "0 auto 16px" }} /><p>Opening your workspace…</p></main>;
}

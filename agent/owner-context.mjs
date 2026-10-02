import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import path from "node:path";
export const ownerContext = new AsyncLocalStorage();
export function ownerMemoryDirectory(directory) {
  const owner = ownerContext.getStore();
  // Legacy tooling/tests keep their own memory; authenticated runs never read it.
  return owner ? path.join(directory, createHash("sha256").update(owner).digest("hex")) : directory;
}

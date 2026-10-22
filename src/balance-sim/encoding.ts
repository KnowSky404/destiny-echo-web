/** Canonical JSON shared by CLI evidence and PRE import; never evaluates imported content. */
export function stableStringify(value: unknown): string {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new Error("Evidence contains non-finite number");
  if (value === null || typeof value !== "object") {
    const result = JSON.stringify(value);
    if (result === undefined) throw new Error("Evidence cannot contain undefined");
    return result;
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    )
    .join(",")}}`;
}
export async function contentHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

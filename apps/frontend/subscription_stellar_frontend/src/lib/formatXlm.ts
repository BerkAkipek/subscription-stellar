const STROOPS_PER_XLM = 10_000_000n;

export function formatXlmFromStroops(stroops: string | null | undefined): string {
  if (!stroops) return "0";

  try {
    const n = BigInt(stroops);
    const whole = n / STROOPS_PER_XLM;
    const frac = (n % STROOPS_PER_XLM).toString().padStart(7, "0").replace(/0+$/, "");
    return frac ? `${whole.toString()}.${frac}` : whole.toString();
  } catch {
    return "0";
  }
}

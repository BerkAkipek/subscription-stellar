export const DEFAULT_PAYOUT_ADDRESS =
  "GCEUZVV7XV3UPXKZKIMX2T3VZK6POIKMIOL3XM3XNZWXEK4CVVGNIWD2";

const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

export function isValidStellarPublicKey(address: string): boolean {
  return STELLAR_PUBLIC_KEY_REGEX.test(address);
}

export function resolvePayoutAddress(value?: string | null): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return DEFAULT_PAYOUT_ADDRESS;
  }
  if (!isValidStellarPublicKey(normalized)) {
    return DEFAULT_PAYOUT_ADDRESS;
  }
  return normalized;
}

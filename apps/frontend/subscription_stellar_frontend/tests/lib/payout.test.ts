import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYOUT_ADDRESS,
  isValidStellarPublicKey,
  resolvePayoutAddress,
} from "@/lib/payout";

describe("payout wallet resolution", () => {
  it("uses default payout address when value is missing", () => {
    expect(resolvePayoutAddress(undefined)).toBe(DEFAULT_PAYOUT_ADDRESS);
    expect(resolvePayoutAddress("")).toBe(DEFAULT_PAYOUT_ADDRESS);
    expect(resolvePayoutAddress("   ")).toBe(DEFAULT_PAYOUT_ADDRESS);
  });

  it("uses provided address when it is a valid Stellar public key", () => {
    const treasury = "GBRPYHIL2CII3NMNDSGN6X6P4W4TPEFT2R7K5G3A4M7OT5V2K7V6UXOL";
    expect(resolvePayoutAddress(treasury)).toBe(treasury);
  });

  it("falls back to default when configured address is invalid", () => {
    expect(resolvePayoutAddress("not-a-stellar-address")).toBe(DEFAULT_PAYOUT_ADDRESS);
    expect(resolvePayoutAddress("GSHORT")).toBe(DEFAULT_PAYOUT_ADDRESS);
  });

  it("validates expected Stellar address format", () => {
    expect(isValidStellarPublicKey(DEFAULT_PAYOUT_ADDRESS)).toBe(true);
    expect(isValidStellarPublicKey("not-valid")).toBe(false);
  });
});

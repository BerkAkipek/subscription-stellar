import { describe, expect, it } from "vitest";

import { formatXlmFromStroops } from "@/lib/formatXlm";

describe("formatXlmFromStroops", () => {
  it("formats whole xlm amounts", () => {
    expect(formatXlmFromStroops("10000000")).toBe("1");
    expect(formatXlmFromStroops("250000000")).toBe("25");
  });

  it("formats fractional xlm amounts", () => {
    expect(formatXlmFromStroops("15000000")).toBe("1.5");
    expect(formatXlmFromStroops("12345678")).toBe("1.2345678");
  });

  it("returns zero for invalid input", () => {
    expect(formatXlmFromStroops(undefined)).toBe("0");
    expect(formatXlmFromStroops(null)).toBe("0");
    expect(formatXlmFromStroops("abc")).toBe("0");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCached, removeCached, setCached } from "@/lib/cache";

describe("cache utils", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("returns cached value before ttl expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T00:00:00.000Z"));

    setCached("k1", { planId: 1 }, 1000);

    expect(getCached<{ planId: number }>("k1")).toEqual({ planId: 1 });
  });

  it("expires and removes cached value after ttl", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T00:00:00.000Z"));

    setCached("k2", ["XLM"], 1000);
    vi.setSystemTime(new Date("2026-02-20T00:00:01.500Z"));

    expect(getCached<string[]>("k2")).toBeNull();
    expect(localStorage.getItem("k2")).toBeNull();
  });

  it("returns null and clears corrupted cache payload", () => {
    localStorage.setItem("broken", "{not-json");

    expect(getCached("broken")).toBeNull();
    expect(localStorage.getItem("broken")).toBeNull();
  });

  it("removeCached deletes existing entry", () => {
    setCached("k3", 42, 10_000);
    removeCached("k3");

    expect(getCached<number>("k3")).toBeNull();
  });
});

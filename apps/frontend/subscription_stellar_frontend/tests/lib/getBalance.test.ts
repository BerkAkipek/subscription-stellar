import { describe, it, expect, vi } from "vitest"
import { getBalances } from "@/lib/getBalance"
import { server } from "@/lib/stellar"


vi.mock("@/lib/stellar", () => ({
  server: {
    loadAccount: vi.fn()
  }
}))

const mockedLoadAccount = server.loadAccount as unknown as ReturnType<typeof vi.fn>

describe("getBalances", () => {
  it("returns native XLM balance", async () => {
    mockedLoadAccount.mockResolvedValue({
      balances: [
        { asset_type: "native", balance: "99" }
      ]
    })

    const result = await getBalances("GTEST")

    expect(result).toEqual([
      { asset: "XLM", balance: "99" }
    ])
  })
})
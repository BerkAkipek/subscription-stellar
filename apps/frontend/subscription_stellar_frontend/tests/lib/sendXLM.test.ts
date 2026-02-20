import { describe, it, expect, vi } from "vitest"
import { sendXLM } from "@/lib/sendXLM"

const { mockServer } = vi.hoisted(() => {
  return {
    mockServer: {
      loadAccount: vi.fn(),
      fetchBaseFee: vi.fn(),
      submitTransaction: vi.fn()
    }
  }
})

vi.mock("stellar-sdk", () => {

  class Server {
    constructor() {
      return mockServer
    }
  }

  class TransactionBuilder {
    constructor() {}

    addOperation() {
      return this
    }

    setTimeout() {
      return this
    }

    build() {
      return {
        toXDR() {
          return "mock-xdr"
        }
      }
    }
  }

  class Transaction {
    constructor() {}
  }

  return {
    Horizon: { Server },
    TransactionBuilder,
    Networks: { TESTNET: "TESTNET" },
    Operation: { payment: vi.fn() },
    Asset: { native: vi.fn() },
    Transaction
  }
})

vi.mock("@stellar/freighter-api", () => ({
  default: {
    signTransaction: vi.fn()
  }
}))

import freighterApi from "@stellar/freighter-api"

const mockSignTransaction =
  freighterApi.signTransaction as unknown as ReturnType<typeof vi.fn>

describe("sendXLM", () => {
  it("builds, signs, and submits transaction", async () => {

    mockServer.loadAccount.mockResolvedValue({})
    mockServer.fetchBaseFee.mockResolvedValue("100")

    mockServer.submitTransaction.mockResolvedValue({
      hash: "TEST_HASH"
    })

    mockSignTransaction.mockResolvedValue({
      signedTxXdr: "SIGNED_XDR",
      signerAddress: "GFROM"
    })

    const result = await sendXLM("GFROM", "GTO", "1")

    expect(result).toBe("TEST_HASH")
  })
})
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

    addOperation() { return this }
    setTimeout() { return this }

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

vi.mock("@/wallet/manager", () => ({
  wallet: {
    signTransaction: vi.fn(),
    submitTransaction: vi.fn()
  }
}))

import { wallet } from "@/wallet/manager"

const mockWallet = wallet as unknown as {
  signTransaction: ReturnType<typeof vi.fn>;
  submitTransaction: ReturnType<typeof vi.fn>;
};

describe("sendXLM", () => {
  it("builds, signs, and submits transaction", async () => {

    mockServer.loadAccount.mockResolvedValue({})
    mockServer.fetchBaseFee.mockResolvedValue("100")

    mockWallet.signTransaction.mockResolvedValue({
      signedXdr: "SIGNED_XDR",
      signerAddress: "GFROM"
    })

    mockWallet.submitTransaction.mockResolvedValue({
      hash: "TEST_HASH",
      status: "success"
    })

    const result = await sendXLM("GFROM", "GTO", "1")

    expect(result).toBe("TEST_HASH")
  })

  it("throws if wallet rejects signing", async () => {

    mockServer.loadAccount.mockResolvedValue({})
    mockServer.fetchBaseFee.mockResolvedValue("100")

    mockWallet.signTransaction.mockRejectedValue(
      new Error("User rejected")
    )

    await expect(
      sendXLM("GFROM", "GTO", "1")
    ).rejects.toThrow("User rejected")
  })

  it("throws if transaction submission fails", async () => {

    mockServer.loadAccount.mockResolvedValue({})
    mockServer.fetchBaseFee.mockResolvedValue("100")

    mockWallet.signTransaction.mockResolvedValue({
      signedXdr: "SIGNED_XDR",
      signerAddress: "GFROM"
    })

    mockWallet.submitTransaction.mockRejectedValue(
      new Error("Horizon rejected transaction")
    )

    await expect(
      sendXLM("GFROM", "GTO", "1")
    ).rejects.toThrow("Horizon rejected transaction")
  })

})
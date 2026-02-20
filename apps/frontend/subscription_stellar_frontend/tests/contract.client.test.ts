import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VITE_CONTRACT_ID", "TEST_CONTRACT_ID");

const {
  mockRpcServer,
  mockCall,
  mockFromString,
  mockScvU32,
  mockScvU64,
  mockUint64FromString,
  mockFromXDR,
} = vi.hoisted(() => {
  const mockRpcServer = {
    getAccount: vi.fn(),
    simulateTransaction: vi.fn(),
    prepareTransaction: vi.fn(),
    sendTransaction: vi.fn(),
  };

  return {
    mockRpcServer,
    mockCall: vi.fn(),
    mockFromString: vi.fn(),
    mockScvU32: vi.fn(),
    mockScvU64: vi.fn(),
    mockUint64FromString: vi.fn(),
    mockFromXDR: vi.fn(),
  };
});

vi.mock("stellar-sdk", () => {
  class Contract {
    call = mockCall;
  }

  class Server {
    constructor() {
      return mockRpcServer;
    }
  }

  class TransactionBuilder {
    static fromXDR = mockFromXDR;

    constructor() {}

    addOperation() {
      return this;
    }

    setTimeout() {
      return this;
    }

    build() {
      return {
        tx: "built",
        toXDR() {
          return "TX_XDR";
        },
      };
    }
  }

  return {
    Contract,
    Address: {
      fromString: mockFromString,
    },
    TransactionBuilder,
    Networks: { TESTNET: "TESTNET" },
    BASE_FEE: "100",
    xdr: {
      ScVal: {
        scvU32: mockScvU32,
        scvU64: mockScvU64,
      },
      Uint64: {
        fromString: mockUint64FromString,
      },
    },
    rpc: {
      Server,
    },
  };
});

vi.mock("@/wallet/manager", () => ({
  wallet: {
    signTransaction: vi.fn(),
  },
}));

import { wallet } from "@/wallet/manager";
import { getSubscription, subscribe } from "@/contract/client";

const mockWallet = wallet as unknown as {
  signTransaction: ReturnType<typeof vi.fn>;
};

function scVal(name: string, value?: unknown) {
  return {
    switch: () => ({ name }),
    value: () => value,
  };
}

describe("contract client", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFromString.mockReturnValue({
      toScVal: vi.fn().mockReturnValue("USER_SCVAL"),
    });

    mockCall.mockReturnValue("CONTRACT_OPERATION");
    mockScvU32.mockImplementation((v) => `U32_${v}`);
    mockUint64FromString.mockImplementation((v) => `U64_RAW_${v}`);
    mockScvU64.mockImplementation((v) => `U64_${v}`);

    mockRpcServer.getAccount.mockResolvedValue({ id: "ACCOUNT" });
    mockRpcServer.prepareTransaction.mockResolvedValue({
      toXDR: vi.fn().mockReturnValue("PREPARED_XDR"),
    });
    mockFromXDR.mockReturnValue({ signed: true });
    mockRpcServer.sendTransaction.mockResolvedValue({ hash: "TX_HASH" });

    mockWallet.signTransaction.mockResolvedValue({ signedXdr: "SIGNED_XDR" });
  });

  it("subscribe builds/sends contract tx and returns hash", async () => {
    mockRpcServer.simulateTransaction.mockResolvedValue({ ok: true });

    const hash = await subscribe("GUSER", 7, 3600);

    expect(mockRpcServer.getAccount).toHaveBeenCalledWith("GUSER");
    expect(mockCall).toHaveBeenCalledWith(
      "subscribe",
      "USER_SCVAL",
      "U32_7",
      "U64_U64_RAW_3600"
    );
    expect(mockWallet.signTransaction).toHaveBeenCalledWith("PREPARED_XDR", {
      address: "GUSER",
    });
    expect(mockFromXDR).toHaveBeenCalledWith("SIGNED_XDR", "TESTNET");
    expect(mockRpcServer.sendTransaction).toHaveBeenCalledWith({ signed: true });
    expect(hash).toBe("TX_HASH");
  });

  it("getSubscription returns null when simulation has no retval", async () => {
    mockRpcServer.simulateTransaction.mockResolvedValue({ result: {} });

    const result = await getSubscription("GUSER");

    expect(mockCall).toHaveBeenCalledWith("get_subscription", "USER_SCVAL");
    expect(result).toBeNull();
  });

  it("getSubscription decodes nested scvSome map payload", async () => {
    const entries = [
      {
        key: () => scVal("scvSymbol", "plan_id"),
        val: () => scVal("scvU32", 3),
      },
      {
        key: () => scVal("scvSymbol", "expires_at"),
        val: () => scVal("scvU64", 1899999999),
      },
    ];

    const retval = {
      switch: () => ({ name: "scvSome" }),
      value: () => scVal("scvMap", entries),
    };

    mockRpcServer.simulateTransaction.mockResolvedValue({ result: { retval } });

    const result = await getSubscription("GUSER");

    expect(result).toEqual({
      planId: 3,
      expiresAt: 1899999999,
    });
  });

  it("getSubscription returns null for scvVoid", async () => {
    mockRpcServer.simulateTransaction.mockResolvedValue({
      result: { retval: scVal("scvVoid") },
    });

    const result = await getSubscription("GUSER");

    expect(result).toBeNull();
  });

  it("getSubscription returns null when required fields are missing", async () => {
    const entries = [
      {
        key: () => scVal("scvSymbol", "plan_id"),
        val: () => scVal("scvU32", 4),
      },
    ];

    mockRpcServer.simulateTransaction.mockResolvedValue({
      result: { retval: scVal("scvMap", entries) },
    });

    const result = await getSubscription("GUSER");

    expect(result).toBeNull();
  });
});

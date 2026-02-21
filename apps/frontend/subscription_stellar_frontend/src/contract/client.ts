import {
  Contract,
  Address,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  rpc,
  nativeToScVal,
  scValToBigInt,
} from "stellar-sdk";

import { wallet } from "@/wallet/manager";

const rpcServer = new rpc.Server(
  "https://soroban-testnet.stellar.org"
);

const SUBSCRIPTION_CONTRACT_ID =
  import.meta.env.VITE_SUBSCRIPTION_CONTRACT_ID ??
  import.meta.env.VITE_CONTRACT_ID;
const PAYMENT_CONTRACT_ID =
  import.meta.env.VITE_PAYMENT_CONTRACT_ID ??
  import.meta.env.VITE_TOKENIZATION_CONTRACT_ID ??
  import.meta.env.VITE_CONTRACT_ID;

if (!SUBSCRIPTION_CONTRACT_ID) {
  throw new Error("Missing VITE_SUBSCRIPTION_CONTRACT_ID in env");
}

if (!PAYMENT_CONTRACT_ID) {
  throw new Error("Missing VITE_PAYMENT_CONTRACT_ID in env");
}

const NETWORK = Networks.TESTNET;

type SimulationEnvelope = {
  error?: unknown;
  result?: {
    error?: unknown;
    retval?: unknown;
  };
  retval?: unknown;
};

type ScValLike = {
  switch?: () => { name?: string };
  value?: () => unknown;
};

type ScMapEntryLike = {
  key: () => unknown;
  val: () => unknown;
};

function asSimulationEnvelope(value: unknown): SimulationEnvelope {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  return value as SimulationEnvelope;
}

function asScValLike(value: unknown): ScValLike | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as ScValLike;
}

function getScValArm(value: unknown): string | null {
  const maybeScVal = asScValLike(value);
  const maybeSwitch = maybeScVal?.switch?.();
  if (!maybeSwitch || typeof maybeSwitch.name !== "string") {
    return null;
  }
  return maybeSwitch.name;
}

function getScValValue(value: unknown): unknown {
  return asScValLike(value)?.value?.();
}

function isScMapEntryLike(value: unknown): value is ScMapEntryLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const maybeEntry = value as Partial<ScMapEntryLike>;
  return typeof maybeEntry.key === "function" && typeof maybeEntry.val === "function";
}

function stringifySimulationField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifySimulationField(item))
      .filter((item): item is string => Boolean(item))
      .join(" | ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function simulationErrorMessage(sim: unknown): string | null {
  const parsed = asSimulationEnvelope(sim);
  const topLevel = stringifySimulationField(parsed.error);
  if (topLevel) return topLevel;

  const resultLevel = stringifySimulationField(parsed.result?.error);
  if (resultLevel) return resultLevel;

  return null;
}


// ==============================
// DECODER
// ==============================

function decodeSubscription(val: unknown) {
  const arm = getScValArm(val);

  if (arm === "scvVoid") {
    return null;
  }

  const payload = arm === "scvSome" ? getScValValue(val) : val;
  let map: ScMapEntryLike[] | null = null;
  if (getScValArm(payload) === "scvMap") {
    const entries = getScValValue(payload);
    if (Array.isArray(entries)) {
      map = entries.filter(isScMapEntryLike);
    }
  } else if (Array.isArray(payload)) {
    map = payload.filter(isScMapEntryLike);
  }

  if (!map) {
    return null;
  }

  let plan: string | null = null;
  let expires: string | null = null;

  const scValToString = (scVal: unknown): string | null => {
    try {
      const scArm = getScValArm(scVal);

      if (scArm === "scvSymbol" || scArm === "scvString") {
        const value = getScValValue(scVal);
        return value == null ? null : value.toString();
      }

      if (
        scArm === "scvU32" ||
        scArm === "scvU64" ||
        scArm === "scvI32" ||
        scArm === "scvI64" ||
        scArm === "scvU128" ||
        scArm === "scvI128"
      ) {
        const value = getScValValue(scVal);
        return value == null ? null : value.toString();
      }

      const fallback = getScValValue(scVal);
      return fallback == null ? null : String(fallback);
    } catch {
      return null;
    }
  };

  for (const entry of map) {
    const key = scValToString(entry.key());
    const value = scValToString(entry.val());

    if (!key || !value) continue;

    if (key === "plan_id") {
      plan = value;
    } else if (key === "expires_at") {
      expires = value;
    }
  }

  if (!plan || !expires) {
    return null;
  }

  return {
    planId: Number(plan),
    expiresAt: Number(expires),
  };
}


// ==============================
// WRITE: SUBSCRIBE
// ==============================

export async function subscribe(
  userAddress: string,
  planId: number,
  durationSeconds: number,
  amount: number
) {
  const account = await rpcServer.getAccount(userAddress);
  const contract = new Contract(SUBSCRIPTION_CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      contract.call(
        "subscribe",
        Address.fromString(userAddress).toScVal(),
        xdr.ScVal.scvU32(planId),
        xdr.ScVal.scvU64(
          xdr.Uint64.fromString(durationSeconds.toString())
        ),
        nativeToScVal(amount.toString(), { type: "i128" })
      )
    )
    .setTimeout(60)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  const simError = simulationErrorMessage(sim);
  if (simError) {
    throw new Error(`Subscription simulation failed: ${simError}`);
  }

  const prepared = await rpcServer.prepareTransaction(tx);

  const signed = await wallet.signTransaction(
    prepared.toXDR(),
    { address: userAddress }
  );

  const signedTx = TransactionBuilder.fromXDR(
    signed.signedXdr,
    NETWORK
  );

  const result = await rpcServer.sendTransaction(signedTx);

  console.log("SEND RESULT:", result);

  return result.hash;
}

// ==============================
// READ: SUBSCRIPTION
// ==============================

export async function getSubscription(userAddress: string) {

  const contract = new Contract(SUBSCRIPTION_CONTRACT_ID);

  const account = await rpcServer.getAccount(userAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      contract.call(
        "get_subscription",
        Address.fromString(userAddress).toScVal()
      )
    )
    .setTimeout(60)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);

  const parsed = asSimulationEnvelope(sim);
  const retval = parsed.result?.retval ?? parsed.retval;

  if (!retval) return null;

  console.log("SIMULATION FULL:", sim);
  console.log("RETVAL RAW:", retval);

  return decodeSubscription(retval);
}

export async function getTokenBalance(userAddress: string): Promise<string | null> {
  const contract = new Contract(PAYMENT_CONTRACT_ID);
  const account = await rpcServer.getAccount(userAddress);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      contract.call(
        "balance",
        Address.fromString(userAddress).toScVal()
      )
    )
    .setTimeout(60)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);
  const parsed = asSimulationEnvelope(sim);
  const retval = parsed.result?.retval ?? parsed.retval;

  if (!retval) return null;

  try {
    return scValToBigInt(retval).toString();
  } catch {
    try {
      return retval.value().toString();
    } catch {
      return null;
    }
  }
}

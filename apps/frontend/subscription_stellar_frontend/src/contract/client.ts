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
const TOKENIZATION_CONTRACT_ID =
  import.meta.env.VITE_TOKENIZATION_CONTRACT_ID ??
  import.meta.env.VITE_CONTRACT_ID;

if (!SUBSCRIPTION_CONTRACT_ID) {
  throw new Error("Missing VITE_SUBSCRIPTION_CONTRACT_ID in env");
}

if (!TOKENIZATION_CONTRACT_ID) {
  throw new Error("Missing VITE_TOKENIZATION_CONTRACT_ID in env");
}

const NETWORK = Networks.TESTNET;

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

function simulationErrorMessage(sim: any): string | null {
  const topLevel = stringifySimulationField(sim?.error);
  if (topLevel) return topLevel;

  const resultLevel = stringifySimulationField(sim?.result?.error);
  if (resultLevel) return resultLevel;

  return null;
}


// ==============================
// DECODER
// ==============================

function decodeSubscription(val: any) {
  const arm = val.switch().name;

  if (arm === "scvVoid") {
    return null;
  }

  const payload = arm === "scvSome" ? val.value() : val;
  const map =
    payload.switch?.().name === "scvMap"
      ? payload.value()
      : Array.isArray(payload)
        ? payload
        : null;

  if (!map) {
    return null;
  }

  let plan: string | null = null;
  let expires: string | null = null;

  const scValToString = (scVal: any): string | null => {
    try {
      const scArm = scVal.switch().name;

      if (scArm === "scvSymbol" || scArm === "scvString") {
        return scVal.value().toString();
      }

      if (
        scArm === "scvU32" ||
        scArm === "scvU64" ||
        scArm === "scvI32" ||
        scArm === "scvI64" ||
        scArm === "scvU128" ||
        scArm === "scvI128"
      ) {
        return scVal.value().toString();
      }

      return scVal.value?.()?.toString?.() ?? null;
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

  const retval = (sim as any).result?.retval ?? (sim as any).retval;

  if (!retval) return null;

  console.log("SIMULATION FULL:", sim);
  console.log("RETVAL RAW:", retval);

  return decodeSubscription(retval);
}

export async function getTokenBalance(userAddress: string): Promise<string | null> {
  const contract = new Contract(TOKENIZATION_CONTRACT_ID);
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
  const retval = (sim as any).result?.retval ?? (sim as any).retval;

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

import freighterApi from "@stellar/freighter-api";
import {
  Horizon,
  Transaction,
  Networks
} from "stellar-sdk";

import type {
  WalletProvider,
  WalletSession,
  Balance,
  SignedTransaction,
  SignOptions,
  TxResult
} from "../types";

import {
  WalletNotInstalledError,
  WalletRejectedError,
  WalletNotConnectedError
} from "../types";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK = Networks.TESTNET;

const server = new Horizon.Server(HORIZON_URL);

type FreighterErrorLike = {
  message?: string;
};

type HorizonBalanceLike = {
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  balance?: string;
};

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeError = error as FreighterErrorLike;
    if (typeof maybeError.message === "string") {
      return maybeError.message;
    }
  }
  return "Transaction failed";
}


// ==============================
// 🔌 FREIGHTER PROVIDER
// ==============================

export const freighterProvider: WalletProvider = {
  id: "freighter",
  name: "Freighter",

  // ------------------------------
  // CONNECT WALLET
  // ------------------------------
  async connect(): Promise<WalletSession> {
    try {
      await freighterApi.requestAccess();

      const result = await freighterApi.getAddress();

      if (!result?.address) {
        throw new WalletRejectedError();
      }

      return {
        address: result.address,
        network: "testnet",
        walletType: "freighter"
      };
    } catch (err: unknown) {
      if (errorMessage(err).includes("not installed")) {
        throw new WalletNotInstalledError();
      }
      throw new WalletRejectedError();
    }
  },


  // ------------------------------
  // DISCONNECT (Freighter has no real disconnect)
  // ------------------------------
  async disconnect(): Promise<void> {
    return;
  },


  // ------------------------------
  // GET SESSION
  // ------------------------------
  async getSession(): Promise<WalletSession | null> {
    try {
      const result = await freighterApi.getAddress();
      if (!result?.address) return null;

      return {
        address: result.address,
        network: "testnet",
        walletType: "freighter"
      };
    } catch {
      return null;
    }
  },


  // ------------------------------
  // GET BALANCES
  // ------------------------------
  async getBalances(address?: string): Promise<Balance[]> {
    if (!address) {
      const session = await this.getSession();
      if (!session) throw new WalletNotConnectedError();
      address = session.address;
    }

    const account = await server.loadAccount(address);

    return account.balances.map((balance): Balance => {
      const b = balance as HorizonBalanceLike;
      if (b.asset_type === "native") {
        return {
          asset: "XLM",
          amount: b.balance ?? "0"
        };
      }

      return {
        asset: b.asset_code ?? "UNKNOWN",
        issuer: b.asset_issuer,
        amount: b.balance ?? "0"
      };
    });
  },


  // ------------------------------
  // SIGN TRANSACTION
  // ------------------------------
  async signTransaction(
    xdr: string,
    options?: SignOptions
  ): Promise<SignedTransaction> {
    const signed = await freighterApi.signTransaction(
      xdr,
      { networkPassphrase: NETWORK }
    );

    if (!signed?.signedTxXdr) {
      throw new WalletRejectedError();
    }

    const address =
      options?.address ??
      (await freighterApi.getAddress()).address;

    return {
      signedXdr: signed.signedTxXdr,
      signerAddress: address
    };
  },


  // ------------------------------
  // SUBMIT TRANSACTION (optional helper)
  // ------------------------------
  async submitTransaction(
    signedXdr: string
  ): Promise<TxResult> {

    const tx = new Transaction(
      signedXdr,
      NETWORK
    );

    try {
      const result = await server.submitTransaction(tx);

      return {
        hash: result.hash,
        status: "success"
      };
    } catch (e: unknown) {
      return {
        hash: "",
        status: "failed",
        error: errorMessage(e)
      };
    }
  }
};

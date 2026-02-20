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
    } catch (err: any) {
      if (err?.message?.includes("not installed")) {
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

    return account.balances.map((b: any) => {
      if (b.asset_type === "native") {
        return {
          asset: "XLM",
          amount: b.balance
        };
      }

      return {
        asset: b.asset_code,
        issuer: b.asset_issuer,
        amount: b.balance
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
    } catch (e: any) {
      return {
        hash: "",
        status: "failed",
        error: e?.message ?? "Transaction failed"
      };
    }
  }
};
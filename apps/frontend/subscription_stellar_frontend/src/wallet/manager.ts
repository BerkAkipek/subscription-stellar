import type {
  WalletProvider,
  WalletSession,
  Balance,
  SignedTransaction,
  SignOptions,
  TxResult
} from "./types";

import { WalletNotConnectedError } from "./types";
import { freighterProvider } from "./providers/freighter";
import { selectorProvider } from "./providers/selector";

// ==============================
// 🔌 AVAILABLE PROVIDERS
// ==============================

const providers: Record<string, WalletProvider> = {
  freighter: freighterProvider,
  selector: selectorProvider
};


// ==============================
// 🧠 WALLET MANAGER CLASS
// ==============================

class WalletManager {
  private provider: WalletProvider | null = null;
  private session: WalletSession | null = null;

  // ------------------------------
  // CONNECT
  // ------------------------------
  async connect(providerId: string = "freighter"): Promise<WalletSession> {
    const provider = providers[providerId];

    if (!provider) {
      throw new Error(`Wallet provider "${providerId}" not found`);
    }

    const session = await provider.connect();

    this.provider = provider;
    this.session = session;

    // optional persistence
    localStorage.setItem("wallet_provider", providerId);

    return session;
  }

  // ------------------------------
  // RESTORE SESSION (on app load)
  // ------------------------------
  async restore(): Promise<WalletSession | null> {
    const providerId = localStorage.getItem("wallet_provider");
    if (!providerId) return null;

    const provider = providers[providerId];
    if (!provider) return null;

    const session = await provider.getSession();
    if (!session) return null;

    this.provider = provider;
    this.session = session;

    return session;
  }

  // ------------------------------
  // DISCONNECT
  // ------------------------------
  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
    }

    this.provider = null;
    this.session = null;

    localStorage.removeItem("wallet_provider");
  }

  // ------------------------------
  // GET SESSION
  // ------------------------------
  getSession(): WalletSession | null {
    return this.session;
  }

  // ------------------------------
  // ENSURE PROVIDER
  // ------------------------------
  private ensureProvider(): WalletProvider {
    if (!this.provider) {
      throw new WalletNotConnectedError();
    }
    return this.provider;
  }

  // ------------------------------
  // BALANCES
  // ------------------------------
  async getBalances(): Promise<Balance[]> {
    const provider = this.ensureProvider();
    return provider.getBalances(this.session?.address);
  }

  // ------------------------------
  // SIGN
  // ------------------------------
  async signTransaction(
    xdr: string,
    options?: SignOptions
  ): Promise<SignedTransaction> {
    const provider = this.ensureProvider();
    return provider.signTransaction(xdr, options);
  }

  // ------------------------------
  // SUBMIT
  // ------------------------------
  async submitTransaction(
    signedXdr: string
  ): Promise<TxResult> {
    const provider = this.ensureProvider();

    if (!provider.submitTransaction) {
      throw new Error("Provider does not support submission");
    }

    return provider.submitTransaction(signedXdr);
  }
}


// ==============================
// 🌍 SINGLETON EXPORT
// ==============================

export const wallet = new WalletManager();
import type { WalletProvider, WalletSession } from "../types";
import { freighterProvider } from "./freighter";

const availableProviders: WalletProvider[] = [
  freighterProvider
];

export const selectorProvider: WalletProvider = {
  id: "selector",
  name: "Wallet Selector",

  async connect(): Promise<WalletSession> {
    if (availableProviders.length === 1) {
      return availableProviders[0].connect();
    }

    const provider = availableProviders[0];
    return provider.connect();
  },

  async disconnect() {
    const provider = availableProviders[0];
    return provider.disconnect();
  },

  async getSession() {
    const provider = availableProviders[0];
    return provider.getSession();
  },

  async getBalances(address) {
    const provider = availableProviders[0];
    return provider.getBalances(address);
  },

  async signTransaction(xdr, options) {
    const provider = availableProviders[0];
    return provider.signTransaction(xdr, options);
  },

  async submitTransaction(signedXdr) {
    const provider = availableProviders[0];
    return provider.submitTransaction!(signedXdr);
  }
};
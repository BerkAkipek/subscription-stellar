// ==============================
// NETWORK TYPES
// ==============================

export type StellarNetwork = "testnet" | "pubnet";


// ==============================
// BALANCE MODEL
// ==============================

export interface Balance {
  asset: string;      
  amount: string;      
  issuer?: string; 
}


// ==============================
// WALLET SESSION
// ==============================

export interface WalletSession {
  address: string;
  network: StellarNetwork;
  walletType: string;
}


// ==============================
// SIGNING OPTIONS
// ==============================

export interface SignOptions {
  network?: StellarNetwork;
  address?: string;
}


// ==============================
// SIGNED TRANSACTION RESULT
// ==============================

export interface SignedTransaction {
  signedXdr: string;
  signerAddress: string;
}


// ==============================
// SUBMISSION RESULT
// ==============================

export type TxStatus = "pending" | "success" | "failed";

export interface TxResult {
  hash: string;
  status: TxStatus;
  error?: string;
}


// ==============================
// NORMALIZED WALLET ERRORS
// ==============================

export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}

export class WalletNotInstalledError extends WalletError {
  constructor() {
    super("Wallet is not installed");
    this.name = "WalletNotInstalledError";
  }
}

export class WalletRejectedError extends WalletError {
  constructor() {
    super("User rejected wallet request");
    this.name = "WalletRejectedError";
  }
}

export class WalletNotConnectedError extends WalletError {
  constructor() {
    super("Wallet is not connected");
    this.name = "WalletNotConnectedError";
  }
}

export class InsufficientBalanceError extends WalletError {
  constructor() {
    super("Insufficient balance for transaction");
    this.name = "InsufficientBalanceError";
  }
}


// ==============================
// WALLET PROVIDER INTERFACE
// ==============================

export interface WalletProvider {
  id: string;     
  name: string; 

  connect(): Promise<WalletSession>;
  disconnect(): Promise<void>;

  getSession(): Promise<WalletSession | null>;

  getBalances(address?: string): Promise<Balance[]>;

  signTransaction(
    xdr: string,
    options?: SignOptions
  ): Promise<SignedTransaction>;

  submitTransaction?(signedXdr: string): Promise<TxResult>;
}
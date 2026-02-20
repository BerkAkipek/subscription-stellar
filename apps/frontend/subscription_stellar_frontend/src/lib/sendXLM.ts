import {
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset
} from "stellar-sdk";

import { wallet } from "@/wallet/manager";

const server = new Horizon.Server(
  "https://horizon-testnet.stellar.org"
);

const NETWORK = Networks.TESTNET;


// ==============================
// SEND XLM (wallet-agnostic)
// ==============================

export async function sendXLM(
  from: string,
  to: string,
  amount: string
) {
  const sourceAccount = await server.loadAccount(from);
  const fee = await server.fetchBaseFee();

  const tx = new TransactionBuilder(sourceAccount, {
    fee: fee.toString(),
    networkPassphrase: NETWORK
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset: Asset.native(),
        amount: amount
      })
    )
    .setTimeout(60)
    .build();

  const signed = await wallet.signTransaction(tx.toXDR());

  const result = await wallet.submitTransaction(signed.signedXdr);

  return result.hash;
}
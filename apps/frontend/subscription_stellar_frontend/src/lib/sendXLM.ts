import {
  Horizon,
  TransactionBuilder,
  Networks,
  Operation,
  Asset,
  Transaction
} from "stellar-sdk";
import freighterApi from "@stellar/freighter-api";

const server = new Horizon.Server("https://horizon-testnet.stellar.org");

export async function sendXLM(
  from: string,
  to: string,
  amount: string
) {
  const sourceAccount = await server.loadAccount(from);
  const fee = await server.fetchBaseFee();

  const tx = new TransactionBuilder(sourceAccount, {
    fee: fee.toString(),
    networkPassphrase: Networks.TESTNET
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

  // ✅ Freighter expects XDR string
  const signed = await freighterApi.signTransaction(
    tx.toXDR(),
    { networkPassphrase: Networks.TESTNET }
  );

  // ✅ Convert signed XDR back to Transaction object
  const signedTx = new Transaction(
    signed.signedTxXdr,
    Networks.TESTNET
  );

  const result = await server.submitTransaction(signedTx);

  return result.hash;
}
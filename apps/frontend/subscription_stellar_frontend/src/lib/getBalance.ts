import { server } from "./stellar";

export async function getBalances(publicKey: string) {
  const account = await server.loadAccount(publicKey);

  return account.balances.map((b) => {
    // Native XLM
    if (b.asset_type === "native") {
      return {
        asset: "XLM",
        balance: b.balance,
      };
    }

    if (b.asset_type === "liquidity_pool_shares") {
      return {
        asset: "LP Shares",
        balance: b.balance,
      };
    }

    return {
      asset: `${b.asset_code}`,
      issuer: b.asset_issuer,
      balance: b.balance,
    };
  });
}
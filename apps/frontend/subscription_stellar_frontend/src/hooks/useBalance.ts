import { useEffect, useState } from "react";
import { getBalances } from "../lib/getBalance";

type WalletBalance = Awaited<ReturnType<typeof getBalances>>;

export function useBalance(publicKey?: string) {
  const [balances, setBalances] = useState<WalletBalance>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });

    getBalances(publicKey)
      .then((nextBalances) => {
        if (cancelled) return;
        setBalances(nextBalances);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to fetch balances");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  return { balances, loading, error };
}

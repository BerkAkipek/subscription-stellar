import { useEffect, useState } from "react";
import { getBalances } from "../lib/getBalance";

export function useBalance(publicKey?: string) {
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;

    setLoading(true);
    getBalances(publicKey)
      .then(setBalances)
      .catch(() => setError("Failed to fetch balances"))
      .finally(() => setLoading(false));
  }, [publicKey]);

  return { balances, loading, error };
}
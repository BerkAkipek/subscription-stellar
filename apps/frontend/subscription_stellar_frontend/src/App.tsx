import { useEffect, useMemo, useState } from "react";
import { wallet } from "@/wallet/manager";
import type { Balance } from "@/wallet/types";
import { sendXLM } from "./lib/sendXLM";
import { subscribe, getSubscription, getTokenBalance } from "@/contract/client";
import { getCached, removeCached, setCached } from "@/lib/cache";
import { formatXlmFromStroops } from "@/lib/formatXlm";
import { resolvePayoutAddress } from "@/lib/payout";
import "./App.css";

type AsyncStatus = "idle" | "loading" | "success" | "error";
type SubscriptionView = { planId: number; expiresAt: number } | null;
type BackendState = {
  subscription: SubscriptionView;
  tokenBalance: string;
  xlmBalanceStroops: string;
  recentEvents: unknown[];
  observedAt: string;
} | null;

const BALANCE_CACHE_TTL_MS = 30_000;
const SUBSCRIPTION_CACHE_TTL_MS = 15_000;
const STROOPS_PER_XLM = 10_000_000n;
const SUBSCRIPTION_PAYMENT_XLM = 1n;
const SUBSCRIPTION_PAYMENT_AMOUNT = Number(SUBSCRIPTION_PAYMENT_XLM * STROOPS_PER_XLM);
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080";
const PAYOUT_ADDRESS = resolvePayoutAddress(import.meta.env.VITE_PAYOUT_ADDRESS);

function balanceCacheKey(address: string) {
  return `cache:balances:${address}`;
}

function subscriptionCacheKey(address: string) {
  return `cache:subscription:${address}`;
}

function App() {
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const [connectStatus, setConnectStatus] = useState<AsyncStatus>("idle");
  const [sendStatus, setSendStatus] = useState<AsyncStatus>("idle");
  const [subscribeStatus, setSubscribeStatus] = useState<AsyncStatus>("idle");
  const [loadStatus, setLoadStatus] = useState<AsyncStatus>("idle");

  const [txHash, setTxHash] = useState<string | null>(null);

  const [balances, setBalances] = useState<Balance[]>([]);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionView>(null);
  const [backendState, setBackendState] = useState<BackendState>(null);
  const [subscriptionProgress, setSubscriptionProgress] = useState(0);
  const [subscriptionStep, setSubscriptionStep] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const connecting = connectStatus === "loading";
  const sending = sendStatus === "loading";
  const subscribing = subscribeStatus === "loading";
  const loading = loadStatus === "loading";
  const anyBusy = useMemo(
    () => connecting || sending || subscribing || loading,
    [connecting, sending, subscribing, loading]
  );

  function formatAddress(address: string) {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }

  async function refreshBackendState(address: string) {
    const res = await fetch(
      `${BACKEND_URL}/api/state?user=${encodeURIComponent(address)}`
    );
    if (!res.ok) {
      throw new Error(`Backend request failed: ${res.status}`);
    }

    const data = await res.json();
    const normalized: BackendState = {
      subscription: data.subscription ?? null,
      tokenBalance: data.tokenBalance ?? data.xlmBalanceStroops ?? "0",
      xlmBalanceStroops: data.xlmBalanceStroops ?? data.tokenBalance ?? "0",
      recentEvents: Array.isArray(data.recentEvents) ? data.recentEvents : [],
      observedAt: data.observedAt ?? "",
    };

    setBackendState(normalized);
    if (normalized.subscription) {
      setSubscription(normalized.subscription);
    }
    setTokenBalance(normalized.tokenBalance);
  }


  // ==============================
  // HELPER — RETRY READ SUBSCRIPTION
  // ==============================
  async function fetchSubscriptionWithRetry(
    address: string,
    tries = 5,
    onAttempt?: (attempt: number, total: number) => void
  ) {
    for (let i = 0; i < tries; i++) {
      onAttempt?.(i + 1, tries);
      const sub = await getSubscription(address);
      console.log("Retry read subscription:", sub);

      if (sub) return sub;

      await new Promise(r => setTimeout(r, 1500));
    }
    return null;
  }


  // ==============================
  // CONNECT WALLET
  // ==============================
  async function connectWallet() {
    try {
      setConnectStatus("loading");
      setStatusMessage("Connecting wallet...");
      const session = await wallet.connect("selector");
      setPublicKey(session.address);
      setConnectStatus("success");
      setStatusMessage("Wallet connected.");
    } catch (e) {
      console.error("Wallet connection failed:", e);
      setConnectStatus("error");
      setStatusMessage("Wallet connection failed.");
      alert("Wallet connection failed.");
    }
  }


  // ==============================
  // SEND XLM
  // ==============================
  async function handleSend() {
    if (!publicKey) return;

    try {
      setSendStatus("loading");
      setStatusMessage("Sending XLM transaction...");
      setTxHash(null);

      const hash = await sendXLM(
        publicKey,
        PAYOUT_ADDRESS,
        "1"
      );

      setTxHash(hash);
      setSendStatus("success");
      setStatusMessage("Transaction submitted.");
    } catch (e) {
      console.error("Send failed:", e);
      setSendStatus("error");
      setStatusMessage("Transaction failed.");
      alert("Transaction failed.");
    }
  }


  // ==============================
  // SUBSCRIBE CONTRACT
  // ==============================
  async function handleSubscribe() {
    if (!publicKey) return;

    try {
      const latestTokenBalance = await getTokenBalance(publicKey);
      setTokenBalance(latestTokenBalance);

      const available = BigInt(latestTokenBalance ?? "0");
      const required = BigInt(SUBSCRIPTION_PAYMENT_AMOUNT);
      if (available < required) {
        throw new Error(
          `Insufficient XLM balance for subscription: need ${formatXlmFromStroops(required.toString())} XLM, have ${formatXlmFromStroops(available.toString())} XLM`
        );
      }

      setSubscribeStatus("loading");
      setStatusMessage("Preparing subscription...");
      setSubscriptionProgress(10);
      setSubscriptionStep("Building and signing transaction");

      const hash = await subscribe(
        publicKey,
        1,
        3600,
        SUBSCRIPTION_PAYMENT_AMOUNT
      );

      console.log("Subscription tx:", hash);
      setSubscriptionProgress(40);
      setSubscriptionStep("Waiting for ledger confirmation");

      // wait for RPC confirmation
      await new Promise(r => setTimeout(r, 4000));
      setSubscriptionProgress(55);
      setSubscriptionStep("Reading subscription state");

      // retry reading state
      const sub = await fetchSubscriptionWithRetry(
        publicKey,
        5,
        (attempt, total) => {
          const progress = 55 + Math.round((attempt / total) * 45);
          setSubscriptionProgress(progress);
          setSubscriptionStep(`Checking on-chain state (${attempt}/${total})`);
        }
      );

      setSubscription(sub);
      const token = await getTokenBalance(publicKey);
      setTokenBalance(token);
      setCached(subscriptionCacheKey(publicKey), sub, SUBSCRIPTION_CACHE_TTL_MS);
      await refreshBackendState(publicKey);
      setSubscribeStatus("success");
      setStatusMessage(
        sub ? "Subscription updated." : "No active subscription found yet."
      );

    } catch (e) {
      console.error("Subscribe failed:", e);
      setSubscribeStatus("error");
      setStatusMessage("Subscription failed.");
      alert("Subscription failed.");
    } finally {
      setTimeout(() => {
        setSubscriptionProgress(0);
        setSubscriptionStep("");
      }, 800);
    }
  }


  // ==============================
  // LOAD BALANCES + SUB ON CONNECT
  // ==============================
  useEffect(() => {
    if (!publicKey) return;

    const cachedBalances = getCached<Balance[]>(balanceCacheKey(publicKey));
    if (cachedBalances) {
      setBalances(cachedBalances);
      setStatusMessage("Loaded cached balances. Refreshing...");
    }

    const cachedSubscription = getCached<SubscriptionView>(
      subscriptionCacheKey(publicKey)
    );
    if (cachedSubscription) {
      setSubscription(cachedSubscription);
      setStatusMessage("Loaded cached subscription. Refreshing...");
    }

    setLoadStatus("loading");
    if (!cachedBalances && !cachedSubscription) {
      setStatusMessage("Loading wallet data...");
    }

    (async () => {
      try {
        const b = await wallet.getBalances();
        setBalances(b);
        setCached(balanceCacheKey(publicKey), b, BALANCE_CACHE_TTL_MS);

        const sub = await getSubscription(publicKey);
        setSubscription(sub);
        setCached(subscriptionCacheKey(publicKey), sub, SUBSCRIPTION_CACHE_TTL_MS);
        const token = await getTokenBalance(publicKey);
        setTokenBalance(token);
        await refreshBackendState(publicKey);
        setLoadStatus("success");
        setStatusMessage("Wallet data loaded.");

      } catch (e) {
        console.error("Load failed:", e);
        setLoadStatus("error");
        setStatusMessage("Failed to load wallet data.");
      } finally {
        setTimeout(() => {
          setLoadStatus("idle");
        }, 1000);
      }
    })();

  }, [publicKey]);


  // ==============================
  // CLEAR STATE ON DISCONNECT
  // ==============================
  useEffect(() => {
    if (!publicKey) {
      setBalances([]);
      setSubscription(null);
      setTxHash(null);
      setTokenBalance(null);
      setLoadStatus("idle");
      setConnectStatus("idle");
      setSendStatus("idle");
      setSubscribeStatus("idle");
      setSubscriptionProgress(0);
      setSubscriptionStep("");
      setStatusMessage(null);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) return;

    setCached(balanceCacheKey(publicKey), balances, BALANCE_CACHE_TTL_MS);
  }, [balances, publicKey]);

  useEffect(() => {
    if (!publicKey) return;

    if (!subscription) {
      removeCached(subscriptionCacheKey(publicKey));
      return;
    }

    setCached(subscriptionCacheKey(publicKey), subscription, SUBSCRIPTION_CACHE_TTL_MS);
  }, [subscription, publicKey]);

  useEffect(() => {
    if (!publicKey) return;

    const interval = setInterval(() => {
      void refreshBackendState(publicKey).catch((e) => {
        console.error("Backend refresh failed:", e);
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [publicKey]);


  // ==============================
  // UI
  // ==============================
  return (
    <div className="app-shell">
      <div className="app">
        <div className="hero">
          <p className="eyebrow">Testnet Native XLM Billing</p>
          <h1>Stellar Subscription App</h1>
          <p className="hero-copy">
            Connect your wallet, execute payment flows, and inspect live subscription state in a
            single dashboard.
          </p>
        </div>

        {statusMessage && (
          <div className="status-card" role="status" aria-live="polite">
            {anyBusy && <span className="spinner" aria-hidden="true" />}
            <span>{statusMessage}</span>
          </div>
        )}

        {subscribing && (
          <div className="progress-wrap" aria-live="polite">
            <div className="progress-label">
              <span>{subscriptionStep || "Updating subscription"}</span>
              <span>{subscriptionProgress}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${subscriptionProgress}%` }} />
            </div>
          </div>
        )}

        <div className="action-panel">
          <div className="action-row">
            {!publicKey && (
              <button className="btn btn-primary" onClick={connectWallet} disabled={connecting}>
                {connecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}

            {publicKey && (
              <>
                <button
                  className="btn"
                  onClick={handleSend}
                  disabled={sending || loading || subscribing}
                >
                  {sending ? "Sending..." : "Send 1 XLM to payout wallet"}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSubscribe}
                  disabled={subscribing || loading || sending}
                >
                  {subscribing ? "Subscribing..." : "Subscribe (1 XLM / hour)"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    await wallet.disconnect();
                    setPublicKey(null);
                  }}
                  disabled={anyBusy}
                >
                  Disconnect
                </button>
              </>
            )}
          </div>
        </div>

        <div className="card-grid">
          <section className="card">
            <h2>Wallet</h2>
            <p className="muted">
              {publicKey ? `Connected: ${formatAddress(publicKey)}` : "Wallet not connected"}
            </p>
            <p>XLM (SAC): {formatXlmFromStroops(tokenBalance)} XLM</p>
            <div className="stack">
              {loading && <p>Loading balances...</p>}
              {!loading &&
                balances.map((b) => (
                  <p key={b.asset + (b.issuer ?? "")}>
                    {b.asset}: {b.amount}
                  </p>
                ))}
              {!loading && balances.length === 0 && <p className="muted">No balances yet</p>}
            </div>
          </section>

          <section className="card">
            <h2>Subscription</h2>
            <p className="muted">Plan 1 • 1 hour • 1 XLM</p>
            {!subscribing && !subscription && <p>No active subscription</p>}
            {subscription && (
              <p>
                Plan: {subscription.planId}
                <br />
                Expires: {new Date(subscription.expiresAt * 1000).toLocaleString()}
              </p>
            )}
          </section>

          <section className="card">
            <h2>System</h2>
            <p className="muted">Payout wallet: {formatAddress(PAYOUT_ADDRESS)}</p>
            {!backendState && <p className="muted">No backend state yet</p>}
            {backendState && (
              <p>
                Observed: {backendState.observedAt || "n/a"}
                <br />
                XLM balance: {formatXlmFromStroops(backendState.xlmBalanceStroops)} XLM
                <br />
                Recent events: {backendState.recentEvents.length}
              </p>
            )}
            {txHash && <p className="muted">Last tx: {txHash.slice(0, 18)}...</p>}
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;

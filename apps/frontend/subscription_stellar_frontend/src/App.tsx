import { useState, useEffect } from "react";
import { wallet } from "@/wallet/manager";
import { sendXLM } from "./lib/sendXLM";
import { subscribe, getSubscription } from "@/contract/client";

function App() {
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const [txHash, setTxHash] = useState<string | null>(null);

  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [subscription, setSubscription] = useState<any>(null);

  function formatAddress(address: string) {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  }


  // ==============================
  // HELPER — RETRY READ SUBSCRIPTION
  // ==============================
  async function fetchSubscriptionWithRetry(address: string, tries = 5) {
    for (let i = 0; i < tries; i++) {
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
      setConnecting(true);
      const session = await wallet.connect("selector");
      setPublicKey(session.address);
    } catch (e) {
      console.error("Wallet connection failed:", e);
      alert("Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  }


  // ==============================
  // SEND XLM
  // ==============================
  async function handleSend() {
    if (!publicKey) return;

    try {
      setSending(true);

      const hash = await sendXLM(
        publicKey,
        publicKey,
        "1"
      );

      setTxHash(hash);
    } catch (e) {
      console.error("Send failed:", e);
      alert("Transaction failed.");
    } finally {
      setSending(false);
    }
  }


  // ==============================
  // SUBSCRIBE CONTRACT
  // ==============================
  async function handleSubscribe() {
    if (!publicKey) return;

    try {
      setSubscribing(true);

      const hash = await subscribe(
        publicKey,
        1,
        3600
      );

      console.log("Subscription tx:", hash);

      // wait for RPC confirmation
      await new Promise(r => setTimeout(r, 4000));

      // retry reading state
      const sub = await fetchSubscriptionWithRetry(publicKey);

      setSubscription(sub);

    } catch (e) {
      console.error("Subscribe failed:", e);
      alert("Subscription failed.");
    } finally {
      setSubscribing(false);
    }
  }


  // ==============================
  // LOAD BALANCES + SUB ON CONNECT
  // ==============================
  useEffect(() => {
    if (!publicKey) return;

    setLoading(true);

    (async () => {
      try {
        const b = await wallet.getBalances();
        setBalances(b);

        const sub = await getSubscription(publicKey);
        setSubscription(sub);

      } catch (e) {
        console.error("Load failed:", e);
      } finally {
        setLoading(false);
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
      setLoading(false);
    }
  }, [publicKey]);


  // ==============================
  // UI
  // ==============================
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        padding: 40,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
      }}
    >
      <h1>Stellar App</h1>

      {/* CONNECT BUTTON */}
      {!publicKey && (
        <button onClick={connectWallet}>
          {connecting ? "Connecting..." : "Connect Wallet"}
        </button>
      )}

      {/* WALLET INFO */}
      {publicKey && (
        <>
          <p>
            Connected wallet: <b>{formatAddress(publicKey)}</b>
          </p>

          <button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send 1 XLM to myself"}
          </button>

          <button onClick={handleSubscribe} disabled={subscribing}>
            {subscribing ? "Subscribing..." : "Subscribe to Plan"}
          </button>

          <button
            onClick={async () => {
              await wallet.disconnect();
              setPublicKey(null);
            }}
          >
            Disconnect
          </button>
        </>
      )}

      {/* BALANCES */}
      <h2>Balances</h2>

      {loading && <p>Loading...</p>}

      {!loading &&
        balances.map((b) => (
          <p key={b.asset + (b.issuer ?? "")}>
            {b.asset}: {b.amount}
          </p>
        ))}

      {/* SUBSCRIPTION */}
      <h2>Subscription</h2>

      {subscribing && <p>Updating subscription...</p>}

      {!subscribing && !subscription && (
        <p>No active subscription</p>
      )}

      {subscription && (
        <p>
          Plan: {subscription.planId} <br />
          Expires: {new Date(subscription.expiresAt * 1000).toLocaleString()}
        </p>
      )}

      {/* TX RESULT */}
      {txHash && (
        <p>
          Transaction sent! Hash: {txHash}
        </p>
      )}
    </div>
  );
}

export default App;

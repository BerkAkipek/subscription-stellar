import { useState, useEffect } from "react";
import { wallet } from "@/wallet/manager";
import { sendXLM } from "./lib/sendXLM";

function App() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!publicKey) return;

    setLoading(true);

    (async () => {
      const session = wallet.getSession();
      console.log("SESSION:", session);

      const b = await wallet.getBalances();
      console.log("BALANCES:", b);

      setBalances(b);
      setLoading(false);
    })();

  }, [publicKey]);

  // ------------------------------
  // CONNECT WALLET
  // ------------------------------
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

  // ------------------------------
  // SEND XLM
  // ------------------------------
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
      alert("Transaction failed. Check console.");
    } finally {
      setSending(false);
    }
  }

  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) return;

    setLoading(true);

    wallet.getBalances()
      .then(setBalances)
      .catch(console.error)
      .finally(() => setLoading(false));

  }, [publicKey]);

  return (
    <div style={{ padding: 40 }}>
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
            Connected wallet: <b>{publicKey}</b>
          </p>

          <button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send 1 XLM to myself"}
          </button>
        </>
      )}

      <button
        onClick={async () => {
          await wallet.disconnect();
          setPublicKey(null);
          setTxHash(null);
        }}
      >
        Disconnect
      </button>

      {/* BALANCES */}
      <h2>Balances</h2>

      {loading && <p>Loading...</p>}

      {!loading &&
        balances.map((b) => (
          <p key={b.asset + (b.issuer ?? "")}>
            {b.asset}: {b.amount}
          </p>
        ))}

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
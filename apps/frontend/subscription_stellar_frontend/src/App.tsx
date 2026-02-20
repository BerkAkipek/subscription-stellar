import { useState } from "react";
import freighterApi from "@stellar/freighter-api";
import { useBalance } from "./hooks/useBalance";
import { sendXLM } from "./lib/sendXLM";

function App() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function connectWallet() {
    try {
      setConnecting(true);

      await freighterApi.requestAccess();
      const result = await freighterApi.getAddress();

      if (!result.address) {
        alert("Freighter authorized but returned empty address.");
        return;
      }

      setPublicKey(result.address);

    } catch (e) {
      console.error("Freighter connection failed:", e);
      alert("Freighter permission rejected or extension issue.");
    } finally {
      setConnecting(false);
    }
  }

  // ✅ MOVE SEND FUNCTION HERE (before return)
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

  const { balances, loading } = useBalance(publicKey ?? undefined);

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

          {/* ✅ ADD SEND BUTTON HERE */}
          <button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : "Send 1 XLM to myself"}
          </button>
        </>
      )}

      {/* BALANCES */}
      <h2>Balances</h2>

      {loading && <p>Loading...</p>}

      {!loading &&
        balances.map((b) => (
          <p key={b.asset}>
            {b.asset}: {b.balance}
          </p>
        ))}

      {/* ✅ SHOW TX HASH */}
      {txHash && (
        <p>
          ✅ Transaction sent! Hash: {txHash}
        </p>
      )}
    </div>
  );
}

export default App;
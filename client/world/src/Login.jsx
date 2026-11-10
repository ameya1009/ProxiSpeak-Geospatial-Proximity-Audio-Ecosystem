import { useState } from "react";

export default function Login({ onJoin }) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    onJoin(username.trim());
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#e8f5e9",
      fontFamily: "Arial, sans-serif"
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "white",
        padding: "40px",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        textAlign: "center",
        width: "320px"
      }}>
        <h1 style={{ color: "#2563eb", marginBottom: "10px" }}>ProxiSpeak</h1>
        <p style={{ color: "#4b5563", marginBottom: "20px", fontSize: "14px" }}>
          Enter your name to join the virtual office
        </p>

        <input
          type="text"
          placeholder="Your Name / Handle"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={15}
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "16px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            marginBottom: "20px",
            boxSizing: "border-box",
            outline: "none"
          }}
          autoFocus
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: "#2563eb",
            color: "white",
            fontSize: "16px",
            fontWeight: "bold",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Join Room
        </button>
      </form>
    </div>
  );
}
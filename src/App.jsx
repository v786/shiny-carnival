import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const SERVER = "http://localhost:4000";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);

  const socket = useRef(null);

  async function loginOrRegister(mode) {
    try {
      const res = await axios.post(`${SERVER}/auth/${mode}`, { username, password });
      setToken(res.data.token);
      localStorage.setItem("token", res.data.token);
      setLoggedInUser(res.data.user);
    } catch (err) {
      alert(err.response?.data?.error || "Error");
    }
  }

  useEffect(() => {
    if (!token) return;

    socket.current = io(SERVER, { auth: { token } });

    socket.current.on("connect", () => {
      setConnected(true);
      socket.current.emit("join", { roomId: "global" });
    });

    socket.current.on("history", (msgs) => setMessages(msgs));

    socket.current.on("message", (msg) =>
      setMessages((m) => [...m, msg])
    );

    return () => socket.current.disconnect();
  }, [token]);

  function sendMessage() {
    if (!input.trim()) return;
    socket.current.emit("message", {
      roomId: "global",
      content: input
    });
    setInput("");
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 300, margin: "50px auto" }}>
        <h2>Login / Register</h2>
        <input
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        /><br /><br />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        /><br /><br />
        <button onClick={() => loginOrRegister("login")}>Login</button>
        <button onClick={() => loginOrRegister("register")}>Register</button>
      </div>
    );
  }

  return (
    <div style={{ width: 500, margin: "40px auto", fontFamily: "Arial" }}>
      <h2>Chat — Global Room</h2>
      <p>Logged in as <b>{loggedInUser?.username}</b></p>
      <p>Socket: {connected ? "Connected" : "Disconnected"}</p>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 10,
          minHeight: 300,
          maxHeight: 300,
          overflowY: "auto",
        }}
      >
        {messages.map((m) => (
          <div key={m.id} style={{ marginBottom: 8 }}>
            <b>{m.senderName}</b>: {m.content}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          style={{ width: "80%" }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}
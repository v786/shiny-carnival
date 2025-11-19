// src/App.jsx
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const SERVER = "http://localhost:4000";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);

  const [usersList, setUsersList] = useState([]);
  const [messages, setMessages] = useState([]); // messages for activeRoom
  const [roomMessages, setRoomMessages] = useState({}); // { roomId: [msgs] }
  const [activeRoom, setActiveRoom] = useState('global');

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

  // fetch users list
  useEffect(() => {
    if (!token) return;
    axios.get(`${SERVER}/users`)
      .then(r => setUsersList(r.data))
      .catch(() => {});
  }, [token]);

  // setup socket
  useEffect(() => {
    if (!token) return;

    socket.current = io(SERVER, { auth: { token } });

    socket.current.on("connect", () => {
      setConnected(true);
      // auto-join global room
      socket.current.emit("join", { roomId: "global" });
      setActiveRoom("global");
    });

    socket.current.on("history", (msgs) => {
      if (!msgs) return;
      const roomId = msgs[0]?.roomId || activeRoom || "global";
      setRoomMessages(prev => ({ ...prev, [roomId]: msgs }));
      if (roomId === activeRoom) setMessages(msgs);
    });

    socket.current.on("message", (msg) => {
      setRoomMessages(prev => {
        const arr = (prev[msg.roomId] || []).concat(msg);
        if (msg.roomId === activeRoom) setMessages(arr);
        return { ...prev, [msg.roomId]: arr };
      });
    });

    socket.current.on("disconnect", () => setConnected(false));

    return () => {
      socket.current.disconnect();
      socket.current = null;
      setConnected(false);
    };
  }, [token]);

  async function startPrivateChat(otherUserId) {
    try {
      // obtain private room id from server
      const res = await axios.post(`${SERVER}/users/private-room`, { token, otherUserId });
      const { roomId } = res.data;
      // join the room
      socket.current.emit("join", { roomId });
      setActiveRoom(roomId);
      // history will be delivered via 'history' event
      // ensure UI switches to this room's messages (if already present)
      setMessages(roomMessages[roomId] || []);
    } catch (e) {
      alert('Could not start private chat');
    }
  }

  function openRoom(roomId) {
    setActiveRoom(roomId);
    // if not joined earlier, emit join
    if (socket.current) socket.current.emit("join", { roomId });
    setMessages(roomMessages[roomId] || []);
  }

  function sendMessage() {
    if (!input.trim()) return;
    socket.current.emit("message", {
      roomId: activeRoom,
      content: input
    });
    setInput("");
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 340, margin: "40px auto", fontFamily: "Arial" }}>
        <h2>Login / Register</h2>
        <input placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)} /><br /><br />
        <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><br /><br />
        <button onClick={() => loginOrRegister("login")}>Login</button>
        <button onClick={() => loginOrRegister("register")}>Register</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 20, fontFamily: "Arial", maxWidth: 1000, margin: "30px auto" }}>
      <div style={{ width: 220 }}>
        <h3>People</h3>
        <div style={{ border: "1px solid #ddd", padding: 8 }}>
          <div style={{ marginBottom: 8 }}>
            <b>{loggedInUser?.username}</b> (you)
            {console.log(loggedInUser)}
            {console.log(usersList)}
          </div>
          {usersList.filter(u => u.id !== loggedInUser.id).map(u => (
            <div key={u.id} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{u.username}</span>
              <button onClick={() => startPrivateChat(u.id)}>Chat</button>
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: 16 }}>Rooms</h4>
        <div>
          <div style={{ marginBottom: 6 }}>
            <button onClick={() => openRoom("global")}>Global</button>
          </div>
          {/* show active private rooms (roomIds mapped to names) */}
          {Object.keys(roomMessages).filter(r => r !== "global").map(r => (
            <div key={r} style={{ marginBottom: 6 }}>
              <button onClick={() => openRoom(r)}>{r}</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <h2>Room: {activeRoom}</h2>
        <p>Logged in as <b>{loggedInUser?.username}</b> — Socket: {connected ? "Connected" : "Disconnected"}</p>

        <div style={{ border: "1px solid #ddd", padding: 10, minHeight: 360, maxHeight: 360, overflowY: "auto" }}>
          {(messages || []).map((m) => (
            <div key={m.id} style={{ marginBottom: 8 }}>
              <b>{m.senderName}</b>: {m.content} <span style={{ color: "#888", fontSize: 12 }}> — {new Date(m.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <input style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

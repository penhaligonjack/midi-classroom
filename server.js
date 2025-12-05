const express = require("express");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;
const app = express();

// === Serve static files ===
// This allows host.html, student.html, etc to load in the browser
app.use(express.static(path.join(__dirname)));

// Default route → open host page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

// === WebSocket server ===
const wss = new WebSocketServer({ server });
const rooms = {};

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      console.log("Invalid JSON:", raw);
      return;
    }

    if (msg.type === "join") {
      ws.role = msg.role;
      ws.room = msg.room;
      if (!rooms[msg.room]) rooms[msg.room] = { host: null, students: new Set() };

      if (msg.role === "host") {
        rooms[msg.room].host = ws;
      } else {
        rooms[msg.room].students.add(ws);
      }
      return;
    }

    if (msg.type === "midi") {
      if (!ws.room) return;
      const room = rooms[ws.room];
      if (room && room.host && room.host.readyState === 1) {
        room.host.send(JSON.stringify({ type: "midi", data: msg.data }));
      }
    }
  });

  ws.on("close", () => {
    if (ws.room && rooms[ws.room]) {
      rooms[ws.room].students?.delete(ws);
      if (rooms[ws.room].host === ws) rooms[ws.room].host = null;
    }
  });
});

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let rooms = {}; // roomName → { host: ws, students: Set<ws> }

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
      const { role, room } = msg;
      ws.role = role;
      ws.room = room;

      if (!rooms[room]) {
        rooms[room] = { host: null, students: new Set() };
      }

      if (role === "host") {
        rooms[room].host = ws;
      } else {
        rooms[room].students.add(ws);
      }

      console.log(`Client joined room ${room} as ${role}`);
      return;
    }

    // Relay MIDI
    if (msg.type === "midi") {
      const room = rooms[ws.room];
      if (!room) return;

      if (ws.role === "host") {
        // Host sends to all students
        room.students.forEach(s => {
          if (s.readyState === WebSocket.OPEN) {
            s.send(JSON.stringify(msg));
          }
        });
      } else {
        // Student sends to host
        if (room.host && room.host.readyState === WebSocket.OPEN) {
          room.host.send(JSON.stringify(msg));
        }
      }
    }
  });

  ws.on("close", () => {
    const room = rooms[ws.room];
    if (!room) return;

    if (ws.role === "host") {
      rooms[ws.room].host = null;
    } else {
      room.students.delete(ws);
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log("WebSocket server running on port " + PORT);
});

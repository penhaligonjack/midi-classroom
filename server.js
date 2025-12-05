// server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

// Create basic HTTP server to serve the HTML files
const server = http.createServer((req, res) => {
  let filePath = "." + req.url;
  if (filePath === "./") {
    filePath = "./host.html"; // Default to host page
  }

  const ext = path.extname(filePath);
  let contentType = "text/html";

  if (ext === ".js") contentType = "text/javascript";
  if (ext === ".css") contentType = "text/css";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("404 - File Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const obj = JSON.parse(msg);

      if (obj.type === "join") {
        ws.role = obj.role;
        ws.room = obj.room;

        if (!rooms.has(ws.room)) {
          rooms.set(ws.room, { hosts: new Set(), students: new Set() });
        }

        const room = rooms.get(ws.room);

        if (ws.role === "host") room.hosts.add(ws);
        if (ws.role === "student") room.students.add(ws);

        return;
      }

      if (obj.type === "midi") {
        const room = rooms.get(ws.room);
        if (!room) return;

        room.hosts.forEach((hostSocket) => {
          if (hostSocket.readyState === WebSocket.OPEN) {
            hostSocket.send(
              JSON.stringify({
                type: "midi",
                data: obj.data,
              })
            );
          }
        });
      }
    } catch (err) {
      console.log("Error:", err);
    }
  });

  ws.on("close", () => {
    if (!ws.room || !rooms.has(ws.room)) return;
    const room = rooms.get(ws.room);
    room.hosts.delete(ws);
    room.students.delete(ws);
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

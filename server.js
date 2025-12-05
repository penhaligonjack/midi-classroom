const express = require("express");
const path = require("path");
const WebSocket = require("ws");

const app = express();
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

const server = app.listen(process.env.PORT || 8080, () =>
  console.log("HTTP server running")
);

// ---- WebSocket ----
const wss = new WebSocket.Server({ server });

wss.on("connection", ws => {
  ws.on("message", msg => {
    const data = msg.toString();
    // simple echo test
    ws.send("Server received: " + data);
  });
});

// --- SERVER SETUP ---
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const WebSocket = require("ws");

const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(__dirname + "/public"));

app.get("/", (req, res) => res.sendFile(__dirname + "/public/host.html"));


// ---- DATA MODEL ----
// rooms = {
//   77: {
//     host: ws,
//     students: { 1: ws, 2: ws, ... }
//   },
//   78: { ... }
// }
const rooms = {};

// Make sure a room always exists
function ensureRoom(room) {
    if (!rooms[room]) {
        rooms[room] = { host: null, students: {} };
    }
}


// ---- WebSocket Handling ----
wss.on("connection", (ws) => {
    console.log("New WebSocket client connected.");

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (e) {
            console.log("Invalid JSON", raw);
            return;
        }

        const { type } = msg;

        // ──────────────────────────────────────────────
        // A student or host JOINING a room
        // ──────────────────────────────────────────────
        if (type === "join") {
            const { role, room, keyboard } = msg;
            ensureRoom(room);

            // Save metadata on socket
            ws.role = role;
            ws.room = room;
            ws.keyboard = keyboard || null;

            if (role === "host") {
                rooms[room].host = ws;
                console.log(`Host joined room ${room}`);
            }

            if (role === "student") {
                rooms[room].students[keyboard] = ws;
                console.log(`Student ${keyboard} joined room ${room}`);

                // Notify host
                if (rooms[room].host) {
                    rooms[room].host.send(
                        JSON.stringify({
                            type: "student-join",
                            keyboard,
                        })
                    );
                }
            }
            return;
        }

        // ──────────────────────────────────────────────
        // STUDENT → SERVER → HOST  (Monitoring only)
        // ──────────────────────────────────────────────
        if (type === "student-midi") {
            const { room, keyboard, midi } = msg;
            ensureRoom(room);

            // Forward ONLY to the host
            const host = rooms[room].host;
            if (host) {
                host.send(
                    JSON.stringify({
                        type: "midi-from-student",
                        keyboard,
                        midi,
                    })
                );
            }
            return;
        }

        // ──────────────────────────────────────────────
        // STUDENT PLAYS → Student must hear themselves
        // ──────────────────────────────────────────────
        if (type === "self-playback") {
            ws.send(JSON.stringify({
                type: "play-local",
                midi: msg.midi
            }));
            return;
        }


        // ──────────────────────────────────────────────
        // HOST PLAYS → send ONLY to selected students
        // ──────────────────────────────────────────────
        if (type === "host-midi") {
            const { room, targets, midi } = msg;
            ensureRoom(room);

            targets.forEach(kb => {
                const s = rooms[room].students[kb];
                if (s && s.readyState === WebSocket.OPEN) {
                    s.send(JSON.stringify({
                        type: "play-from-host",
                        midi
                    }));
                }
            });
            return;
        }

    });

    // ──────────────────────────────────────────────
    // HANDLE DISCONNECTS
    // ──────────────────────────────────────────────
    ws.on("close", () => {
        const { room, role, keyboard } = ws;
        if (!room) return;

        ensureRoom(room);

        if (role === "host") {
            rooms[room].host = null;
            console.log(`Host left room ${room}`);
        }

        if (role === "student") {
            delete rooms[room].students[keyboard];
            console.log(`Student ${keyboard} left room ${room}`);
        }
    });
});


// --- START SERVER ---
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("Server running on port", PORT));

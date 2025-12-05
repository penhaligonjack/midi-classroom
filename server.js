// -----------------------------
// MIDI Classroom WebSocket Server
// -----------------------------

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Serve static files (host.html, student.html)
app.use(express.static(path.join(__dirname)));

// Required for Railway
const PORT = process.env.PORT || 3000;

// WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
let hosts = {};        // { classroom: ws }
let students = {};     // { classroom: { keyboardID: ws } }

function ensureClassroom(classroom) {
    if (!students[classroom]) students[classroom] = {};
}

// -----------------------------
// WebSocket Connections
// -----------------------------

wss.on("connection", (ws) => {
    console.log("Client connected.");

    ws.on("message", (msg) => {
        try {
            const data = JSON.parse(msg);
            const type = data.type;

            // -------------------------
            // Host joins classroom
            // -------------------------
            if (type === "host-join") {
                hosts[data.classroom] = ws;
                ensureClassroom(data.classroom);
                console.log(`Host connected to classroom ${data.classroom}`);
                return;
            }

            // -------------------------
            // Student joins classroom
            // -------------------------
            if (type === "student-join") {
                ensureClassroom(data.classroom);
                students[data.classroom][data.keyboard] = ws;

                console.log(
                    `Student keyboard ${data.keyboard} joined classroom ${data.classroom}`
                );

                // Acknowledge to student
                ws.send(
                    JSON.stringify({
                        type: "joined",
                        classroom: data.classroom,
                        keyboard: data.keyboard,
                    })
                );

                return;
            }

            // -------------------------
            // Student → Host (MIDI)
            // -------------------------
            if (type === "student-midi") {
                const host = hosts[data.classroom];
                if (host && host.readyState === WebSocket.OPEN) {
                    host.send(
                        JSON.stringify({
                            type: "midi",
                            keyboard: data.keyboard,
                            note: data.note,
                            velocity: data.velocity,
                        })
                    );
                }
                return;
            }

            // -------------------------
            // Host → Students (broadcast)
            // -------------------------
            if (type === "host-broadcast") {
                ensureClassroom(data.classroom);

                Object.values(students[data.classroom]).forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(
                            JSON.stringify({
                                type: "broadcast",
                                payload: data.payload,
                            })
                        );
                    }
                });
                return;
            }
        } catch (e) {
            console.error("Invalid WebSocket message:", msg);
        }
    });

    ws.on("close", () => {
        console.log("Client disconnected.");

        // Remove from hosts
        for (const classroom of Object.keys(hosts)) {
            if (hosts[classroom] === ws) {
                delete hosts[classroom];
            }
        }

        // Remove from students
        for (const classroom of Object.keys(students)) {
            for (const id of Object.keys(students[classroom])) {
                if (students[classroom][id] === ws) {
                    delete students[classroom][id];
                }
            }
        }
    });
});

// -----------------------------
// Start server
// -----------------------------
server.listen(PORT, () => {
    console.log("MIDI Classroom server running on port", PORT);
});

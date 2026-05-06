const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SAVE_FILE = "save.json";

app.use(express.static("public"));

let rooms = {};
let roomUsers = {};

const ALLOWED_SIZES = [8, 16, 32, 64, 128, 256, 512];

function validateSize(size) {
  const n = Number(size);
  return ALLOWED_SIZES.includes(n) ? n : 32;
}

function createRoom(room, size) {
  const safeSize = validateSize(size);

  rooms[room] = {
    size: safeSize,
    board: Array.from({ length: safeSize }, () =>
      Array(safeSize).fill("#ffffff")
    ),
  };
}

function load() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      rooms = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
    }
  } catch {
    rooms = {};
  }
}

function save() {
  try {
    fs.writeFileSync(SAVE_FILE, JSON.stringify(rooms));
  } catch {}
}

load();

io.on("connection", (socket) => {
  const room = socket.handshake.query.room || "default";
  const size = validateSize(socket.handshake.query.size || 32);

  if (!rooms[room]) {
    createRoom(room, size);
  }

  if (!roomUsers[room]) roomUsers[room] = 0;
  roomUsers[room]++;

  socket.join(room);

  io.to(room).emit("users", roomUsers[room]);
  socket.emit("init", rooms[room]);

  socket.on("draw", (data) => {
    const r = rooms[room];
    if (!r) return;

    const x = Number(data.x);
    const y = Number(data.y);
    const color = data.color;

    if (Number.isNaN(x) || Number.isNaN(y)) return;
    if (x < 0 || y < 0 || x >= r.size || y >= r.size) return;

    r.board[y][x] = color;
    io.to(room).emit("draw", { x, y, color });
  });

  socket.on("setBoard", (data) => {
    const r = rooms[room];
    if (!r || !data || !Array.isArray(data.board)) return;

    const board = data.board;
    if (board.length !== r.size) return;
    for (const row of board) {
      if (!Array.isArray(row) || row.length !== r.size) return;
    }

    r.board = board.map((row) => row.slice());
    io.to(room).emit("boardUpdate", { board: r.board, size: r.size });
    save();
  });

  socket.on("chat", (data) => {
    io.to(room).emit("chat", {
      user: data.user || "名無し",
      message: data.message || "",
    });
  });

  socket.on("save", save);

  socket.on("disconnect", () => {
    roomUsers[room] = Math.max(0, (roomUsers[room] || 1) - 1);

    io.to(room).emit("users", roomUsers[room]);
    io.to(room).emit("chat", {
      user: "system",
      message: "👋 退出しました",
    });
  });
});

setInterval(save, 5000);

server.listen(PORT, "0.0.0.0", () => {
  console.log("🌳 ドット絵の森 起動");
});
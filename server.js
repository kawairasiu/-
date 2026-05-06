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

const ALLOWED_SIZES = [8,16,32,64,128,256,512];

function validateSize(size) {
  size = Number(size);
  return ALLOWED_SIZES.includes(size) ? size : 32;
}

function createRoom(room, size) {
  size = validateSize(size);

  rooms[room] = {
    size,
    board: Array.from({ length: size }, () =>
      Array(size).fill("#ffffff")
    )
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
  let size = validateSize(socket.handshake.query.size || 32);

  if (!rooms[room]) {
    createRoom(room, size);
  }

  if (!roomUsers[room]) roomUsers[room] = 0;
  roomUsers[room]++;

  socket.join(room);

  io.to(room).emit("users", roomUsers[room]);

  socket.emit("init", rooms[room]);

  socket.on("draw", ({ x, y, color }) => {
    const r = rooms[room];
    if (!r) return;

    if (x < 0 || y < 0 || x >= r.size || y >= r.size) return;

    r.board[y][x] = color;

    io.to(room).emit("draw", { x, y, color });
  });

  socket.on("chat", (data) => {
    io.to(room).emit("chat", {
      user: data.user || "名無し",
      message: data.message
    });
  });

  socket.on("disconnect", () => {
    roomUsers[room]--;

    io.to(room).emit("users", roomUsers[room]);

    io.to(room).emit("chat", {
      user: "system",
      message: "👋 退出しました"
    });
  });

  socket.on("save", save);
});

setInterval(save, 5000);

server.listen(PORT, () => {
  console.log("🌳 ドット絵の森 起動");
});
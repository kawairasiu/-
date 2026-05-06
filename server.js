const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const SAVE_FILE = "save.json";
const GRID_SIZE = 32;

app.use(express.static("public"));

let rooms = {};
let roomUsers = {};

/* ===== 保存読み込み ===== */
function loadSave() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      rooms = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
    }
  } catch {
    rooms = {};
  }
}

/* ===== 保存 ===== */
function saveAll() {
  try {
    fs.writeFileSync(SAVE_FILE, JSON.stringify(rooms));
  } catch {}
}

loadSave();

/* ===== Socket ===== */
io.on("connection", (socket) => {
  const room = socket.handshake.query.room || "default";

  if (!rooms[room]) {
    rooms[room] = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill("#ffffff")
    );
  }

  if (!roomUsers[room]) roomUsers[room] = 0;
  roomUsers[room]++;

  socket.join(room);

  io.to(room).emit("users", roomUsers[room]);

  io.to(room).emit("chat", {
    user: "system",
    message: "👤 誰かが入室しました"
  });

  socket.emit("init", rooms[room]);

  /* ===== 描画 ===== */
  socket.on("draw", (data) => {
    const { x, y, color } = data;

    if (!rooms[room]) return;
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    rooms[room][y][x] = color;

    io.to(room).emit("draw", { x, y, color });
  });

  /* ===== チャット ===== */
  socket.on("chat", (data) => {
    io.to(room).emit("chat", {
      user: data.user || "名無し",
      message: data.message
    });
  });

  /* ===== 切断 ===== */
  socket.on("disconnect", () => {
    roomUsers[room]--;

    io.to(room).emit("users", roomUsers[room]);

    io.to(room).emit("chat", {
      user: "system",
      message: "👋 誰かが退出しました"
    });
  });

  socket.on("save", saveAll);
});

/* ===== 自動保存 ===== */
setInterval(saveAll, 5000);

/* ===== 起動 ===== */
server.listen(PORT, "0.0.0.0", () => {
  console.log("🌳 ドット絵の森起動");
});
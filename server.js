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

/* ===== 保存ロード ===== */
function load() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      rooms = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
    }
  } catch {
    rooms = {};
  }
}

/* ===== 保存 ===== */
function save() {
  try {
    fs.writeFileSync(SAVE_FILE, JSON.stringify(rooms));
  } catch {}
}

load();

/* ===== サイズ制限（固定） ===== */
function validateSize(size) {
  const allowed = [8,16,32,64,128,256,512];
  return allowed.includes(size) ? size : 32;
}

/* ===== ルーム作成 ===== */
function createRoom(room, size) {
  size = validateSize(size);

  rooms[room] = {
    size,
    board: Array.from({ length: size }, () =>
      Array(size).fill("#ffffff")
    )
  };
}

/* ===== 接続 ===== */
io.on("connection", (socket) => {
  const room = socket.handshake.query.room || "default";
  let size = Number(socket.handshake.query.size || 32);

  size = validateSize(size);

  if (!rooms[room]) {
    createRoom(room, size);
  }

  if (!roomUsers[room]) roomUsers[room] = 0;
  roomUsers[room]++;

  socket.join(room);

  io.to(room).emit("users", roomUsers[room]);

  io.to(room).emit("chat", {
    user: "system",
    message: "👤 入室しました"
  });

  socket.emit("init", rooms[room]);

  /* ===== 描画 ===== */
  socket.on("draw", (data) => {
    const r = rooms[room];
    if (!r) return;

    const { x, y, color } = data;

    if (x < 0 || y < 0 || x >= r.size || y >= r.size) return;

    r.board[y][x] = color;

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
      message: "👋 退出しました"
    });
  });

  socket.on("save", save);
});

/* ===== 自動保存 ===== */
setInterval(save, 5000);

/* ===== 起動 ===== */
server.listen(PORT, "0.0.0.0", () => {
  console.log("🌳 ドット絵の森 起動");
});
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

/* =========================
   データ（ルームごと）
========================= */
let rooms = {};

/* =========================
   保存読み込み
========================= */
function loadSave() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      rooms = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
      console.log("✅ save loaded");
    }
  } catch (err) {
    console.log("⚠️ load failed, starting fresh");
    rooms = {};
  }
}

/* =========================
   保存書き込み
========================= */
function saveAll() {
  try {
    fs.writeFileSync(SAVE_FILE, JSON.stringify(rooms));
  } catch (err) {
    console.log("❌ save failed");
  }
}

/* 起動時ロード */
loadSave();

/* =========================
   Socket接続
========================= */
io.on("connection", (socket) => {
  const room = socket.handshake.query.room || "default";

  /* ルーム初期化 */
  if (!rooms[room]) {
    rooms[room] = Array.from({ length: GRID_SIZE }, () =>
      Array(GRID_SIZE).fill("#000000")
    );
  }

  socket.join(room);

  /* 初期データ送信 */
  socket.emit("init", rooms[room]);

  console.log(`👤 joined room: ${room}`);

  /* =========================
     描画受信
  ========================= */
  socket.on("draw", (data) => {
    if (!rooms[room]) return;

    const { x, y, color, user } = data;

    // バリデーション（安全）
    if (
      x < 0 || x >= GRID_SIZE ||
      y < 0 || y >= GRID_SIZE
    ) return;

    rooms[room][y][x] = color;

    // 同じルーム全員に送信
    io.to(room).emit("draw", {
      x,
      y,
      color,
      user: user || "anon"
    });
  });

  /* =========================
     手動保存
  ========================= */
  socket.on("save", () => {
    saveAll();
    console.log("💾 manual save");
  });
});

/* =========================
   定期自動保存
========================= */
setInterval(() => {
  saveAll();
}, 5000);

/* =========================
   サーバー起動
========================= */
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌳 ドット絵の森 running → http://localhost:${PORT}`);
});
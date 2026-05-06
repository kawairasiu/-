const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const ALLOWED_SIZES = [8,16,32,64,128,256,512];

let rooms = {};

function createRoom(id, size){
  size = ALLOWED_SIZES.includes(Number(size)) ? Number(size) : 32;

  rooms[id] = {
    size,
    board: Array.from({length:size},()=>Array(size).fill("#ffffff"))
  };
}

io.on("connection",(socket)=>{

  const { room, size, name } = socket.handshake.query;

  socket.name = name || "名無し";
  socket.room = room;

  if(!rooms[room]){
    createRoom(room,size);
  }

  socket.join(room);

  socket.emit("init", rooms[room]);

  socket.on("draw",({x,y,color})=>{
    const r = rooms[room];
    if(!r) return;

    if(x<0||y<0||x>=r.size||y>=r.size) return;

    r.board[y][x]=color;

    io.to(room).emit("draw",{x,y,color});
  });

  socket.on("chat",(msg)=>{
    io.to(room).emit("chat",{
      user: socket.name,
      message: msg.message
    });
  });

});

server.listen(PORT,()=>{
  console.log("🌳 ドット絵の森起動");
});
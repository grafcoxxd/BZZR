const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const playerColors = [
  '#FCD34D', '#4ADE80', '#6EE7B7', '#A78BFA', '#F87171', 
  '#38BDF8', '#FB923C', '#2DD4BF', '#9CA3AF'
];

let availableColors = [...playerColors];
app.use(express.static(path.join(__dirname, 'public')));

let buzzerLocked = false;
let buzzerWinnerName = null;
let players = new Map();
let currentImage = null; // Speichert das aktuelle Bild für neue Spieler

io.on('connection', (socket) => {
  console.log('Ein Benutzer ist verbunden');

  // Falls ein Bild aktiv ist, schicke es dem neuen Benutzer sofort
  if (currentImage) {
    socket.emit('push-image', currentImage);
  }

  if (buzzerLocked) {
    socket.emit('buzzer-locked', buzzerWinnerName);
  }

  socket.on('register-moderator', () => {
    socket.join('moderator-room');
    io.emit('update-players', Array.from(players.values()));
  });

  socket.on('register-player', (data) => {
    const name = typeof data === 'object' ? data.name : data;
    const initialScore = typeof data === 'object' ? data.score : 0;

    if (availableColors.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableColors.length);
        const color = availableColors.splice(randomIndex, 1)[0];
        players.set(socket.id, { name, score: initialScore, color, text: '' });
        io.emit('update-players', Array.from(players.values()));
    }
  });

  socket.on('buzzer-pressed', (name) => {
    if (!buzzerLocked) {
      buzzerLocked = true;
      buzzerWinnerName = name;
      io.emit('buzzer-locked', name);
      io.to('moderator-room').emit('buzzer-winner', name);
    }
  });

  socket.on('reset-buzzer', () => {
    buzzerLocked = false;
    buzzerWinnerName = null;
    io.emit('buzzer-unlocked');
  });

  socket.on('moderator-correct', (points) => {
    const player = Array.from(players.values()).find(p => p.name === buzzerWinnerName);
    if (player) {
      player.score += points;
      io.emit('update-players', Array.from(players.values()));
      io.emit('play-correct-sound');
      buzzerLocked = false;
      buzzerWinnerName = null;
      io.emit('buzzer-unlocked');
    }
  });

  socket.on('moderator-release-buzzer', () => {
    io.emit('play-wrong-sound');
    buzzerLocked = false;
    buzzerWinnerName = null;
    io.emit('buzzer-unlocked');
  });

  socket.on('image-updated', (imgData) => {
    currentImage = imgData; // Bild im Server-Speicher merken
    io.emit('push-image', imgData);
  });

  socket.on('image-removed', () => {
    currentImage = null; // Bild im Server-Speicher löschen
    io.emit('push-image', null);
  });

  socket.on('add-point-to-player', (playerName) => {
    const player = Array.from(players.values()).find(p => p.name === playerName);
    if (player) {
        player.score += 1;
        io.emit('update-players', Array.from(players.values()));
    }
  });

  socket.on('subtract-point-from-player', (playerName) => {
    const player = Array.from(players.values()).find(p => p.name === playerName);
    if (player && player.score > 0) {
        player.score -= 1;
        io.emit('update-players', Array.from(players.values()));
    }
  });

  socket.on('player-typing', (text) => {
      const player = players.get(socket.id);
      if (player) {
          player.text = text;
          io.emit('update-text', { name: player.name, text: player.text });
      }
  });

  socket.on('moderator-reset-all-scores', () => {
    players.forEach((player) => { player.score = 0; });
    io.emit('scores-reset-globally');
    io.emit('update-players', Array.from(players.values()));
  });

  socket.on('disconnect', () => {
    const disconnectedPlayer = players.get(socket.id);
    if (disconnectedPlayer) {
        availableColors.push(disconnectedPlayer.color);
        players.delete(socket.id);
        io.emit('update-players', Array.from(players.values()));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
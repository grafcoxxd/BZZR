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

io.on('connection', (socket) => {
  console.log('Ein Benutzer ist verbunden');

  if (buzzerLocked) {
    socket.emit('buzzer-locked', buzzerWinnerName);
  }

  socket.on('register-moderator', () => {
    socket.join('moderator-room');
    io.emit('update-players', Array.from(players.values()));
  });

  socket.on('register-player', (data) => {
    // Falls data ein String ist (alter Code), konvertieren wir es
    const name = typeof data === 'object' ? data.name : data;
    const initialScore = typeof data === 'object' ? data.score : 0;

    if (availableColors.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableColors.length);
        const assignedColor = availableColors.splice(randomIndex, 1)[0];

        players.set(socket.id, { 
            name: name, 
            score: initialScore, 
            text: '', 
            color: assignedColor 
        }); 
        
        io.emit('update-players', Array.from(players.values()));
    }
  });

  socket.on('buzzer-pressed', () => {
    if (!buzzerLocked) {
        const player = players.get(socket.id);
        if (player) {
            buzzerLocked = true;
            buzzerWinnerName = player.name;
            io.emit('buzzer-locked', buzzerWinnerName);
            io.to('moderator-room').emit('buzzer-winner', buzzerWinnerName);
        }
    }
  });

  socket.on('moderator-correct', (points) => {
    const winner = Array.from(players.values()).find(p => p.name === buzzerWinnerName);
    if (winner) {
        winner.score += points;
        io.emit('update-players', Array.from(players.values()));
    }
    io.emit('play-correct-sound');
    buzzerLocked = false;
    buzzerWinnerName = null;
    io.emit('buzzer-unlocked');
  });

  socket.on('moderator-release-buzzer', () => {
    if (buzzerWinnerName) {
        players.forEach((player) => {
            if (player.name !== buzzerWinnerName) {
                player.score += 1;
            }
        });
        io.emit('update-players', Array.from(players.values()));
    }
    io.emit('play-wrong-sound');
    buzzerLocked = false;
    buzzerWinnerName = null;
    io.emit('buzzer-unlocked');
  });

  socket.on('reset-buzzer', () => {
    buzzerLocked = false;
    buzzerWinnerName = null;
    io.emit('buzzer-unlocked');
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

  socket.on('disconnect', () => {
    const disconnectedPlayer = players.get(socket.id);
    if (disconnectedPlayer) {
        availableColors.push(disconnectedPlayer.color);
        players.delete(socket.id);
        io.emit('update-players', Array.from(players.values()));
    }
  });

  // Alle Punkte für alle Spieler zurücksetzen
  socket.on('moderator-reset-all-scores', () => {
    console.log('Moderator setzt alle Punkte zurück.');
    players.forEach((player) => {
      player.score = 0;
    });
  // Wichtig: Signal an alle senden, damit auch der LocalStorage geleert wird
    io.emit('scores-reset-globally');
    io.emit('update-players', Array.from(players.values()));
  });

  // Bild-Übertragung
  socket.on('moderator-show-image', (imageData) => {
    io.emit('show-image-on-buzzer', imageData);
  });

  socket.on('moderator-hide-image', () => {
    io.emit('hide-image-on-buzzer');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
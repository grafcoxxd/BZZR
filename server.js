const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7 // Limit auf 10MB erhöht
});

const playerColors = [
  '#FCD34D', '#4ADE80', '#6EE7B7', '#A78BFA', '#F87171', 
  '#38BDF8', '#FB923C', '#2DD4BF', '#9CA3AF'
];

let availableColors = [...playerColors];
app.use(express.static(path.join(__dirname, 'public')));

let buzzerLocked = false;
let buzzerWinnerName = null;
const players = new Map();

const defaultHints = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  title: `Hinweis ${i + 1}`,
  text: `Tipp ${i + 1}`,
  cost: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5][i]
}));

let tipitState = {
  playerRevealedHints: {},
  globalRevealedHints: [],
  bonusHintRevealed: false,
  bonusHintText: "Das ist ein Bonushinweis für alle!",
  hints: JSON.parse(JSON.stringify(defaultHints))
};

io.on('connection', (socket) => {
  console.log('Ein Benutzer ist verbunden');

  // Sende aktuellen TipIt Status an neu verbundene Clients
  socket.emit('tipit-state-update', tipitState);

  if (buzzerLocked) {
    socket.emit('buzzer-locked', buzzerWinnerName);
  }

  socket.on('register-moderator', () => {
    socket.join('moderator-room');
    io.emit('update-players', Array.from(players.values()));
    socket.emit('tipit-state-update', tipitState);
  });

  socket.on('register-player', (data) => {
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
      socket.emit('tipit-state-update', tipitState);
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
      io.to('moderator-room').emit('update-text', { name: player.name, text: player.text });
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

  socket.on('moderator-reset-all-scores', () => {
    console.log('Moderator setzt alle Punkte zurück.');
    players.forEach((player) => {
      player.score = 0;
    });
    io.emit('scores-reset-globally');
    io.emit('update-players', Array.from(players.values()));
  });
  
  socket.on('image-updated', (imgData) => {
    io.emit('push-image', imgData);
  });

  socket.on('image-removed', () => {
    io.emit('push-image', null);
  });

  socket.on('audio-stream', (audioData) => {
    socket.broadcast.emit('audio-receive', audioData);
  });

  // --- TipIt Socket Handlers ---
  socket.on('tipit-assign-hint', ({ playerName, hintIndex }) => {
    const hintObj = tipitState.hints.find(h => h.id === hintIndex);
    const cost = hintObj ? (parseInt(hintObj.cost) || 0) : 0;

    if (!tipitState.playerRevealedHints[playerName]) {
      tipitState.playerRevealedHints[playerName] = [];
    }

    if (!tipitState.playerRevealedHints[playerName].includes(hintIndex)) {
      tipitState.playerRevealedHints[playerName].push(hintIndex);

      // Münzen vom Spieler abziehen
      const player = Array.from(players.values()).find(p => p.name === playerName);
      if (player) {
        player.score = Math.max(0, player.score - cost);
        io.emit('update-players', Array.from(players.values()));
      }
    }

    if (!tipitState.globalRevealedHints.includes(hintIndex)) {
      tipitState.globalRevealedHints.push(hintIndex);
    }
    io.emit('tipit-state-update', tipitState);
  });

  socket.on('tipit-toggle-bonus', (revealed) => {
    tipitState.bonusHintRevealed = typeof revealed === 'boolean' ? revealed : !tipitState.bonusHintRevealed;
    io.emit('tipit-state-update', tipitState);
  });

  socket.on('tipit-update-config', (configData) => {
    if (configData) {
      if (typeof configData.bonusHintText === 'string') {
        tipitState.bonusHintText = configData.bonusHintText;
      }
      if (Array.isArray(configData.hints)) {
        tipitState.hints = configData.hints.map((h, i) => ({
          id: i + 1,
          title: h.title || `Hinweis ${i + 1}`,
          text: h.text || '',
          cost: parseInt(h.cost) >= 0 ? parseInt(h.cost) : 1
        }));
      }
    }
    io.emit('tipit-state-update', tipitState);
  });

  socket.on('tipit-reset', () => {
    tipitState = {
      playerRevealedHints: {},
      globalRevealedHints: [],
      bonusHintRevealed: false,
      bonusHintText: "Das ist ein Bonushinweis für alle!",
      hints: JSON.parse(JSON.stringify(defaultHints))
    };
    io.emit('tipit-state-update', tipitState);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
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

function createTipitRound() {
  return {
    bonusHintText: "Das ist ein Bonushinweis für alle!",
    hints: JSON.parse(JSON.stringify(defaultHints))
  };
}

let tipitState = {
  playerRevealedHints: {},
  globalRevealedHints: [],
  bonusHintRevealed: false,
  rounds: [createTipitRound()],
  activeRoundIndex: 0,
  ...createTipitRound()
};

function activateTipitRound(roundIndex) {
  const round = tipitState.rounds[roundIndex];
  if (!round) return;

  tipitState.activeRoundIndex = roundIndex;
  tipitState.bonusHintText = round.bonusHintText;
  tipitState.hints = JSON.parse(JSON.stringify(round.hints));
  tipitState.playerRevealedHints = {};
  tipitState.globalRevealedHints = [];
  tipitState.bonusHintRevealed = false;
}

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
    const player = Array.from(players.values()).find(p => p.name === playerName);

    if (!player || player.score < cost) {
      return;
    }

    if (!tipitState.playerRevealedHints[playerName]) {
      tipitState.playerRevealedHints[playerName] = [];
    }

    const playerHints = tipitState.playerRevealedHints[playerName];
    if (playerHints.length >= 2 || playerHints.includes(hintIndex)) {
      return;
    }

    if (!playerHints.includes(hintIndex)) {
      playerHints.push(hintIndex);

      // Münzen vom Spieler abziehen
      player.score -= cost;
      io.emit('update-players', Array.from(players.values()));
    }

    if (!tipitState.globalRevealedHints.includes(hintIndex)) {
      tipitState.globalRevealedHints.push(hintIndex);
    }
    io.emit('tipit-state-update', tipitState);
  });

  socket.on('tipit-correct-answer', (playerName) => {
    const player = Array.from(players.values()).find(p => p.name === playerName);
    if (player) {
      player.score += 20;
      io.emit('update-players', Array.from(players.values()));
    }
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
      tipitState.rounds[tipitState.activeRoundIndex] = {
        bonusHintText: tipitState.bonusHintText,
        hints: JSON.parse(JSON.stringify(tipitState.hints))
      };
    }
    io.emit('tipit-state-update', tipitState);
  });

  socket.on('tipit-change-round', (roundIndex) => {
    const nextRoundIndex = parseInt(roundIndex);
    if (Number.isNaN(nextRoundIndex) || nextRoundIndex < 0 || nextRoundIndex > tipitState.rounds.length) {
      return;
    }
    if (nextRoundIndex === tipitState.rounds.length) {
      tipitState.rounds.push(createTipitRound());
    }
    activateTipitRound(nextRoundIndex);
    io.emit('tipit-state-update', tipitState);
  });

  socket.on('tipit-reset', () => {
    const rounds = tipitState.rounds;
    tipitState = {
      playerRevealedHints: {},
      globalRevealedHints: [],
      bonusHintRevealed: false,
      rounds,
      activeRoundIndex: tipitState.activeRoundIndex,
      ...rounds[tipitState.activeRoundIndex]
    };
    io.emit('tipit-state-update', tipitState);
  });

  socket.on('tipit-reset-coins', () => {
    players.forEach((player) => {
      player.score = 15;
    });
    io.emit('tipit-coins-reset', 15);
    io.emit('update-players', Array.from(players.values()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
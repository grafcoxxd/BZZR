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
let buzzerLocked = false;
let buzzerWinnerName = null;

// Die Map nutzt jetzt den NAMEN als Key, um Daten über Reconnects hinweg zu behalten
let players = new Map(); 
// Hilfs-Map, um schnell von einer Socket-ID auf den Spielernamen zu schließen
let socketToName = new Map();

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('Neuer Socket verbunden:', socket.id);

  if (buzzerLocked) {
    socket.emit('buzzer-locked', buzzerWinnerName);
  }

  socket.on('register-moderator', () => {
    socket.join('moderator-room');
    if (buzzerLocked) {
      io.to('moderator-room').emit('buzzer-winner', buzzerWinnerName);
    }
    io.emit('update-players', Array.from(players.values()));
  });

  socket.on('register-player', (name) => {
    if (players.has(name)) {
        // RECONNECT LOGIK
        const player = players.get(name);
        
        // Falls ein Lösch-Timer läuft, stoppen wir ihn
        if (player.timeout) {
            clearTimeout(player.timeout);
            player.timeout = null;
        }
        
        // Verknüpfe die neue Socket-ID mit dem existierenden Spieler
        player.socketId = socket.id;
        socketToName.set(socket.id, name);
        console.log(`Spieler ${name} wiederverbunden.`);
    } else {
        // NEUER SPIELER
        if (availableColors.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableColors.length);
            const assignedColor = availableColors.splice(randomIndex, 1)[0];

            players.set(name, { 
                name: name, 
                score: 0, 
                text: '', 
                color: assignedColor, 
                socketId: socket.id,
                timeout: null 
            });
            socketToName.set(socket.id, name);
            console.log(`Neuer Spieler registriert: ${name}`);
        }
    }
    io.emit('update-players', Array.from(players.values()));
  });

  socket.on('buzzer-pressed', () => {
    if (!buzzerLocked) {
        const playerName = socketToName.get(socket.id);
        if (playerName && players.has(playerName)) {
            buzzerLocked = true;
            buzzerWinnerName = playerName;
            io.emit('buzzer-locked', buzzerWinnerName);
            io.to('moderator-room').emit('buzzer-winner', buzzerWinnerName);
        }
    }
  });

  socket.on('moderator-correct', (points) => {
    const winner = players.get(buzzerWinnerName);
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
    const player = players.get(playerName);
    if (player) {
        player.score += 1;
        io.emit('update-players', Array.from(players.values()));
    }
  });

  socket.on('subtract-point-from-player', (playerName) => {
    const player = players.get(playerName);
    if (player && player.score > 0) {
        player.score -= 1;
        io.emit('update-players', Array.from(players.values()));
    }
  });

  socket.on('player-typing', (text) => {
    const playerName = socketToName.get(socket.id);
    if (playerName) {
        const player = players.get(playerName);
        player.text = text;
        io.emit('update-text', { name: player.name, text: player.text });
    }
  });

  socket.on('disconnect', () => {
    const playerName = socketToName.get(socket.id);
    if (playerName) {
        const player = players.get(playerName);
        socketToName.delete(socket.id); // Socket-ID entfernen

        console.log(`Spieler ${playerName} hat Verbindung verloren. Warte 60s auf Reconnect...`);
        
        // Starte Timer: Wenn er nach 60s nicht wieder da ist, wird er gelöscht
        player.timeout = setTimeout(() => {
            availableColors.push(player.color);
            players.delete(playerName);
            console.log(`Spieler ${playerName} endgültig entfernt.`);
            io.emit('update-players', Array.from(players.values()));
        }, 60000); 
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
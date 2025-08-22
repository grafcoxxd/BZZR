const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

// Express App initialisieren
const app = express();
// HTTP-Server erstellen
const server = http.createServer(app);
// Socket.IO mit dem HTTP-Server verbinden
const io = new Server(server);

// Ordner für öffentliche Dateien festlegen (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Event-Handler für neue Socket.IO-Verbindungen
// Speichere den Zustand des Buzzers (ist er gesperrt?)
let buzzerLocked = false;
// Speichere den Namen des Spielers, der zuerst gebuzzert hat
let buzzerWinnerName = null;

let players = new Map(); // Wir verwenden eine Map, um Spieler nach ihrer Socket-ID zu speichern

io.on('connection', (socket) => {
  console.log('Ein Benutzer ist verbunden');

  // Sende den aktuellen Zustand an den neuen Client
  if (buzzerLocked) {
    socket.emit('buzzer-locked', buzzerWinnerName);
  }

  // Registriere einen Client als Spielführer und füge ihn einem speziellen Raum hinzu
  socket.on('register-moderator', () => {
    socket.join('moderator-room');
    console.log('Ein Spielführer hat sich verbunden.');
    // Sende den aktuellen Buzzer-Zustand an den Moderator
    if (buzzerLocked) {
      io.to('moderator-room').emit('buzzer-winner', buzzerWinnerName);
    }
    // Sende die aktuelle Spielerliste an den neuen Moderator
    io.emit('update-players', Array.from(players.values()));
  });

  socket.on('register-player', (name) => {
    // Speichere den Spieler im globalen "players" Objekt
    players.set(socket.id, { name: name, score: 0, text: '' }); // Füge 'text' hinzu
    console.log(`Spieler registriert: ${name}`);

    // Sende die aktualisierte Spielerliste an alle Clients
      io.emit('update-players', Array.from(players.values()));
  });

  // Lausche auf das 'buzzer-pressed' Signal von einem Spieler
  socket.on('buzzer-pressed', () => {
    if (!buzzerLocked) {
        const player = players.get(socket.id); // Hole das Spielerobjekt
        if (player) {
            buzzerLocked = true;
            buzzerWinnerName = player.name;
            console.log(`${buzzerWinnerName} hat gebuzzert!`);

            io.emit('buzzer-locked', buzzerWinnerName);
            io.to('moderator-room').emit('buzzer-winner', buzzerWinnerName);
        }
    }
});

// Lausche auf das Signal vom Spielführer, Punkte zu vergeben
socket.on('moderator-correct', (points) => {
  console.log(`Punkte hinzugefügt: ${points}`);

  // Finde den Spieler, der zuletzt gebuzzert hat
  const winner = Array.from(players.values()).find(p => p.name === buzzerWinnerName);
  if (winner) {
      winner.score += points;
      io.emit('update-players', Array.from(players.values()));
  }

  io.emit('play-correct-sound');

  // Gib den Buzzer wieder frei
  buzzerLocked = false;
  buzzerWinnerName = null;
  io.emit('buzzer-unlocked');
});

// Lausche auf das Signal vom Spielführer, den Buzzer freizugeben (ohne Punkte)
socket.on('moderator-release-buzzer', () => {
  console.log('Spielführer gibt Buzzer frei.');

  // Wenn jemand gebuzzert hat, verteilen wir die Punkte
  if (buzzerWinnerName) {
      console.log('Falsche Antwort. Verteile 1 Punkt an alle anderen Spieler.');

      players.forEach((player, playerId) => {
          // Wenn der Spieler nicht der Buzzer-Gewinner ist, gib ihm einen Punkt
          if (player.name !== buzzerWinnerName) {
              player.score += 1;
          }
      });

      // Sende die aktualisierte Spielerliste an alle Clients
      io.emit('update-players', Array.from(players.values()));
  }

  io.emit('play-wrong-sound');

  // Gib den Buzzer wieder frei
  buzzerLocked = false;
  buzzerWinnerName = null;
  io.emit('buzzer-unlocked');
});

// Lausche auf das Signal, einen Punkt hinzuzufügen
socket.on('add-point-to-player', (playerName) => {
  console.log(`Füge 1 Punkt hinzu für: ${playerName}`);
  const player = Array.from(players.values()).find(p => p.name === playerName);
  if (player) {
      player.score += 1;
      io.emit('update-players', Array.from(players.values()));
  }
});

// Lausche auf das Signal, einen Punkt abzuziehen
socket.on('subtract-point-from-player', (playerName) => {
  console.log(`Ziehe 1 Punkt ab von: ${playerName}`);
  const player = Array.from(players.values()).find(p => p.name === playerName);
  if (player && player.score > 0) {
      player.score -= 1;
      io.emit('update-players', Array.from(players.values()));
  }
});

// Neu: Echtzeit-Textfeld
socket.on('player-typing', (text) => {
    const player = players.get(socket.id);
    if (player) {
        player.text = text;
        // Sende nur das Update für diesen einen Spieler, um Bandbreite zu sparen
        io.emit('update-text', { name: player.name, text: player.text });
    }
});

    socket.on('disconnect', () => {
        console.log('Ein Benutzer hat die Verbindung getrennt');
        // Entferne den Spieler, wenn er die Verbindung verliert
        players.delete(socket.id);
        // Sende die aktualisierte Spielerliste an alle Clients
        io.emit('update-players', Array.from(players.values()));
    });

});

// Den Port festlegen, auf dem der Server lauscht
const PORT = process.env.PORT || 3000;

// Den Server starten
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
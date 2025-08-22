// Verbinde dich mit dem Socket.IO-Server
const socket = io();

// Wähle die neuen HTML-Elemente aus
const buzzerBtn = document.getElementById('buzzerBtn');
const buzzerStatus = document.getElementById('buzzerStatus');
const buzzerSound = document.getElementById('buzzerSound'); 
const correctSound = document.getElementById('correctSound');
const wrongSound = document.getElementById('wrongSound');

// Neu: Textfeld für Spieler
const answerInput = document.getElementById('answerInput');

buzzerSound.volume = 0.2;
correctSound.volume = 0.1;
wrongSound.volume = 0.1;

// Neu: Wähle den Registrierungs-Button aus
const registerPlayerBtn = document.getElementById('registerPlayerBtn');

// Event-Listener für den Buzzer-Button
buzzerBtn.addEventListener('click', () => {
    if (playerName) {
      socket.emit('buzzer-pressed', playerName);
    } else {
      alert('Bitte gib zuerst einen Spielernamen ein!');
    }
  });

// Event-Listener für Nachrichten vom Server
socket.on('buzzer-locked', (buzzerName) => {
  buzzerSound.play();
  buzzerBtn.disabled = true;
  buzzerBtn.textContent = `${buzzerName}`;
  buzzerBtn.classList.add('bg-gray-500');
  buzzerBtn.classList.remove('bg-red-500');
  buzzerStatus.classList.remove('hidden');
});

// JavaScript-Logik
const playersContainer = document.getElementById('playersContainer');
const playerNameInput = document.getElementById('playerNameInput');

let players = [];
let currentPlayerIndex = null;
let playerName = null;
const nameEntryDiv = document.getElementById('nameEntry');
const buzzerSectionDiv = document.getElementById('buzzer-section'); 

registerPlayerBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        playerName = name;
        socket.emit('register-player', playerName);
        nameEntryDiv.classList.add('hidden');
        buzzerSectionDiv.classList.remove('hidden');
    }
});

function createPlayerCard(name, score) {
    const card = document.createElement('div');
    card.className = 'player-card p-6 flex flex-col items-center text-center';

    const nameEl = document.createElement('h2');
    nameEl.className = 'text-2xl font-bold mb-2 text-white';
    nameEl.textContent = name;

    const scoreEl = document.createElement('p');
    scoreEl.className = 'text-5xl font-extrabold my-4 text-teal-400';
    scoreEl.textContent = score;

    card.appendChild(scoreEl);
    card.appendChild(nameEl);
    

    return card;
}

socket.on('update-players', (updatedPlayers) => {
    playersContainer.innerHTML = '';
    updatedPlayers.forEach((player) => {
        const card = createPlayerCard(player.name, player.score);
        playersContainer.appendChild(card);
    });
});

// Event-Listener für das Freigabe-Signal vom Server
socket.on('buzzer-unlocked', () => {
    buzzerBtn.disabled = false;
    buzzerBtn.textContent = '';
    buzzerBtn.classList.remove('bg-gray-500');
    buzzerBtn.classList.add('bg-red-500');
    buzzerStatus.textContent = '';
    buzzerStatus.classList.add('hidden');
  });

// Neu: Lausche auf Eingaben im Textfeld und sende sie an den Server
if (answerInput) {
    answerInput.addEventListener('input', () => {
        socket.emit('player-typing', answerInput.value);
    });
}

socket.on('play-correct-sound', () => {
    correctSound.play();
});

socket.on('play-wrong-sound', () => {
    wrongSound.play();
});
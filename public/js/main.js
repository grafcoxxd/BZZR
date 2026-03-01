const socket = io();

// DOM Elemente
const buzzerBtn = document.getElementById('buzzerBtn');
const buzzerStatus = document.getElementById('buzzerStatus');
const buzzerSound = document.getElementById('buzzerSound');
const correctSound = document.getElementById('correctSound');
const wrongSound = document.getElementById('wrongSound');
const answerInput = document.getElementById('answerInput');
const registerPlayerBtn = document.getElementById('registerPlayerBtn'); 
const playerNameInput = document.getElementById('playerNameInput');
const nameEntryDiv = document.getElementById('nameEntry');
const buzzerSectionDiv = document.getElementById('buzzer-section');
const playersContainer = document.getElementById('playersContainer');

// Lautstärke
buzzerSound.volume = 0.17;
correctSound.volume = 0.1;
wrongSound.volume = 0.1;

let playerName = null;

// --- Login & LocalStorage Logik ---

window.addEventListener('DOMContentLoaded', () => {
    const savedName = localStorage.getItem('playerName');
    if (savedName) {
        playerNameInput.value = savedName;
    }
});

// --- Tastatur-Steuerung (Leertaste) ---
window.addEventListener('keydown', (event) => {
    // Prüfen, ob die Leertaste gedrückt wurde
    if (event.key === ' ' || event.code === 'Space') {
        
        // WICHTIG: Verhindern, dass der Buzzer auslöst, wenn man gerade im Textfeld schreibt
        if (document.activeElement === answerInput || document.activeElement === playerNameInput) {
            return;
        }

        // Standard-Verhalten der Leertaste (Scrollen) verhindern
        event.preventDefault();

        // Nur auslösen, wenn der Button nicht deaktiviert ist (also noch niemand gebuzzert hat)
        if (!buzzerBtn.disabled && playerName) {
            socket.emit('buzzer-pressed', playerName);
        }
    }
});

registerPlayerBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        playerName = name;
        localStorage.setItem('playerName', name);
        const savedScore = parseInt(localStorage.getItem('playerScore')) || 0;
        socket.emit('register-player', { name: playerName, score: savedScore });
        nameEntryDiv.classList.add('hidden');
        buzzerSectionDiv.classList.remove('hidden');
    }
});

// --- Buzzer Logik ---

buzzerBtn.addEventListener('click', () => {
    if (playerName) {
      socket.emit('buzzer-pressed', playerName);
    }
});

socket.on('buzzer-locked', (buzzerName) => {
    buzzerSound.play();
    buzzerBtn.disabled = true;
    buzzerBtn.textContent = `${buzzerName}`;
    
    // Basis-Farbe (Rot) entfernen
    buzzerBtn.classList.remove('bg-red-500', 'hover:bg-red-600');

    if (playerName === buzzerName) {
        // ICH bin dran -> Gelb (auch im Hover)
        buzzerBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-500');
        buzzerBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600');
        // NEU: 'glow-effect' hinzugefügt
        buzzerBtn.classList.add('glow-effect');
    } else {
        // ANDERE sind dran -> Grau
        buzzerBtn.classList.add('bg-gray-500', 'hover:bg-gray-600');
        buzzerBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
    }
    
    buzzerStatus.classList.remove('hidden');
});

socket.on('buzzer-unlocked', () => {
    buzzerBtn.disabled = false;
    buzzerBtn.textContent = '';
    
    // NEU: 'glow-effect' wieder entfernt
    buzzerBtn.classList.remove('bg-gray-500', 'bg-yellow-400', 'text-gray-900', 'glow-effect');
    buzzerBtn.classList.add('bg-red-500');

    // Alle Zustands-Farben entfernen
    buzzerBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600', 'bg-yellow-500', 'hover:bg-yellow-600');
    
    // Standard-Farbe (Rot) wiederherstellen
    buzzerBtn.classList.add('bg-red-500', 'hover:bg-red-600');
    
    buzzerStatus.textContent = '';
    buzzerStatus.classList.add('hidden');
});

// --- Spieler & Punkte Updates ---

socket.on('update-players', (updatedPlayers) => {
    playersContainer.innerHTML = '';
    updatedPlayers.forEach((player) => {
        const card = createPlayerCard(player.name, player.score, player.color);
        playersContainer.appendChild(card);
        if (player.name === playerName) {
            localStorage.setItem('playerScore', player.score);
        }
    });
});

function createPlayerCard(name, score, color) {
    const card = document.createElement('div');
    card.className = 'player-card p-6 flex flex-col items-center text-center';
    const nameEl = document.createElement('h2');
    nameEl.className = 'text-2xl font-bold mb-2';
    nameEl.textContent = name;
    nameEl.style.color = color;
    const scoreEl = document.createElement('p');
    scoreEl.className = 'text-5xl font-extrabold my-4';
    scoreEl.textContent = score;
    scoreEl.style.color = color;
    card.appendChild(scoreEl);
    card.appendChild(nameEl);
    return card;
}

// Globaler Reset vom Moderator
socket.on('scores-reset-globally', () => {
    localStorage.setItem('playerScore', 0);
});

// Typing-Feature
if (answerInput) {
    answerInput.addEventListener('input', () => {
        socket.emit('player-typing', answerInput.value);
    });
}

socket.on('play-correct-sound', () => correctSound.play());
socket.on('play-wrong-sound', () => wrongSound.play());

// --- Verbindung ---

socket.on('disconnect', () => {
    buzzerStatus.textContent = 'Verbindung getrennt. Reconnect...';
    buzzerStatus.classList.remove('hidden');
    buzzerBtn.disabled = true;
});

socket.on('connect', () => {
    if (playerName) {
        const savedScore = parseInt(localStorage.getItem('playerScore')) || 0;
        socket.emit('register-player', { name: playerName, score: savedScore });
    }
    buzzerStatus.classList.add('hidden');
});

socket.on('push-image', (imgData) => {
    if (imgData) {
        // Bild als Hintergrund setzen
        buzzerBtn.style.backgroundImage = `url(${imgData})`;
        buzzerBtn.style.backgroundSize = 'cover';
        buzzerBtn.style.backgroundPosition = 'center';
    } else {
        // Hintergrund entfernen
        buzzerBtn.style.backgroundImage = 'none';
    }
});
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

        event.preventDefault(); 
        
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

buzzerBtn.addEventListener('click', () => {
    if (playerName) {
        socket.emit('buzzer-pressed', playerName);
    }
});

// --- Socket Events ---

socket.on('buzzer-locked', (buzzerName) => {
    buzzerSound.play();
    buzzerBtn.disabled = true;
    buzzerBtn.textContent = buzzerName;
    
    // Prüfen: Bin ICH der Gewinner?
    if (playerName === buzzerName) {
        buzzerBtn.classList.remove('bg-red-500');
        // NEU: 'glow-effect' hinzugefügt
        buzzerBtn.classList.add('bg-yellow-400', 'text-gray-900', 'glow-effect');
        buzzerStatus.textContent = 'DU HAST DEN BUZZER!';
        answerInput.classList.remove('hidden');
        answerInput.focus();
    } else {
        buzzerBtn.classList.remove('bg-red-500');
        buzzerBtn.classList.add('bg-gray-500');
        buzzerStatus.textContent = `${buzzerName} war schneller!`;
    }

    buzzerStatus.classList.remove('hidden');
});

socket.on('buzzer-unlocked', () => {
    buzzerBtn.disabled = false;
    buzzerBtn.textContent = '';
    // NEU: 'glow-effect' wieder entfernt
    buzzerBtn.classList.remove('bg-gray-500', 'bg-yellow-400', 'text-gray-900', 'glow-effect');
    buzzerBtn.classList.add('bg-red-500');
    
    buzzerStatus.textContent = '';
    buzzerStatus.classList.add('hidden');
    
    answerInput.classList.add('hidden');
    answerInput.value = ''; 
});

socket.on('update-players', (updatedPlayers) => {
    playersContainer.innerHTML = '';
    updatedPlayers.forEach((player) => {
        const card = createPlayerCard(player.name, player.score, player.color);
        playersContainer.appendChild(card);
        
        // Eigenen Score im LocalStorage aktualisieren
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
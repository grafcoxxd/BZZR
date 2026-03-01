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
const mainBody = document.getElementById('mainBody');
const shockwave = document.getElementById('shockwave');

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

// --- Effekt-Trigger ---
function playBuzzerEffects() {
    // Bildschirm-Shake
    mainBody.classList.remove('apply-shake');
    void mainBody.offsetWidth; // Reflow
    mainBody.classList.add('apply-shake');

    // Druckwelle
    shockwave.classList.remove('animate-shock');
    void shockwave.offsetWidth; // Reflow
    shockwave.classList.add('animate-shock');
}

// --- Tastatur-Steuerung (Leertaste) ---
window.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.code === 'Space') {
        if (document.activeElement === answerInput || document.activeElement === playerNameInput) {
            return;
        }
        event.preventDefault(); 
        if (!buzzerBtn.disabled && playerName) {
            socket.emit('buzzer-pressed', playerName);
        }
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
    
    if (playerName === buzzerName) {
        buzzerBtn.classList.remove('bg-red-500');
        buzzerBtn.classList.add('bg-yellow-400', 'text-gray-900');
        buzzerStatus.textContent = 'DU HAST DEN BUZZER!';
        answerInput.classList.remove('hidden');
        answerInput.focus();
        // Effekte abspielen wenn man selbst gewinnt
        playBuzzerEffects();
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
    buzzerBtn.classList.remove('bg-gray-500', 'bg-yellow-400', 'text-gray-900');
    buzzerBtn.classList.add('bg-red-500');
    buzzerStatus.textContent = '';
    buzzerStatus.classList.add('hidden');
    answerInput.classList.add('hidden');
    answerInput.value = '';
    // Animationen zurücksetzen
    mainBody.classList.remove('apply-shake');
    shockwave.classList.remove('animate-shock');
});

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

socket.on('scores-reset-globally', () => {
    localStorage.setItem('playerScore', 0);
});

if (answerInput) {
    answerInput.addEventListener('input', () => {
        socket.emit('player-typing', answerInput.value);
    });
}

socket.on('play-correct-sound', () => correctSound.play());
socket.on('play-wrong-sound', () => wrongSound.play());

socket.on('push-image', (imgData) => {
    if (imgData) {
        buzzerBtn.style.backgroundImage = `url(${imgData})`;
        buzzerBtn.style.backgroundSize = 'cover';
        buzzerBtn.style.backgroundPosition = 'center';
    } else {
        buzzerBtn.style.backgroundImage = 'none';
    }
});

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
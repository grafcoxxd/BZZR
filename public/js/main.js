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
    if (savedName) playerNameInput.value = savedName;
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

// --- Tastatur-Steuerung ---
window.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.code === 'Space') {
        if (document.activeElement === answerInput || document.activeElement === playerNameInput) return;
        event.preventDefault();
        if (!buzzerBtn.disabled && playerName) socket.emit('buzzer-pressed', playerName);
    }
});

// --- Buzzer Logik ---
buzzerBtn.addEventListener('click', () => {
    if (playerName) socket.emit('buzzer-pressed', playerName);
});

socket.on('buzzer-locked', (buzzerName) => {
    buzzerSound.play();
    buzzerBtn.disabled = true;
    buzzerBtn.textContent = buzzerName;
    
    // TEXT-SCHATTEN hinzufügen (für bessere Lesbarkeit auf Bildern)
    buzzerBtn.style.textShadow = "2px 2px 10px rgba(0,0,0,0.8), -1px -1px 0px rgba(0,0,0,0.8)";

    buzzerBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
    if (playerName === buzzerName) {
        buzzerBtn.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
    } else {
        buzzerBtn.classList.add('bg-gray-500', 'hover:bg-gray-600');
    }
    buzzerStatus.classList.remove('hidden');
});

socket.on('buzzer-unlocked', () => {
    buzzerBtn.disabled = false;
    buzzerBtn.textContent = '';
    buzzerBtn.style.textShadow = "none";
    buzzerBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600', 'bg-yellow-500', 'hover:bg-yellow-600');
    buzzerBtn.classList.add('bg-red-500', 'hover:bg-red-600');
    buzzerStatus.classList.add('hidden');
});

// --- Bild-Hintergrund Logik ---
socket.on('push-image', (imgData) => {
    if (imgData) {
        buzzerBtn.style.backgroundImage = `url(${imgData})`;
        buzzerBtn.style.backgroundSize = 'cover';
        buzzerBtn.style.backgroundPosition = 'center';
    } else {
        buzzerBtn.style.backgroundImage = 'none';
    }
});

// --- Spieler & Punkte Updates ---
socket.on('update-players', (updatedPlayers) => {
    playersContainer.innerHTML = '';
    updatedPlayers.forEach((player) => {
        const card = createPlayerCard(player.name, player.score, player.color);
        playersContainer.appendChild(card);
        if (player.name === playerName) localStorage.setItem('playerScore', player.score);
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

socket.on('scores-reset-globally', () => localStorage.setItem('playerScore', 0));

if (answerInput) {
    answerInput.addEventListener('input', () => {
        socket.emit('player-typing', answerInput.value);
    });
}

socket.on('play-correct-sound', () => correctSound.play());
socket.on('play-wrong-sound', () => wrongSound.play());

socket.on('connect', () => {
    if (playerName) {
        const savedScore = parseInt(localStorage.getItem('playerScore')) || 0;
        socket.emit('register-player', { name: playerName, score: savedScore });
    }
});
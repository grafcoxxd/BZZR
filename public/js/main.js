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
const gameVolumeSlider = document.getElementById('gameVolume');
const liveVolumeSlider = document.getElementById('liveVolume');

const audio = new Audio();
let playerName = null;

// --- Lautstärke-Steuerung ---
const updateGameVolume = () => {
    const vol = parseFloat(gameVolumeSlider.value);
    buzzerSound.volume = vol;
    correctSound.volume = vol * 0.6;
    wrongSound.volume = vol * 0.6;
    localStorage.setItem('gameVolume', vol);
};

const updateLiveVolume = () => {
    const vol = parseFloat(liveVolumeSlider.value);
    if (audio) {
        audio.volume = vol;
    }
    localStorage.setItem('liveVolume', vol);
};

gameVolumeSlider.addEventListener('input', updateGameVolume);
liveVolumeSlider.addEventListener('input', updateLiveVolume);

// --- Initialization & LocalStorage ---
window.addEventListener('DOMContentLoaded', () => {
    const savedGameVol = localStorage.getItem('gameVolume');
    const savedLiveVol = localStorage.getItem('liveVolume');
    const savedName = localStorage.getItem('playerName');

    if (savedGameVol !== null) {
        gameVolumeSlider.value = savedGameVol;
        updateGameVolume();
    }
    if (savedLiveVol !== null) {
        liveVolumeSlider.value = savedLiveVol;
        updateLiveVolume();
    }
    if (savedName) {
        playerNameInput.value = savedName;
    }
});

// --- Tastatur-Steuerung (Leertaste) ---
window.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.code === 'Space') {
        if (document.activeElement === answerInput || document.activeElement === playerNameInput) {
            return;
        }

        event.preventDefault();

        if (!buzzerBtn.disabled && playerName) {
            socket.emit('buzzer-pressed');
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
        socket.emit('buzzer-pressed');
    }
});

socket.on('buzzer-locked', (buzzerName) => {
    buzzerSound.play();
    buzzerBtn.disabled = true;
    buzzerBtn.textContent = `${buzzerName}`;

    if (playerName === buzzerName) {
        document.body.classList.add('animate-flash-white');
        setTimeout(() => {
            document.body.classList.remove('animate-flash-white');
        }, 600);

        buzzerBtn.classList.add('bg-red-600', 'hover:bg-red-600', 'glow-effect');
    } else {
        buzzerBtn.classList.add('bg-gray-500', 'hover:bg-gray-600', 'grayscale-filter');
        buzzerBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
    }
    
    buzzerStatus.classList.remove('hidden');
});

socket.on('buzzer-unlocked', () => {
    buzzerBtn.disabled = false;
    buzzerBtn.textContent = '';
    
    buzzerBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600', 'bg-red-600', 'hover:bg-red-600', 'bg-yellow-500', 'hover:bg-yellow-600', 'bg-teal-500', 'glow-effect', 'grayscale-filter');
    buzzerBtn.classList.add('bg-red-500', 'hover:bg-red-500');
    
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

socket.on('play-correct-sound', () => {
    correctSound.play();
    document.body.classList.add('animate-flash-green');
    setTimeout(() => {
        document.body.classList.remove('animate-flash-green');
    }, 800);
});

socket.on('play-wrong-sound', () => {
    wrongSound.play();
    document.body.classList.add('animate-flash-red');
    setTimeout(() => {
        document.body.classList.remove('animate-flash-red');
    }, 800);
});

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
        buzzerBtn.style.backgroundImage = `url(${imgData})`;
        buzzerBtn.style.backgroundSize = 'cover';
        buzzerBtn.style.backgroundPosition = 'center';
    } else {
        buzzerBtn.style.backgroundImage = 'none';
    }
});

// --- AUDIO STREAMING LOGIK ---
let mediaSource = new MediaSource();
let sourceBuffer;
let audioQueue = [];

audio.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener('sourceopen', () => {
    sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs=opus');
    
    sourceBuffer.addEventListener('updateend', () => {
        if (audioQueue.length > 0 && !sourceBuffer.updating) {
            sourceBuffer.appendBuffer(audioQueue.shift());
        }
    });
});

async function startAudioOnInteraction() {
    if (audio.paused) {
        audio.play().catch(e => console.log("Warte auf Interaktion..."));
        console.log("Audio-Wiedergabe bereit!");
    }
}

registerPlayerBtn.addEventListener('click', startAudioOnInteraction);
buzzerBtn.addEventListener('click', startAudioOnInteraction);
window.addEventListener('keydown', startAudioOnInteraction);

socket.on('audio-receive', async (data) => {
    let arrayBuffer;
    if (data instanceof ArrayBuffer) {
        arrayBuffer = data;
    } else {
        arrayBuffer = new Uint8Array(data).buffer;
    }

    // In den Buffer schieben oder in die Warteschlange, falls der Buffer noch arbeitet
    if (sourceBuffer && !sourceBuffer.updating) {
        try {
            sourceBuffer.appendBuffer(arrayBuffer);
        } catch (e) {
            console.error("Fehler beim Hinzufügen zum Buffer:", e);
        }
    } else {
        audioQueue.push(arrayBuffer);
    }
});
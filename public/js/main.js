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
const audio = new Audio();

// Lautstärke
//buzzerSound.volume = 0.17;
//correctSound.volume = 0.1;
//wrongSound.volume = 0.1;

// DOM Elemente für die Slider
const gameVolumeSlider = document.getElementById('gameVolume');
const liveVolumeSlider = document.getElementById('liveVolume');

// 1. Spiel-Sounds (Buzzer, Richtig, Falsch)
const updateGameVolume = () => {
    const vol = gameVolumeSlider.value;
    buzzerSound.volume = vol;
    correctSound.volume = vol * 0.6; // Richtig/Falsch etwas leiser als der Buzzer
    wrongSound.volume = vol * 0.6;
    localStorage.setItem('gameVolume', vol);
};

// 2. Live-Streaming Sound
const updateLiveVolume = () => {
    const vol = liveVolumeSlider.value;
    if (audio) {
        audio.volume = vol;
    }
    localStorage.setItem('liveVolume', vol);
};

// Event Listener für die Slider
gameVolumeSlider.addEventListener('input', updateGameVolume);
liveVolumeSlider.addEventListener('input', updateLiveVolume);

// --- Beim Laden der Seite: Gespeicherte Lautstärke wiederherstellen ---
window.addEventListener('DOMContentLoaded', () => {
    const savedGameVol = localStorage.getItem('gameVolume');
    const savedLiveVol = localStorage.getItem('liveVolume');

    if (savedGameVol !== null) {
        gameVolumeSlider.value = savedGameVol;
        updateGameVolume();
    }
    if (savedLiveVol !== null) {
        liveVolumeSlider.value = savedLiveVol;
        updateLiveVolume();
    }
});

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
   // buzzerBtn.classList.remove('bg-red-500', 'hover:bg-red-600');

    if (playerName === buzzerName) {

        // NEU: Hintergrund der Seite auf Gelb ändern
        //document.body.classList.remove('bg-gray-900');
        //document.body.classList.add('bg-slate-900');

        // ICH bin dran -> Gelb (auch im Hover)
        buzzerBtn.classList.add('bg-red-600', 'hover:bg-red-600');
       // buzzerBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600');
        // NEU: 'glow-effect' hinzugefügt
        buzzerBtn.classList.add('glow-effect');

    } else {
        // ANDERE sind dran -> Grau
        buzzerBtn.classList.add('bg-gray-500', 'hover:bg-gray-600', 'grayscale-filter');
        buzzerBtn.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
    }
    
    buzzerStatus.classList.remove('hidden');
});

socket.on('buzzer-unlocked', () => {
    buzzerBtn.disabled = false;
    buzzerBtn.textContent = '';
    
    // NEU: Hintergrund wieder auf die ursprüngliche Farbe (Dunkelgrau) zurücksetzen
    //document.body.classList.remove('bg-slate-900');
    //document.body.classList.add('bg-gray-900');

    // NEU: 'glow-effect' und grayscale wieder entfernt
    buzzerBtn.classList.remove('bg-gray-500', 'bg-red-600', 'text-gray-900', 'glow-effect', 'grayscale-filter');
    buzzerBtn.classList.add('bg-red-500');

    // Alle Zustands-Farben entfernen
    buzzerBtn.classList.remove('bg-gray-500', 'hover:bg-gray-600', 'bg-teal-500', 'hover:bg-red-600');
    

    // Standard-Farbe (Rot) wiederherstellen
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

    // Klasse für grünes Blitzen hinzufügen
    document.body.classList.add('animate-flash-green');
    
    // Klasse nach der Animation wieder entfernen, damit sie beim nächsten Mal erneut triggert
    setTimeout(() => {
        document.body.classList.remove('animate-flash-green');
    }, 800);
});

socket.on('play-wrong-sound', () => {
    wrongSound.play()

    // Klasse für rotes Blitzen hinzufügen
    document.body.classList.add('animate-flash-red');
    
    // Klasse nach der Animation wieder entfernen
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
        // Bild als Hintergrund setzen
        buzzerBtn.style.backgroundImage = `url(${imgData})`;
        buzzerBtn.style.backgroundSize = 'cover';
        buzzerBtn.style.backgroundPosition = 'center';
    } else {
        // Hintergrund entfernen
        buzzerBtn.style.backgroundImage = 'none';
    }
});

// --- AUDIO STREAMING LOGIK ---
let mediaSource = new MediaSource();
let sourceBuffer;
let audioQueue = [];

audio.src = URL.createObjectURL(mediaSource);

// 1. MediaSource vorbereiten
mediaSource.addEventListener('sourceopen', () => {
    // Wir sagen dem Browser, dass WebM/Opus Daten kommen
    sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs=opus');
    
    // Wenn ein Paket fertig verarbeitet wurde, das nächste aus der Schlange nehmen
    sourceBuffer.addEventListener('updateend', () => {
        if (audioQueue.length > 0 && !sourceBuffer.updating) {
            sourceBuffer.appendBuffer(audioQueue.shift());
        }
    });
});

// 2. Aktivierung bei Interaktion (Autoplay-Schutz)
async function startAudioOnInteraction() {
    if (audio.paused) {
        audio.play().catch(e => console.log("Warte auf Interaktion..."));
        console.log("Audio-Wiedergabe bereit!");
    }
}

registerPlayerBtn.addEventListener('click', startAudioOnInteraction);
buzzerBtn.addEventListener('click', startAudioOnInteraction);
window.addEventListener('keydown', startAudioOnInteraction);

// 3. Empfang der Daten vom Server
socket.on('audio-receive', async (data) => {
    // Daten in ArrayBuffer umwandeln
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
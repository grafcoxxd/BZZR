const socket = io();

// DOM Elemente
const nameEntryDiv = document.getElementById('nameEntry');
const gameContainerDiv = document.getElementById('game-container');
const playerNameInput = document.getElementById('playerNameInput');
const registerPlayerBtn = document.getElementById('registerPlayerBtn');
const hintsListContainer = document.getElementById('hints-list');
const tipitStatus = document.getElementById('tipitStatus');

const gameVolumeSlider = document.getElementById('gameVolume');
const liveVolumeSlider = document.getElementById('liveVolume');

const buzzerSound = document.getElementById('buzzerSound');
const correctSound = document.getElementById('correctSound');
const wrongSound = document.getElementById('wrongSound');

let playerName = null;

// Slots für bis zu 6 Spieler in spezifischer Reihenfolge:
// 1: Top-Left (slot-0)
// 2: Top-Right (slot-1)
// 3: Bot-Left (slot-2)
// 4: Bot-Right (slot-3)
// 5: Mid-Left (slot-4)
// 6: Mid-Right (slot-5)
const SLOT_IDS = [
    'slot-0', // Top-Left
    'slot-1', // Top-Right
    'slot-2', // Bot-Left
    'slot-3', // Bot-Right
    'slot-4', // Mid-Left
    'slot-5'  // Mid-Right
];

// --- Lautstärke-Steuerung ---
const updateGameVolume = () => {
    const vol = parseFloat(gameVolumeSlider.value);
    if (buzzerSound) buzzerSound.volume = vol;
    if (correctSound) correctSound.volume = vol * 0.6;
    if (wrongSound) wrongSound.volume = vol * 0.6;
    localStorage.setItem('gameVolume', vol);
};

const updateLiveVolume = () => {
    const vol = parseFloat(liveVolumeSlider.value);
    localStorage.setItem('liveVolume', vol);
};

gameVolumeSlider.addEventListener('input', updateGameVolume);
liveVolumeSlider.addEventListener('input', updateLiveVolume);

// LocalStorage Wiederherstellung
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

    renderHintListSkeleton();
});

// Rendert die 10 Platzhalter-Hinweiszeilen
function renderHintListSkeleton() {
    hintsListContainer.innerHTML = '';
    
    // Beispielhafte Münzkosten für die 10 Hinweise
    const sampleCosts = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];

    for (let i = 1; i <= 10; i++) {
        const hintRow = document.createElement('div');
        hintRow.className = 'bg-gray-700/60 hover:bg-gray-700/80 border border-gray-600/60 p-3 rounded-lg flex items-center justify-between transition duration-200';
        
        hintRow.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/40 text-xs font-bold flex items-center justify-center">
                    ${i}
                </span>
                <span class="text-sm font-medium text-gray-300 italic">Hinweis ${i} (Verdeckt)</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                    🪙 ${sampleCosts[i - 1]}
                </span>
                <button class="bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold py-1 px-3 rounded transition duration-200 shadow opacity-50 cursor-not-allowed">
                    Kaufen
                </button>
            </div>
        `;

        hintsListContainer.appendChild(hintRow);
    }
}

// Player Join
registerPlayerBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        playerName = name;
        localStorage.setItem('playerName', name);
        const savedScore = parseInt(localStorage.getItem('playerScore')) || 0;
        socket.emit('register-player', { name: playerName, score: savedScore });
        nameEntryDiv.classList.add('hidden');
        gameContainerDiv.classList.remove('hidden');
    }
});

// Spielerkarten rendern & auf Slots verteilen
socket.on('update-players', (updatedPlayers) => {
    // Alle Slots leeren
    SLOT_IDS.forEach(slotId => {
        const slotEl = document.getElementById(slotId);
        if (slotEl) slotEl.innerHTML = '';
    });

    // Maximal 6 Spieler auf die Slots verteilen
    updatedPlayers.slice(0, 6).forEach((player, index) => {
        const targetSlotId = SLOT_IDS[index];
        const slotEl = document.getElementById(targetSlotId);

        if (slotEl) {
            const card = createPlayerCard(player);
            slotEl.appendChild(card);
        }

        if (player.name === playerName) {
            localStorage.setItem('playerScore', player.score);
        }
    });
});

function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card w-full p-4 flex flex-col items-center text-center border border-gray-700/60 relative overflow-hidden';
    
    // Farblicher oberer Akzent
    const topBar = document.createElement('div');
    topBar.className = 'absolute top-0 left-0 right-0 h-1';
    topBar.style.backgroundColor = player.color || '#38BDF8';
    card.appendChild(topBar);

    const nameEl = document.createElement('h2');
    nameEl.className = 'text-lg font-bold mb-1 truncate w-full';
    nameEl.textContent = player.name;
    nameEl.style.color = player.color || '#ffffff';

    const coinsEl = document.createElement('div');
    coinsEl.className = 'text-2xl font-extrabold my-1 text-amber-400 flex items-center justify-center gap-1';
    coinsEl.innerHTML = `🪙 <span class="text-white">${player.score || 0}</span>`;

    card.appendChild(nameEl);
    card.appendChild(coinsEl);
    return card;
}

// Server Connection Handling
socket.on('disconnect', () => {
    if (tipitStatus) {
        tipitStatus.textContent = 'Verbindung getrennt. Reconnect...';
    }
});

socket.on('connect', () => {
    if (playerName) {
        const savedScore = parseInt(localStorage.getItem('playerScore')) || 0;
        socket.emit('register-player', { name: playerName, score: savedScore });
    }
    if (tipitStatus) {
        tipitStatus.textContent = '';
    }
});
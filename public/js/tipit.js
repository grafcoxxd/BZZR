const socket = io();

// URL Modus (Spieler oder Moderator)
const urlParams = new URLSearchParams(window.location.search);
const isModerator = urlParams.get('mod') === 'true' || urlParams.get('role') === 'moderator';

// DOM Elemente
const nameEntryDiv = document.getElementById('nameEntry');
const gameContainerDiv = document.getElementById('game-container');
const playerNameInput = document.getElementById('playerNameInput');
const registerPlayerBtn = document.getElementById('registerPlayerBtn');
const hintsListContainer = document.getElementById('hints-list');
const tipitStatus = document.getElementById('tipitStatus');
const modBadge = document.getElementById('modBadge');

const gameVolumeSlider = document.getElementById('gameVolume');
const liveVolumeSlider = document.getElementById('liveVolume');

const buzzerSound = document.getElementById('buzzerSound');
const correctSound = document.getElementById('correctSound');
const wrongSound = document.getElementById('wrongSound');

let playerName = null;
let latestPlayers = [];
let playerRevealedHints = {}; // { [playerName]: [hintIndex, ...] }
let globalRevealedHints = new Set(); // Set of hintIndices revealed
let bonusHintRevealed = false;

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

// LocalStorage Wiederherstellung & Moderator Check
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

    if (isModerator) {
        socket.emit('register-moderator');
        if (modBadge) modBadge.classList.remove('hidden');
        nameEntryDiv.classList.add('hidden');
        gameContainerDiv.classList.remove('hidden');
        setupModeratorUI();
    }

    renderHintList();
});

// Zusätzliche UI-Anpassungen für Moderator (z. B. Bonushinweis-Button)
function setupModeratorUI() {
    const bonusCard = document.getElementById('bonus-hint-card');
    if (bonusCard) {
        const bonusControlArea = bonusCard.querySelector('.flex.items-center.gap-2');
        if (bonusControlArea) {
            bonusControlArea.innerHTML = `
                <button id="revealBonusBtn" class="bg-amber-500 hover:bg-amber-600 text-gray-900 font-bold text-xs py-1 px-2.5 rounded-lg transition shadow flex items-center gap-1">
                    👁️ Für alle aufdecken
                </button>
            `;
            document.getElementById('revealBonusBtn').addEventListener('click', toggleBonusHint);
        }
    }
}

function toggleBonusHint() {
    if (isModerator) {
        socket.emit('tipit-toggle-bonus', !bonusHintRevealed);
    }
}

function updateBonusHintUI() {
    const bonusHintText = document.getElementById('bonus-hint-text');
    const bonusCard = document.getElementById('bonus-hint-card');

    if (bonusHintText) {
        if (bonusHintRevealed) {
            bonusHintText.textContent = "Bonushinweis: Das ist ein toller Beispiel-Hinweis für alle!";
            bonusHintText.classList.remove('italic', 'text-gray-300');
            bonusHintText.classList.add('text-yellow-200', 'font-bold');
        } else {
            bonusHintText.textContent = "Verdeckt";
            bonusHintText.classList.add('italic', 'text-gray-300');
            bonusHintText.classList.remove('text-yellow-200', 'font-bold');
        }
    }

    if (isModerator && bonusCard) {
        const btn = bonusCard.querySelector('#revealBonusBtn');
        if (btn) {
            btn.textContent = bonusHintRevealed ? '🙈 Verbergen' : '👁️ Für alle aufdecken';
        }
    }
}

// Socket Listener für TipIt Status-Updates
socket.on('tipit-state-update', (state) => {
    if (!state) return;
    playerRevealedHints = state.playerRevealedHints || {};
    globalRevealedHints = new Set(state.globalRevealedHints || []);
    bonusHintRevealed = !!state.bonusHintRevealed;

    updateBonusHintUI();
    renderHintList();
    if (latestPlayers && latestPlayers.length > 0) {
        updatePlayersUI(latestPlayers);
    }
});

// Rendert die 10 Hinweiszeilen in der zentralen Liste
function renderHintList() {
    hintsListContainer.innerHTML = '';
    
    // Beispielhafte Münzkosten für die 10 Hinweise
    const sampleCosts = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];

    for (let i = 1; i <= 10; i++) {
        const isRevealedAny = globalRevealedHints.has(i);
        const hintRow = document.createElement('div');
        
        let rowClasses = 'border p-2 rounded-lg flex items-center justify-between transition duration-200 select-none ';
        if (isRevealedAny) {
            rowClasses += 'bg-gray-800/40 border-gray-700/40 opacity-40 grayscale';
        } else {
            rowClasses += 'bg-gray-700/60 hover:bg-gray-700/80 border-gray-600/60';
        }

        if (isModerator && !isRevealedAny) {
            rowClasses += ' cursor-grab active:cursor-grabbing hover:border-teal-400';
            hintRow.setAttribute('draggable', 'true');

            hintRow.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', i.toString());
                hintRow.classList.add('ring-2', 'ring-teal-400');
            });

            hintRow.addEventListener('dragend', () => {
                hintRow.classList.remove('ring-2', 'ring-teal-400');
            });
        }

        let rightStatusHTML = '';
        if (isRevealedAny) {
            rightStatusHTML = `
                <span class="text-[10px] font-semibold text-gray-400 bg-gray-800/80 border border-gray-600/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                    ✓ Aufgedeckt
                </span>
            `;
        } else if (isModerator) {
            rightStatusHTML = `
                <span class="text-[10px] font-semibold text-teal-300 bg-teal-500/20 border border-teal-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                    🖐️ Auf Spieler ziehen
                </span>
            `;
        } else {
            rightStatusHTML = `
                <span class="text-[10px] font-semibold text-gray-400 bg-gray-800/80 border border-gray-600/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                    🔒 Verdeckt
                </span>
            `;
        }

        hintRow.className = rowClasses;
        hintRow.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/40 text-[10px] font-bold flex items-center justify-center">
                    ${i}
                </span>
                <span class="text-xs font-medium text-gray-300 italic">Hinweis ${i} (Verdeckt)</span>
            </div>
            <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    🪙 ${sampleCosts[i - 1]}
                </span>
                ${rightStatusHTML}
            </div>
        `;

        hintsListContainer.appendChild(hintRow);
    }
}

function assignHintToPlayer(targetPlayerName, hintIndex) {
    if (isModerator) {
        socket.emit('tipit-assign-hint', { playerName: targetPlayerName, hintIndex: hintIndex });
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
    latestPlayers = updatedPlayers;
    updatePlayersUI(updatedPlayers);
});

function updatePlayersUI(updatedPlayers) {
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
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card w-full p-3 flex flex-col items-center text-center border border-gray-700/60 relative overflow-hidden transition-all duration-200';
    
    // Farblicher oberer Akzent
    const topBar = document.createElement('div');
    topBar.className = 'absolute top-0 left-0 right-0 h-1';
    topBar.style.backgroundColor = player.color || '#38BDF8';
    card.appendChild(topBar);

    const nameEl = document.createElement('h2');
    nameEl.className = 'text-base font-bold mb-0.5 truncate w-full';
    nameEl.textContent = player.name;
    nameEl.style.color = player.color || '#ffffff';

    const coinsEl = document.createElement('div');
    coinsEl.className = 'text-xl font-extrabold my-0.5 text-amber-400 flex items-center justify-center gap-1 select-none';
    coinsEl.innerHTML = `🪙 <span class="text-white">${player.score || 0}</span>`;

    if (isModerator) {
        coinsEl.classList.add('cursor-pointer', 'hover:scale-110', 'transition-transform');
        coinsEl.title = 'Linksklick: +1 Münze | Rechtsklick: -1 Münze';
        
        coinsEl.onclick = () => socket.emit('add-point-to-player', player.name);
        coinsEl.oncontextmenu = (e) => {
            e.preventDefault();
            socket.emit('subtract-point-from-player', player.name);
        };

        // Drag and drop event listeners for moderator
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('ring-2', 'ring-teal-400', 'bg-gray-800');
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('ring-2', 'ring-teal-400', 'bg-gray-800');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('ring-2', 'ring-teal-400', 'bg-gray-800');
            const hintIndex = parseInt(e.dataTransfer.getData('text/plain'));
            if (hintIndex && !isNaN(hintIndex)) {
                assignHintToPlayer(player.name, hintIndex);
            }
        });
    }

    card.appendChild(nameEl);
    card.appendChild(coinsEl);

    // Aufgedeckte Hinweise für diesen Spieler unter der Karte
    const hints = playerRevealedHints[player.name] || [];
    if (hints.length > 0) {
        const hintsContainer = document.createElement('div');
        hintsContainer.className = 'w-full mt-2 pt-2 border-t border-gray-700/60 flex flex-col gap-1 text-left';
        
        hints.forEach(hintNum => {
            const hintBadge = document.createElement('div');
            hintBadge.className = 'bg-teal-950/70 border border-teal-500/40 text-teal-200 text-[11px] px-2 py-1 rounded flex items-center justify-between gap-1 shadow-sm';
            hintBadge.innerHTML = `
                <span class="font-semibold truncate">💡 Hinweis ${hintNum}</span>
                <span class="text-[10px] text-teal-400/80 italic font-normal">Aufgedeckt</span>
            `;
            hintsContainer.appendChild(hintBadge);
        });

        card.appendChild(hintsContainer);
    }

    return card;
}

// Server Connection Handling
socket.on('disconnect', () => {
    if (tipitStatus) {
        tipitStatus.textContent = 'Verbindung getrennt. Reconnect...';
    }
});

socket.on('connect', () => {
    if (isModerator) {
        socket.emit('register-moderator');
    } else if (playerName) {
        const savedScore = parseInt(localStorage.getItem('playerScore')) || 0;
        socket.emit('register-player', { name: playerName, score: savedScore });
    }
    if (tipitStatus) {
        tipitStatus.textContent = '';
    }
});
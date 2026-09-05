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
const openConfigBtn = document.getElementById('openConfigBtn');
const modConfigModal = document.getElementById('modConfigModal');
const closeConfigBtn = document.getElementById('closeConfigBtn');
const cancelConfigBtn = document.getElementById('cancelConfigBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const resetTipitBtn = document.getElementById('resetTipitBtn');
const cfgBonusHint = document.getElementById('cfgBonusHint');
const cfgHintsContainer = document.getElementById('cfgHintsContainer');
const personalHintsPanel = document.getElementById('personalHintsPanel');
const personalHintsList = document.getElementById('personalHintsList');

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
let bonusHintText = "Das ist ein Bonushinweis für alle!";
let currentHints = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    title: `Hinweis ${i + 1}`,
    text: `Tipp ${i + 1}`,
    cost: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5][i]
}));

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

const HINT_COLORS = [
    { background: '#315d70', border: '#78bdd4', text: '#d6f4fc' },
    { background: '#41694f', border: '#8bc9a0', text: '#dcf7e5' },
    { background: '#796340', border: '#d9b877', text: '#fff3d6' },
    { background: '#80525a', border: '#e3949d', text: '#ffe0e4' },
    { background: '#65537c', border: '#b8a1d7', text: '#f0e7ff' },
    { background: '#3d7470', border: '#83cbc2', text: '#d9faf5' },
    { background: '#805f49', border: '#dea47b', text: '#ffeadb' },
    { background: '#80566b', border: '#e5a0bb', text: '#ffe2ed' },
    { background: '#4e6684', border: '#92b9e6', text: '#e3efff' },
    { background: '#59733f', border: '#b4d682', text: '#effadc' }
];

function getHintColor(hintIndex) {
    return HINT_COLORS[(hintIndex - 1) % HINT_COLORS.length];
}

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

// Zusätzliche UI-Anpassungen für Moderator (z. B. Bonushinweis-Button & Config Modal Button)
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

    if (openConfigBtn) {
        openConfigBtn.classList.remove('hidden');
        openConfigBtn.addEventListener('click', openConfigModal);
    }
    if (closeConfigBtn) closeConfigBtn.addEventListener('click', closeConfigModal);
    if (cancelConfigBtn) cancelConfigBtn.addEventListener('click', closeConfigModal);
    if (saveConfigBtn) saveConfigBtn.addEventListener('click', saveConfigModal);
    if (resetTipitBtn) {
        resetTipitBtn.addEventListener('click', () => {
            if (confirm("Möchtest du wirklich den gesamten TipIt-Fortschritt zurücksetzen?")) {
                socket.emit('tipit-reset');
                closeConfigModal();
            }
        });
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function openConfigModal() {
    if (!modConfigModal) return;

    if (cfgBonusHint) {
        cfgBonusHint.value = bonusHintText;
    }

    if (cfgHintsContainer) {
        cfgHintsContainer.innerHTML = '';
        for (let i = 1; i <= 10; i++) {
            const hintObj = currentHints.find(h => h.id === i) || {
                id: i,
                title: `Hinweis ${i}`,
                text: `Tipp ${i}`,
                cost: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5][i - 1]
            };

            const row = document.createElement('div');
            row.className = 'bg-gray-900/40 border border-gray-700/80 p-3 rounded-xl flex flex-col sm:flex-row gap-3 items-center';
            row.innerHTML = `
                <div class="flex items-center gap-2 sm:w-1/4">
                    <span class="w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0">#${i}</span>
                    <input type="text" id="cfgTitle_${i}" value="${escapeHtml(hintObj.title)}" placeholder="Titel in Liste" class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-teal-400">
                </div>
                <div class="flex-grow w-full sm:w-2/4">
                    <input type="text" id="cfgText_${i}" value="${escapeHtml(hintObj.text)}" placeholder="Inhalt des Tipps..." class="w-full p-2 rounded bg-gray-700 border border-gray-600 text-white text-xs focus:outline-none focus:ring-1 focus:ring-teal-400">
                </div>
                <div class="flex items-center gap-1.5 w-full sm:w-1/4 justify-end">
                    <span class="text-xs text-amber-400 font-bold">Kosten:</span>
                    <input type="number" id="cfgCost_${i}" value="${hintObj.cost}" min="0" max="99" class="w-16 p-2 rounded bg-gray-700 border border-gray-600 text-white text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-teal-400">
                    <span class="text-xs text-gray-400">💰</span>
                </div>
            `;
            cfgHintsContainer.appendChild(row);
        }
    }

    modConfigModal.classList.remove('hidden');
}

function closeConfigModal() {
    if (modConfigModal) {
        modConfigModal.classList.add('hidden');
    }
}

function saveConfigModal() {
    const bonusHintVal = cfgBonusHint ? cfgBonusHint.value.trim() : bonusHintText;
    const hintsArr = [];

    for (let i = 1; i <= 10; i++) {
        const titleEl = document.getElementById(`cfgTitle_${i}`);
        const textEl = document.getElementById(`cfgText_${i}`);
        const costEl = document.getElementById(`cfgCost_${i}`);

        hintsArr.push({
            id: i,
            title: titleEl ? titleEl.value.trim() || `Hinweis ${i}` : `Hinweis ${i}`,
            text: textEl ? textEl.value.trim() : '',
            cost: costEl ? Math.max(0, parseInt(costEl.value) || 0) : 1
        });
    }

    socket.emit('tipit-update-config', {
        bonusHintText: bonusHintVal,
        hints: hintsArr
    });

    closeConfigModal();
}

function toggleBonusHint() {
    if (isModerator) {
        socket.emit('tipit-toggle-bonus', !bonusHintRevealed);
    }
}

function updateBonusHintUI() {
    const bonusHintTextEl = document.getElementById('bonus-hint-text');
    const bonusCard = document.getElementById('bonus-hint-card');

    if (bonusHintTextEl) {
        if (bonusHintRevealed) {
            bonusHintTextEl.textContent = `Bonushinweis: ${bonusHintText}`;
            bonusHintTextEl.classList.remove('italic', 'text-gray-300');
            bonusHintTextEl.classList.add('text-yellow-200', 'font-bold');
        } else {
            bonusHintTextEl.textContent = "Verdeckt";
            bonusHintTextEl.classList.add('italic', 'text-gray-300');
            bonusHintTextEl.classList.remove('text-yellow-200', 'font-bold');
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
    if (state.bonusHintText !== undefined) {
        bonusHintText = state.bonusHintText;
    }
    if (Array.isArray(state.hints)) {
        currentHints = state.hints;
    }

    updateBonusHintUI();
    renderHintList();
    renderPersonalHints();
    if (latestPlayers && latestPlayers.length > 0) {
        updatePlayersUI(latestPlayers);
    }
});

function renderPersonalHints() {
    if (isModerator || !playerName || !personalHintsPanel || !personalHintsList) return;

    const hints = playerRevealedHints[playerName] || [];
    personalHintsList.innerHTML = '';
    personalHintsPanel.classList.toggle('hidden', hints.length === 0);

    hints.forEach(hintNum => {
        const hintObj = currentHints.find(hint => hint.id === hintNum);
        if (!hintObj) return;

        const hintCard = document.createElement('div');
        hintCard.className = 'min-w-0 rounded-lg border border-teal-500/50 bg-teal-950/80 px-2.5 py-2 text-left text-xs shadow-sm';
        const color = getHintColor(hintNum);
        hintCard.style.backgroundColor = color.background;
        hintCard.style.borderColor = color.border;
        hintCard.innerHTML = `
            <div class="mb-0.5 font-bold truncate" style="color: ${color.text}">💡 ${escapeHtml(hintObj.title)}</div>
            <div class="font-medium leading-snug text-gray-200">${escapeHtml(hintObj.text)}</div>
        `;
        personalHintsList.appendChild(hintCard);
    });
}

// Rendert die 10 Hinweiszeilen in der zentralen Liste
function renderHintList() {
    hintsListContainer.innerHTML = '';

    for (let i = 1; i <= 10; i++) {
        const isRevealedAny = globalRevealedHints.has(i);
        const hintObj = currentHints.find(h => h.id === i) || {
            id: i,
            title: `Hinweis ${i}`,
            text: `Tipp ${i}`,
            cost: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5][i - 1]
        };

        const hintRow = document.createElement('div');
        const color = getHintColor(i);
        
        let rowClasses = 'border p-2 rounded-lg flex items-center justify-between transition duration-200 select-none ';
        if (isRevealedAny) {
            rowClasses += 'opacity-55 grayscale-[35%]';
        } else {
            rowClasses += 'hover:brightness-110';
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

        const receivingPlayerName = Object.entries(playerRevealedHints)
            .find(([, hintNumbers]) => hintNumbers.includes(i))?.[0];
        let rightStatusHTML = '';
        if (isRevealedAny) {
            rightStatusHTML = `
                <span class="max-w-24 truncate text-[10px] font-semibold text-gray-200 bg-gray-900/30 border border-white/20 px-2 py-0.5 rounded-md">
                    ${escapeHtml(receivingPlayerName || 'Aufgedeckt')}
                </span>
            `;
        }

        hintRow.className = rowClasses;
        hintRow.style.backgroundColor = color.background;
        hintRow.style.borderColor = color.border;
        hintRow.innerHTML = `
            <div class="flex min-w-0 items-center gap-2 overflow-hidden mr-2">
                <span class="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/40 text-[10px] font-bold flex items-center justify-center shrink-0">
                    ${i}
                </span>
                <span class="text-xs font-semibold truncate" style="color: ${color.text}">${escapeHtml(hintObj.title)}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    💰 ${hintObj.cost}
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

socket.on('update-text', ({ name, text }) => {
    const player = latestPlayers.find(entry => entry.name === name);
    if (!player) return;

    player.text = text;

    // Der eigene Eingabewert ist bereits sichtbar; ein Neurendern würde den Fokus entfernen.
    if (isModerator || name !== playerName) {
        updatePlayersUI(latestPlayers);
    }
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
    card.className = 'player-card w-full max-w-[220px] p-3 flex flex-col items-center text-center border border-gray-700/60 relative overflow-hidden transition-all duration-200 shadow-lg';
    
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
    coinsEl.innerHTML = `💰 <span class="text-white">${player.score || 0}</span>`;

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

    const isOwnPlayer = playerName && player.name === playerName;
    if (isOwnPlayer) {
        const answerInput = document.createElement('input');
        answerInput.type = 'text';
        answerInput.placeholder = 'Deine Antwort...';
        answerInput.value = player.text || '';
        answerInput.className = 'w-full mt-2 p-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-teal-400';
        answerInput.addEventListener('input', () => {
            socket.emit('player-typing', answerInput.value);
        });
        card.appendChild(answerInput);
    } else if (isModerator) {
        const answerDisplay = document.createElement('div');
        answerDisplay.className = 'w-full min-h-9 mt-2 p-2 rounded-lg bg-gray-900/70 border border-gray-700 text-xs text-gray-200 text-center break-words';
        answerDisplay.textContent = player.text || '';
        card.appendChild(answerDisplay);
    } else {
        const hiddenAnswer = document.createElement('div');
        hiddenAnswer.className = 'w-full h-9 mt-2 rounded-lg bg-gray-900/50 border border-gray-800';
        hiddenAnswer.setAttribute('aria-hidden', 'true');
        card.appendChild(hiddenAnswer);
    }

    // Auf der Karte stehen nur die Titel; der Tipp-Text wird privat am unteren Rand angezeigt.
    const hints = playerRevealedHints[player.name] || [];
    const hintsContainer = document.createElement('div');
    hintsContainer.className = 'w-full mt-2 pt-2 border-t border-gray-700/60 flex flex-col gap-1.5 text-left';

    for (let slotIndex = 0; slotIndex < 2; slotIndex++) {
        const hintNum = hints[slotIndex];
        const hintBadge = document.createElement('div');
        hintBadge.className = 'h-8 bg-teal-950/80 border border-teal-500/50 text-teal-200 text-xs px-2 py-1.5 rounded-lg shadow-sm flex items-center';

        if (hintNum) {
            const hintObj = currentHints.find(h => h.id === hintNum);
            const title = hintObj ? hintObj.title : `Hinweis ${hintNum}`;
            const color = getHintColor(hintNum);
            hintBadge.style.backgroundColor = color.background;
            hintBadge.style.borderColor = color.border;

            hintBadge.innerHTML = `
                <div class="min-w-0 w-full font-bold text-[11px] flex items-center gap-1" style="color: ${color.text}">
                    <span class="shrink-0">💡</span> <span class="min-w-0 truncate">${escapeHtml(title)}</span>
                </div>
            `;
        } else {
            hintBadge.classList.add('border-gray-800', 'bg-gray-900/30');
            hintBadge.classList.remove('border-teal-500/50', 'bg-teal-950/80');
        }

        hintsContainer.appendChild(hintBadge);
    }

    card.appendChild(hintsContainer);

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
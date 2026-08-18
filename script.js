// --- 1. STATE VARIABLES ---
let peer = null;
let connectionToHost = null;
let hostConnections = []; 
let connectionOwners = new Map();
let isHost = false;
let myName = "";
let matchHasStarted = false;
let aiMode = false;
const AI_TEAM_NAME = "AI Manager";

// Host-managed state
let availablePlayers = [...playersData];
let gameRosters = {}; 
let currentCard = null;
let currentBid = 0;
let highestBidder = "None";
let bidTimerInterval;
let timeLeft = 5;
const INITIAL_TIMER = 5;
const POST_BID_TIMER = 5;
const STARTING_BUDGET = 500;
const MAX_SQUAD_SIZE = 5;
const MAX_LOBBY_PLAYERS = 3;
const TRANSFER_DURATION = 20;
const TEAM_COLOURS = ["#4cc9f0", "#f72585", "#ffd166"];
const MAX_MATCH_OVR = 110;
const MAX_BASE_MATCH_OVR = 110;
const POSITION_GROUPS = {
    GK: "GK", CB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF",
    CDM: "MID", CM: "MID", CAM: "MID", LM: "MID", RM: "MID",
    LW: "ATT", RW: "ATT", ST: "ATT"
};
const POWER_CARD_POOL = [
    { id: "clock-master", phase: "Bidding", name: "Clock Master", description: "Your successful bids reset the auction clock to 7 seconds instead of 5.", effects: { bidTimerBonus: 2 } },
    { id: "bargain-hunter", phase: "Bidding", name: "Bargain Hunter", description: "Pay 10% less whenever you win an auction.", effects: { purchaseDiscount: 0.10 } },
    { id: "market-negotiator", phase: "Transfers", name: "Market Negotiator", description: "The AI is much more willing to accept your swap offers.", effects: { aiTradeAcceptanceBonus: 10 } },
    { id: "trade-magnet", phase: "Transfers", name: "Trade Magnet", description: "The AI is more likely to approach you with a swap offer.", effects: { aiTradeInterest: 3 } },
    { id: "formation-maestro", phase: "Tactics", name: "Formation Maestro", description: "A balanced formation gives an extra team-rating boost.", effects: { formationBonus: 0.05 } },
    { id: "chemistry-catalyst", phase: "Tactics", name: "Chemistry Catalyst", description: "Chemistry links have a stronger impact on your team.", effects: { chemistryBonus: 0.04 } },
    { id: "positional-expert", phase: "Tactics", name: "Positional Expert", description: "Out-of-position players suffer a smaller penalty.", effects: { positionRecovery: 0.10 } },
    { id: "pressing-plan", phase: "Tactics", name: "Pressing Plan", description: "Gain more control of the ball and make more tackles.", effects: { controlBonus: 0.10, tackleBonus: 0.14 } },
    { id: "counter-attack", phase: "Tactics", name: "Counter Attack", description: "Create 10% more expected goals from your attacks.", effects: { xgBonus: 0.10 } },
    { id: "defensive-drill", phase: "Tactics", name: "Defensive Drill", description: "Improve defensive security, especially without a goalkeeper.", effects: { defenceBonus: 0.12, noGoalkeeperCover: 0.18 } },
    { id: "set-piece-specialists", phase: "Tactics", name: "Set-Piece Specialists", description: "A small extra expected-goals boost from dead-ball situations.", effects: { xgBonus: 0.07, chemistryBonus: 0.01 } }
];

// Tactics & Simulation State
let tacticsTimerInterval;
let tacticsTimeLeft = 20;
let lockedTactics = {};
let hasSubmittedTactics = false;
let transferTimerInterval;
let transferTimeLeft = TRANSFER_DURATION;
let transferPhaseActive = false;
let pendingTradeOffers = [];
let aiTradeInterval;
let tournamentFixtures = [];
let tournamentResults = [];
let selectedTournamentMatchIndex = 0;
let liveCommentaryInterval;
let aiBidInterval;
let livePitchState = { possessionTeam: null, ballX: 50, ballY: 50 };
let powerCardDrafts = {};
let powerCardPhaseActive = false;
let powerCardStartScheduled = false;
const LIVE_EVENT_INTERVAL_MS = 2600;

// --- 2. DOM ELEMENTS ---
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const powerCardScreen = document.getElementById('power-card-screen');
const usernameInput = document.getElementById('username');
const teamColourInput = document.getElementById('team-colour');

teamColourInput.addEventListener('input', () => {
    document.getElementById('team-colour-value').innerText = teamColourInput.value.toUpperCase();
});

// --- 3. MENU LOGIC & VALIDATION ---
document.getElementById('createBtn').addEventListener('click', () => {
    myName = usernameInput.value.trim();
    if (!myName) {
        showCustomAlert("Please enter a display name first!");
        return;
    }
    document.getElementById('joinPanel').classList.remove('active');
    document.getElementById('createPanel').classList.add('active');
    setupHost();
});

document.getElementById('joinBtn').addEventListener('click', () => {
    myName = usernameInput.value.trim();
    if (!myName) {
        showCustomAlert("Please enter a display name first!");
        return;
    }
    document.getElementById('createPanel').classList.remove('active');
    document.getElementById('joinPanel').classList.add('active');
});

document.getElementById('aiGameBtn').addEventListener('click', () => {
    myName = usernameInput.value.trim();
    if (!myName) {
        showCustomAlert("Please enter a display name first!");
        return;
    }
    if (myName.toLowerCase() === AI_TEAM_NAME.toLowerCase()) {
        showCustomAlert("Please choose a different name from the AI manager.");
        return;
    }
    startAiGame();
});

function startAiGame() {
    isHost = true;
    aiMode = true;
    matchHasStarted = true;
    availablePlayers = [...playersData];
    gameRosters = {
        [myName]: { money: STARTING_BUDGET, squad: [], teamColour: getAvailableTeamColour(teamColourInput.value) },
        [AI_TEAM_NAME]: { money: STARTING_BUDGET, squad: [], teamColour: getAvailableTeamColour('#f72585') }
    };
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    startPowerCardDraft();
}

// --- 4. HOST MULTIPLAYER LOGIC ---
function setupHost() {
    isHost = true;
    aiMode = false;
    const randomCode = Math.floor(10000 + Math.random() * 90000).toString();
    document.getElementById('lobbyCode').innerText = randomCode;
    
    gameRosters[myName] = { money: STARTING_BUDGET, squad: [], teamColour: getAvailableTeamColour(teamColourInput.value) };

    peer = new Peer("footy-" + randomCode); 
    peer.on('open', () => {
        document.getElementById('startGameBtn').style.display = 'block';
    });

    peer.on('connection', (conn) => {
        if (hostConnections.length >= MAX_LOBBY_PLAYERS - 1 || Object.keys(gameRosters).length >= MAX_LOBBY_PLAYERS) {
            rejectLobbyConnection(conn, 'This lobby already has the maximum of 3 players.');
            return;
        }
        hostConnections.push(conn);
        document.getElementById('player-count').innerText = `Players in lobby: ${Object.keys(gameRosters).length}/${MAX_LOBBY_PLAYERS}`;

        conn.on('close', () => {
            const connectionIndex = hostConnections.indexOf(conn);
            if (connectionIndex >= 0) hostConnections.splice(connectionIndex, 1);
            const disconnectedName = connectionOwners.get(conn);
            if (disconnectedName && !matchHasStarted) {
                delete gameRosters[disconnectedName];
                connectionOwners.delete(conn);
                document.getElementById('player-count').innerText = `Players in lobby: ${Object.keys(gameRosters).length}/${MAX_LOBBY_PLAYERS}`;
            }
        });
        
        conn.on('data', (data) => {
            if (data.type === 'JOIN') {
                if (!data.name || gameRosters[data.name] || Object.keys(gameRosters).length >= MAX_LOBBY_PLAYERS || matchHasStarted) {
                    const message = gameRosters[data.name]
                        ? 'That display name is already in use.'
                        : matchHasStarted
                            ? 'The game has already started. Please join a new lobby.'
                            : 'This lobby already has the maximum of 3 players.';
                    rejectLobbyConnection(conn, message, 'JOIN_REJECTED');
                    return;
                }
                gameRosters[data.name] = {
                    money: STARTING_BUDGET,
                    squad: [],
                    teamColour: getAvailableTeamColour(data.teamColour)
                };
                connectionOwners.set(conn, data.name);
                document.getElementById('player-count').innerText = `Players in lobby: ${Object.keys(gameRosters).length}/${MAX_LOBBY_PLAYERS}`;
            } else if (data.type === 'BID') {
                const senderName = connectionOwners.get(conn);
                processBid(data.amount, senderName);
            } else if (data.type === 'SUBMIT_TACTICS') {
                handleClientTactics(connectionOwners.get(conn), data.tactics);
            } else if (data.type === 'OFFER_TRADE') {
                createTradeOffer({ ...data, name: connectionOwners.get(conn) });
            } else if (data.type === 'RESPOND_TRADE') {
                respondToTrade(connectionOwners.get(conn), data.offerId, data.accepted);
            } else if (data.type === 'READY_FOR_TACTICS') {
                markReadyForTactics(connectionOwners.get(conn));
            } else if (data.type === 'SELECT_POWER_CARD') {
                selectPowerCard(connectionOwners.get(conn), data.cardId);
            }
        });
    });
}

function rejectLobbyConnection(conn, message, type = 'LOBBY_FULL') {
    const sendRejection = () => {
        if (conn.open) conn.send({ type, message });
        setTimeout(() => conn.close(), 100);
    };
    if (conn.open) sendRejection();
    else conn.on('open', sendRejection);
}

document.getElementById('startGameBtn').addEventListener('click', () => {
    if (Object.keys(gameRosters).length < 2) {
        showCustomAlert('At least two players must join before the game can start.');
        return;
    }
    matchHasStarted = true;
    startPowerCardDraft();
});

// --- 5. CLIENT JOIN LOGIC ---
document.getElementById('connectBtn').addEventListener('click', () => {
    const code = document.getElementById('joinCode').value;
    if(!code) {
        showCustomAlert("Enter a 5-digit code!");
        return;
    }
    document.getElementById('join-status').innerText = "Connecting...";

    peer = new Peer();
    peer.on('open', () => {
        connectionToHost = peer.connect("footy-" + code);
        connectionToHost.on('open', () => {
            document.getElementById('join-status').innerText = "Connected! Waiting for host...";
            connectionToHost.send({ type: 'JOIN', name: myName, teamColour: teamColourInput.value });
        });

        connectionToHost.on('data', (data) => {
            if (data.type === 'UPDATE_STATE') {
                syncGameState(data.state);
            } else if (data.type === 'START_POWER_CARD_DRAFT' || data.type === 'POWER_CARD_STATE') {
                initPowerCardDraft(data.drafts, data.rosters);
            } else if (data.type === 'START_TACTICS') {
                initTacticsPhase(data.rosters);
            } else if (data.type === 'START_TRANSFER') {
                initTransferPhase(data.rosters, data.timeLeft);
            } else if (data.type === 'TRANSFER_STATE') {
                syncTransferState(data.state);
            } else if (data.type === 'START_MATCH') {
                showLoadingScreen(data.fixture, data.fixtureIndex, data.totalFixtures, data.lineups, data.teamColours);
            } else if (data.type === 'COMMENTARY_EVENT') {
                appendCommentaryEvent(data.event);
            } else if (data.type === 'MATCH_FINISHED') {
                updateTournamentView(data.results, data.currentMatch);
            } else if (data.type === 'SHOW_TOURNAMENT_RESULTS') {
                renderMatchResults(data.payload);
            } else if (data.type === 'LOBBY_FULL' || data.type === 'JOIN_REJECTED') {
                document.getElementById('join-status').innerText = data.message || 'This lobby already has the maximum of 3 players.';
            }
        });
    });
});

// --- 6. PRE-GAME POWER CARD DRAFT ---
function startPowerCardDraft() {
    powerCardPhaseActive = true;
    powerCardStartScheduled = false;
    powerCardDrafts = {};
    Object.entries(gameRosters).forEach(([name, roster]) => {
        roster.powerCard = null;
        powerCardDrafts[name] = drawPowerCards(3);
    });
    broadcastPowerCardState('START_POWER_CARD_DRAFT');

    if (aiMode) {
        setTimeout(() => {
            const aiOptions = powerCardDrafts[AI_TEAM_NAME] || [];
            const selected = chooseAiPowerCard(aiOptions);
            if (selected) selectPowerCard(AI_TEAM_NAME, selected.id);
        }, 700);
    }
}

function drawPowerCards(count) {
    return [...POWER_CARD_POOL]
        .sort(() => Math.random() - 0.5)
        .slice(0, count);
}

function chooseAiPowerCard(options) {
    const priorities = {
        "formation-maestro": 7,
        "chemistry-catalyst": 6,
        "defensive-drill": 6,
        "counter-attack": 5,
        "bargain-hunter": 4,
        "clock-master": 3
    };
    return [...options].sort((first, second) => (priorities[second.id] || 2) - (priorities[first.id] || 2) + (Math.random() - 0.5))[0];
}

function getPowerCard(teamName) {
    const cardId = gameRosters[teamName]?.powerCard;
    return POWER_CARD_POOL.find(card => card.id === cardId) || null;
}

function getPowerCardEffects(teamName) {
    return getPowerCard(teamName)?.effects || {};
}

function broadcastPowerCardState(type) {
    const payload = { type, drafts: powerCardDrafts, rosters: gameRosters };
    hostConnections.forEach(conn => conn.send(payload));
    initPowerCardDraft(powerCardDrafts, gameRosters);
}

function initPowerCardDraft(drafts, rosters) {
    powerCardDrafts = drafts || {};
    gameRosters = rosters || gameRosters;
    menuScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    endScreen.style.display = 'none';
    powerCardScreen.style.display = 'block';

    const options = powerCardDrafts[myName] || [];
    const selectedId = gameRosters[myName]?.powerCard;
    document.getElementById('power-card-options').innerHTML = options.map(card => `
        <button class="power-card" type="button" onclick="selectPowerCardOption('${card.id}')" ${selectedId ? 'disabled' : ''}>
            <span class="card-phase">${card.phase} advantage</span>
            <h3>${card.name}</h3>
            <p>${card.description}</p>
        </button>
    `).join('');
    const selectedCount = Object.values(gameRosters).filter(roster => roster.powerCard).length;
    const selectedCard = getPowerCard(myName);
    document.getElementById('power-card-status').innerText = selectedCard
        ? `Selected: ${selectedCard.name}. Waiting for the other managers… (${selectedCount}/${Object.keys(gameRosters).length})`
        : `Choose one card to lock in your game plan. (${selectedCount}/${Object.keys(gameRosters).length} managers ready)`;
}

function selectPowerCardOption(cardId) {
    if (isHost) selectPowerCard(myName, cardId);
    else connectionToHost?.send({ type: 'SELECT_POWER_CARD', cardId });
}

function selectPowerCard(playerName, cardId) {
    if (!powerCardPhaseActive || !gameRosters[playerName] || gameRosters[playerName].powerCard) return;
    const isOffered = (powerCardDrafts[playerName] || []).some(card => card.id === cardId);
    if (!isOffered) return;
    gameRosters[playerName].powerCard = cardId;
    broadcastPowerCardState('POWER_CARD_STATE');

    if (Object.values(gameRosters).every(roster => roster.powerCard) && !powerCardStartScheduled) {
        powerCardStartScheduled = true;
        powerCardPhaseActive = false;
        setTimeout(startNextRound, 700);
    }
}

// --- 6. GAME LOOP LOGIC (HOST ONLY) ---
function startNextRound() {
    if (availablePlayers.length === 0 || checkEndGameCondition()) {
        endGame();
        return;
    }

    const affordableIndexes = availablePlayers
        .map((player, index) => ({ player, index }))
        .filter(({ player }) => Object.values(gameRosters).some(roster => canRosterBuyPlayer(roster, player)))
        .map(({ index }) => index);
    if (!affordableIndexes.length) {
        endGame();
        return;
    }
    const randomIndex = affordableIndexes[Math.floor(Math.random() * affordableIndexes.length)];
    currentCard = availablePlayers.splice(randomIndex, 1)[0];
    currentBid = currentCard.basePrice;
    highestBidder = "None";
    timeLeft = INITIAL_TIMER;
    
    broadcastState();
    startTimer();
}

function processBid(proposedBid, bidderName) {
    const bidderData = gameRosters[bidderName];
    if (!bidderData) return;

    if (proposedBid > currentBid && proposedBid <= bidderData.money && bidderData.squad.length < MAX_SQUAD_SIZE) {
        currentBid = proposedBid;
        highestBidder = bidderName;
        timeLeft = POST_BID_TIMER + (getPowerCardEffects(bidderName).bidTimerBonus || 0);
        broadcastState();
    }
}

function startTimer() {
    clearInterval(bidTimerInterval);
    clearInterval(aiBidInterval);
    if (aiMode) scheduleAiBids();
    bidTimerInterval = setInterval(() => {
        timeLeft--;
        broadcastState();

        if (timeLeft <= 0) {
            clearInterval(bidTimerInterval);
            sellPlayer();
        }
    }, 1000);
}

function scheduleAiBids() {
    aiBidInterval = setInterval(() => {
        const ai = gameRosters[AI_TEAM_NAME];
        if (!ai || !currentCard || timeLeft <= 0 || ai.squad.length >= MAX_SQUAD_SIZE) return;
        const valueScore = currentCard.overall + (currentCard.positions?.length || 1) * 2;
        const maximumBid = Math.min(ai.money, Math.round(currentCard.basePrice + valueScore * 0.65));
        if (highestBidder === AI_TEAM_NAME || currentBid >= maximumBid || Math.random() > 0.42) return;
        const increments = [1, 5, 10];
        const increment = increments[Math.floor(Math.random() * increments.length)];
        const nextBid = Math.min(maximumBid, currentBid + increment);
        if (nextBid > currentBid) processBid(nextBid, AI_TEAM_NAME);
    }, 650);
}

function sellPlayer() {
    clearInterval(aiBidInterval);
    if (highestBidder !== "None" && gameRosters[highestBidder]) {
        const discount = getPowerCardEffects(highestBidder).purchaseDiscount || 0;
        const finalPrice = Math.ceil(currentBid * (1 - discount));
        gameRosters[highestBidder].money -= finalPrice;
        gameRosters[highestBidder].squad.push(currentCard.name);
    }
    setTimeout(startNextRound, 2000);
}

function canRosterBuyPlayer(roster, player) {
    if (!roster || !player) return false;
    return roster.squad.length < MAX_SQUAD_SIZE && roster.money > player.basePrice;
}

function canRosterBuyAnyPlayer(roster) {
    return availablePlayers.some(player => canRosterBuyPlayer(roster, player));
}

function checkEndGameCondition() {
    const teams = Object.values(gameRosters);
    if (!teams.length) return true;
    return teams.every(roster => roster.squad.length >= MAX_SQUAD_SIZE || !canRosterBuyAnyPlayer(roster));
}

function endGame() {
    clearInterval(bidTimerInterval);
    startTransferPhase();
}

function getAvailableTeamColour(preferredColour) {
    const usedColours = Object.values(gameRosters).map(roster => roster.teamColour?.toLowerCase());
    if (preferredColour && !usedColours.includes(preferredColour.toLowerCase())) return preferredColour;
    return TEAM_COLOURS.find(colour => !usedColours.includes(colour.toLowerCase())) || TEAM_COLOURS[0];
}

function clampOverall(value, maximum = MAX_MATCH_OVR) {
    return Math.min(maximum, Math.max(1, Math.round(value)));
}

function broadcastState() {
    const state = {
        card: currentCard,
        bid: currentBid,
        leader: highestBidder,
        time: timeLeft,
        rosters: gameRosters
    };
    syncGameState(state);
    hostConnections.forEach(conn => conn.send({ type: 'UPDATE_STATE', state }));
}

// --- 7. UI BIDDING UPDATES ---
function syncGameState(state) {
    menuScreen.style.display = 'none';
    powerCardScreen.style.display = 'none';
    gameScreen.style.display = 'flex';

    if (state.card) {
        document.getElementById('player-icon').src = `photocards/${state.card.name}PhotoCard.png`;
        document.getElementById('player-name').innerText = state.card.name;
        document.getElementById('player-pace').innerText = `PAC: ${state.card.pace}`;
        document.getElementById('player-shooting').innerText = `SHO: ${state.card.shooting}`;
        document.getElementById('player-passing').innerText = `PAS: ${state.card.passing}`;
        document.getElementById('player-dribbling').innerText = `DRI: ${state.card.dribbling}`;
        document.getElementById('player-defence').innerText = `DEF: ${state.card.defence}`;
        document.getElementById('player-physical').innerText = `PHY: ${state.card.physical}`;
        document.getElementById('player-overall').innerText = `OVR: ${state.card.overall}`;
    }

    currentBid = state.bid;
    document.getElementById('current-bid').innerText = state.bid;
    document.getElementById('highest-bidder').innerText = `Highest Bidder: ${state.leader}`;
    document.getElementById('timer-display').innerText = state.time > 0 ? `Time Left: ${state.time}s` : "SOLD!";
    document.getElementById('timer-display').style.color = state.time <= 0 ? "#ef233c" : "#ffd166";

    const myData = state.rosters[myName];
    if (myData) {
        document.getElementById('my-budget').innerText = myData.money;
    }

    const teamsList = document.getElementById('teams-list');
    teamsList.innerHTML = "";
    for (const [name, data] of Object.entries(state.rosters)) {
        let playersHtml = data.squad.map(p => {
            const player = playersData.find(item => item.name === p);
            return `<li>${p}${player ? ` <span class="squad-ovr">${player.overall} OVR</span>` : ''}</li>`;
        }).join('');
        teamsList.innerHTML += `
            <div class="team-block" style="border-left: 4px solid ${data.teamColour || '#4cc9f0'};">
                <h4><span><i class="team-colour-dot" style="background:${data.teamColour || '#4cc9f0'}"></i>${name}</span> <span>${data.squad.length}/${MAX_SQUAD_SIZE} players · £${data.money}M</span></h4>
                <p class="power-card-label">${getPowerCard(name)?.name || 'Choosing game plan…'}</p>
                <ul>${playersHtml || "<li>No players yet</li>"}</ul>
            </div>
        `;
    }
}

// --- 8. TRANSFER MARKET ---
function startTransferPhase() {
    transferPhaseActive = true;
    transferTimeLeft = TRANSFER_DURATION;
    pendingTradeOffers = [];
    Object.entries(gameRosters).forEach(([name, roster]) => { roster.readyForTactics = aiMode && name === AI_TEAM_NAME; });
    broadcastTransferState('START_TRANSFER');
    if (aiMode) scheduleAiTrades();
    startTransferTimer();
}

function startTransferTimer() {
    clearInterval(transferTimerInterval);
    transferTimerInterval = setInterval(() => {
        transferTimeLeft--;
        broadcastTransferState('TRANSFER_STATE');
        if (transferTimeLeft <= 0) {
            clearInterval(transferTimerInterval);
            beginTacticsPhase();
        }
    }, 1000);
}

function getTransferState() {
    return { rosters: gameRosters, offers: pendingTradeOffers, timeLeft: transferTimeLeft };
}

function broadcastTransferState(type) {
    const state = getTransferState();
    if (type === 'START_TRANSFER') {
        hostConnections.forEach(conn => conn.send({ type, rosters: gameRosters, timeLeft: transferTimeLeft }));
        initTransferPhase(gameRosters, transferTimeLeft);
    } else {
        hostConnections.forEach(conn => conn.send({ type, state }));
        syncTransferState(state);
    }
}

function initTransferPhase(rosters, timeLeft = TRANSFER_DURATION) {
    transferPhaseActive = true;
    gameRosters = rosters;
    transferTimeLeft = timeLeft;
    gameScreen.style.display = 'none';
    endScreen.style.display = 'flex';
    document.getElementById('transfer-phase').style.display = 'block';
    document.getElementById('tactics-phase').style.display = 'none';
    document.getElementById('loading-phase').style.display = 'none';
    document.getElementById('match-results-phase').style.display = 'none';
    renderTransferMarket();
}

function syncTransferState(state) {
    gameRosters = state.rosters;
    pendingTradeOffers = state.offers;
    transferTimeLeft = state.timeLeft;
    if (document.getElementById('transfer-phase').style.display !== 'none') renderTransferMarket();
}

function renderTransferMarket() {
    const myRoster = gameRosters[myName] || { squad: [] };
    document.getElementById('transfer-timer').innerText = `Market closes in: ${Math.max(0, transferTimeLeft)}s`;
    document.getElementById('transfer-rosters').innerHTML = Object.entries(gameRosters).map(([name, roster]) => {
        const squad = roster.squad.map(playerName => {
            const player = playersData.find(item => item.name === playerName);
            return `<li>${playerName} <span class="squad-ovr">${player?.overall || 50} OVR</span></li>`;
        }).join('') || '<li>No players</li>';
        return `<div class="market-team" style="--team-colour:${roster.teamColour || '#4cc9f0'}"><h3><i class="team-colour-dot" style="background:${roster.teamColour || '#4cc9f0'}"></i>${name}</h3><p>£${roster.money}M</p><ul>${squad}</ul></div>`;
    }).join('');

    const ownOptions = myRoster.squad.map(name => `<option value="${name}">${name}</option>`).join('') || '<option value="">No players available</option>';
    document.getElementById('trade-my-player-select').innerHTML = ownOptions;

    const otherTeams = Object.keys(gameRosters).filter(name => name !== myName);
    const teamSelect = document.getElementById('trade-team-select');
    teamSelect.innerHTML = otherTeams.map(name => `<option value="${name}">${name}</option>`).join('') || '<option value="">No other team</option>';
    updateTradeTargetOptions();
    updateTradePreview();

    const offerArea = document.getElementById('trade-offers');
    const relevantOffers = pendingTradeOffers.filter(offer => offer.to === myName);
    offerArea.innerHTML = relevantOffers.length
        ? relevantOffers.map(offer => `<div class="trade-offer"><span><strong>${offer.from}</strong> offers ${offer.theirPlayer} for your ${offer.myPlayer}.</span><button class="btn btn-primary" onclick="respondToTradeOffer('${offer.id}', true)">Accept</button><button class="btn btn-secondary" onclick="respondToTradeOffer('${offer.id}', false)">Decline</button></div>`).join('')
        : '<p class="subtitle" style="margin: 0;">No trade offers waiting.</p>';

    const locked = transferTimeLeft <= 0 || !myRoster.squad.length;
    document.getElementById('offer-trade-btn').disabled = locked || !otherTeams.length;
    document.getElementById('close-market-btn').innerText = myRoster.readyForTactics ? 'Ready for Tactics ✓' : 'Ready for Tactics';
    document.getElementById('close-market-btn').disabled = Boolean(myRoster.readyForTactics);
}

function updateTradeTargetOptions() {
    const targetTeam = document.getElementById('trade-team-select').value;
    const targetRoster = gameRosters[targetTeam] || { squad: [] };
    document.getElementById('trade-their-player-select').innerHTML = targetRoster.squad.map(name => `<option value="${name}">${name}</option>`).join('') || '<option value="">No players available</option>';
}

function updateTradePreview() {
    const offered = document.getElementById('trade-my-player-select').value;
    const targetTeam = document.getElementById('trade-team-select').value;
    const requested = document.getElementById('trade-their-player-select').value;
    const preview = document.getElementById('trade-preview');
    if (!offered || !targetTeam || !requested) {
        preview.innerText = 'Select players to preview the swap.';
        return;
    }
    preview.innerText = `You offer ${offered} ↔ You receive ${requested} from ${targetTeam}`;
}

function createTradeOffer({ name, targetTeam, myPlayer, theirPlayer }) {
    if (!transferPhaseActive) return;
    const owner = gameRosters[name];
    const target = gameRosters[targetTeam];
    if (!owner || !target || name === targetTeam || !owner.squad.includes(myPlayer) || !target.squad.includes(theirPlayer)) return;
    if (pendingTradeOffers.some(offer => offer.from === name && offer.to === targetTeam && offer.theirPlayer === myPlayer && offer.myPlayer === theirPlayer)) return;
    pendingTradeOffers.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, from: name, to: targetTeam, theirPlayer: myPlayer, myPlayer: theirPlayer });
    broadcastTransferState('TRANSFER_STATE');
    if (aiMode && targetTeam === AI_TEAM_NAME) {
        const aiValue = playersData.find(player => player.name === theirPlayer)?.overall || 50;
        const offeredValue = playersData.find(player => player.name === myPlayer)?.overall || 50;
        const negotiationBonus = getPowerCardEffects(name).aiTradeAcceptanceBonus || 0;
        const accepted = offeredValue + 5 + negotiationBonus >= aiValue || Math.random() < 0.28;
        setTimeout(() => {
            const offer = pendingTradeOffers.find(item => item.from === name && item.to === AI_TEAM_NAME && item.theirPlayer === myPlayer && item.myPlayer === theirPlayer);
            if (offer) respondToTrade(AI_TEAM_NAME, offer.id, accepted);
        }, 700 + Math.random() * 900);
    }
}

function respondToTrade(ownerName, offerId, accepted) {
    if (!transferPhaseActive) return;
    const offerIndex = pendingTradeOffers.findIndex(offer => offer.id === offerId && offer.to === ownerName);
    if (offerIndex < 0) return;
    const offer = pendingTradeOffers[offerIndex];
    const from = gameRosters[offer.from];
    const to = gameRosters[offer.to];
    if (accepted && from?.squad.includes(offer.theirPlayer) && to?.squad.includes(offer.myPlayer)) {
        from.squad[from.squad.indexOf(offer.theirPlayer)] = offer.myPlayer;
        to.squad[to.squad.indexOf(offer.myPlayer)] = offer.theirPlayer;
    }
    pendingTradeOffers.splice(offerIndex, 1);
    broadcastTransferState('TRANSFER_STATE');
}

function respondToTradeOffer(offerId, accepted) {
    if (isHost) respondToTrade(myName, offerId, accepted);
    else connectionToHost.send({ type: 'RESPOND_TRADE', name: myName, offerId, accepted });
}

function scheduleAiTrades() {
    clearInterval(aiTradeInterval);
    // Check at human-like intervals so the market has time for players to react.
    aiTradeInterval = setInterval(() => {
        if (!transferPhaseActive || transferTimeLeft <= 0) return;
        const aiRoster = gameRosters[AI_TEAM_NAME];
        const targets = Object.keys(gameRosters).filter(name => name !== AI_TEAM_NAME && gameRosters[name].squad.length);
        if (!aiRoster?.squad.length || !targets.length || Math.random() > 0.62) return;

        const targetTeam = targets.sort((first, second) =>
            (getPowerCardEffects(second).aiTradeInterest || 0) - (getPowerCardEffects(first).aiTradeInterest || 0) || Math.random() - 0.5
        )[0];
        const targetRoster = gameRosters[targetTeam];
        if (pendingTradeOffers.some(offer => offer.from === AI_TEAM_NAME && offer.to === targetTeam)) return;

        const aiPlayer = chooseAiTradePlayer(aiRoster.squad, targetRoster.squad, true);
        const requestedPlayer = chooseAiTradePlayer(targetRoster.squad, aiRoster.squad, false);
        if (!aiPlayer || !requestedPlayer) return;
        createTradeOffer({ name: AI_TEAM_NAME, targetTeam, myPlayer: aiPlayer, theirPlayer: requestedPlayer });
    }, 2800);
}

function chooseAiTradePlayer(sourceSquad, comparisonSquad, offering) {
    const comparisonAverage = comparisonSquad.reduce((sum, name) => {
        return sum + (playersData.find(player => player.name === name)?.overall || 50);
    }, 0) / Math.max(1, comparisonSquad.length);
    const choices = sourceSquad.map(name => {
        const overall = playersData.find(player => player.name === name)?.overall || 50;
        const targetValue = offering ? Math.max(50, comparisonAverage - 8) : comparisonAverage + 4;
        return { name, score: Math.abs(overall - targetValue) + Math.random() * 12 };
    }).sort((a, b) => a.score - b.score);
    return choices[0]?.name || null;
}

function markReadyForTactics(playerName) {
    if (!gameRosters[playerName]) return;
    gameRosters[playerName].readyForTactics = true;
    if (Object.values(gameRosters).every(roster => roster.readyForTactics)) {
        clearInterval(transferTimerInterval);
        beginTacticsPhase();
    } else {
        broadcastTransferState('TRANSFER_STATE');
    }
}

function beginTacticsPhase() {
    transferPhaseActive = false;
    clearInterval(aiTradeInterval);
    pendingTradeOffers = [];
    hostConnections.forEach(conn => conn.send({ type: 'START_TACTICS', rosters: gameRosters }));
    initTacticsPhase(gameRosters);
    if (aiMode) handleClientTactics(AI_TEAM_NAME, buildAiTactics(gameRosters[AI_TEAM_NAME].squad));
}

function buildAiTactics(squad) {
    const availablePositions = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"];
    const tactics = {};
    squad.forEach((name, index) => {
        const player = playersData.find(item => item.name === name);
        const preferred = (player?.positions || []).find(position => !Object.values(tactics).includes(position));
        tactics[name] = preferred || availablePositions.find(position => !Object.values(tactics).includes(position)) || availablePositions[index];
    });
    return tactics;
}

// --- 8. TACTICS PHASE ---
function initTacticsPhase(rosters) {
    gameRosters = rosters;
    lockedTactics = {};
    hasSubmittedTactics = false;
    gameScreen.style.display = 'none';
    endScreen.style.display = 'flex';
    document.getElementById('transfer-phase').style.display = 'none';
    document.getElementById('tactics-phase').style.display = 'block';
    document.getElementById('lockTacticsBtn').disabled = false;
    document.getElementById('lockTacticsBtn').innerText = 'Lock In Tactics';

    const mySquad = rosters[myName].squad;
    const builderList = document.getElementById('team-builder-list');
    builderList.innerHTML = "";
    
    const positions = ["ST", "LW", "RW", "CAM", "CM", "CDM", "LM", "RM", "LB", "CB", "RB", "GK"];
    let optionsHtml = positions.map(pos => `<option value="${pos}">${pos}</option>`).join('');

    mySquad.forEach(playerName => {
        const player = playersData.find(item => item.name === playerName);
        const preferred = player?.positions?.join(', ') || 'Any position';
        builderList.innerHTML += `
            <div class="builder-row">
                <span>${playerName} <small>${player?.overall || 50} OVR · prefers ${preferred}</small></span>
                <select class="pos-select" data-player="${playerName}">
                    <option value="" disabled selected>Select Position</option>
                    ${optionsHtml}
                </select>
            </div>
        `;
    });

    document.querySelectorAll('.pos-select').forEach(select => {
        select.addEventListener('change', validateUniquePositions);
    });

    startTacticsTimer();
}

function validateUniquePositions(e) {
    const selects = document.querySelectorAll('.pos-select');
    const selectedValues = Array.from(selects).map(s => s.value).filter(v => v !== "");
    const hasDuplicates = new Set(selectedValues).size !== selectedValues.length;
    if (hasDuplicates) {
        showCustomAlert("Each position can only be used ONCE!");
        e.target.value = "";
    }
}

function startTacticsTimer() {
    tacticsTimeLeft = 20;
    clearInterval(tacticsTimerInterval);
    
    tacticsTimerInterval = setInterval(() => {
        tacticsTimeLeft--;
        document.getElementById('tactics-timer').innerText = `Tactics Time: ${tacticsTimeLeft}s`;

        if (tacticsTimeLeft <= 0) {
            clearInterval(tacticsTimerInterval);
            autoSubmitTactics();
        }
    }, 1000);
}

document.getElementById('lockTacticsBtn').addEventListener('click', () => {
    submitTactics();
});

function autoSubmitTactics() {
    if (hasSubmittedTactics) return;
    const selects = document.querySelectorAll('.pos-select');
    const availablePos = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST"];
    
    selects.forEach((select, idx) => {
        if (!select.value) {
            const player = playersData.find(item => item.name === select.dataset.player);
            const preferred = (player?.positions || []).find(pos => !Array.from(selects).some(other => other !== select && other.value === pos));
            select.value = preferred || availablePos.find(pos => !Array.from(selects).some(other => other !== select && other.value === pos)) || availablePos[idx];
        }
    });
    submitTactics();
}

function submitTactics() {
    if (hasSubmittedTactics) return;
    
    const selects = document.querySelectorAll('.pos-select');
    const myTactics = {};
    let isComplete = true;

    selects.forEach(select => {
        if (!select.value) isComplete = false;
        myTactics[select.getAttribute('data-player')] = select.value;
    });

    if (!isComplete && tacticsTimeLeft > 0) {
        showCustomAlert(`Please assign all ${selects.length} positions!`);
        return;
    }

    hasSubmittedTactics = true;
    document.getElementById('lockTacticsBtn').disabled = true;
    document.getElementById('lockTacticsBtn').innerText = "Tactics Locked In!";

    if (isHost) {
        handleClientTactics(myName, myTactics);
    } else {
        connectionToHost.send({ type: 'SUBMIT_TACTICS', name: myName, tactics: myTactics });
    }
}

// --- 9. MATCH SIMULATION ENGINE ---
function handleClientTactics(playerName, tactics) {
    lockedTactics[playerName] = tactics;
    const totalPlayers = Object.keys(gameRosters).length;

    if (Object.keys(lockedTactics).length >= totalPlayers) {
        executeTournamentPipeline();
    }
}

function executeTournamentPipeline() {
    const teams = Object.keys(gameRosters);
    tournamentFixtures = teams.flatMap((team, index) => teams.slice(index + 1).map(opponent => ({ team1Name: team, team2Name: opponent })));
    tournamentResults = [];
    runTournamentFixture(0);
}

function runTournamentFixture(index) {
    if (index >= tournamentFixtures.length) {
        const lastMatch = tournamentResults[tournamentResults.length - 1];
        const payload = { ...lastMatch, tournamentResults };
        hostConnections.forEach(conn => conn.send({ type: 'SHOW_TOURNAMENT_RESULTS', payload }));
        renderMatchResults(payload);
        return;
    }

    const fixture = tournamentFixtures[index];
    const matchPayload = runMatchSimulationEngine(fixture.team1Name, fixture.team2Name);
    const timeline = buildMatchTimeline(matchPayload);
    matchPayload.commentary = timeline;
    const lineups = {
        [fixture.team1Name]: matchPayload.team1Stats.players,
        [fixture.team2Name]: matchPayload.team2Stats.players
    };
    const teamColours = {
        [fixture.team1Name]: gameRosters[fixture.team1Name]?.teamColour || '#4cc9f0',
        [fixture.team2Name]: gameRosters[fixture.team2Name]?.teamColour || '#f72585'
    };
    const startMessage = { type: 'START_MATCH', fixture, fixtureIndex: index, totalFixtures: tournamentFixtures.length, lineups, teamColours };
    hostConnections.forEach(conn => conn.send(startMessage));
    showLoadingScreen(fixture, index, tournamentFixtures.length, lineups, teamColours);

    let timelineIndex = 0;
    clearInterval(liveCommentaryInterval);
    liveCommentaryInterval = setInterval(() => {
        const event = timeline[timelineIndex++];
        if (event) {
            hostConnections.forEach(conn => conn.send({ type: 'COMMENTARY_EVENT', event }));
            appendCommentaryEvent(event);
            return;
        }

        clearInterval(liveCommentaryInterval);
        tournamentResults.push(matchPayload);
        hostConnections.forEach(conn => conn.send({ type: 'MATCH_FINISHED', results: tournamentResults, currentMatch: matchPayload }));
        updateTournamentView(tournamentResults, matchPayload);
        setTimeout(() => runTournamentFixture(index + 1), 1200);
    }, LIVE_EVENT_INTERVAL_MS);
}

function showLoadingScreen(fixture, fixtureIndex = 0, totalFixtures = 1, lineups = {}, teamColours = {}) {
    document.getElementById('transfer-phase').style.display = 'none';
    document.getElementById('tactics-phase').style.display = 'none';
    document.getElementById('loading-phase').style.display = 'block';
    document.getElementById('match-results-phase').style.display = 'none';
    document.getElementById('loading-countdown').innerText = `Match ${fixtureIndex + 1} of ${totalFixtures}: ${fixture.team1Name} vs ${fixture.team2Name}`;
    document.getElementById('live-match-score').innerText = `0' — ${fixture.team1Name} 0 - 0 ${fixture.team2Name}`;
    document.getElementById('commentary-feed').innerHTML = '';
    renderLivePitch(fixture, lineups, teamColours);
}

function appendCommentaryEvent(event, feedId = 'commentary-feed') {
    const feed = document.getElementById(feedId);
    const line = document.createElement('div');
    line.className = `commentary-line ${event.kind || ''}`;
    const minute = document.createElement('strong');
    minute.innerText = `${event.minute}'`;
    line.append(minute, document.createTextNode(event.text));
    feed.appendChild(line);
    feed.scrollTop = feed.scrollHeight;
    if (event.score) document.getElementById('live-match-score').innerText = `${event.minute}' — ${event.score}`;
    if (feedId === 'commentary-feed') animateLivePitchEvent(event);
}

function renderLivePitch(fixture, lineups, teamColours) {
    const playerLayer = document.getElementById('live-pitch-players');
    const ball = document.getElementById('live-ball');
    if (!playerLayer || !ball) return;
    playerLayer.innerHTML = '';
    livePitchState = { possessionTeam: null, ballX: 50, ballY: 50 };
    ball.style.left = '50%';
    ball.style.top = '50%';

    const teams = [fixture.team1Name, fixture.team2Name];
    teams.forEach((teamName, teamIndex) => {
        const players = lineups[teamName] || [];
        const groupTotals = players.reduce((totals, player) => {
            const group = POSITION_GROUPS[player.pos] || 'MID';
            totals[group] = (totals[group] || 0) + 1;
            return totals;
        }, {});
        const groupIndexes = {};
        players.forEach(player => {
            const group = POSITION_GROUPS[player.pos] || 'MID';
            groupIndexes[group] = (groupIndexes[group] || 0) + 1;
            const coordinate = getPitchCoordinate(group, groupIndexes[group], groupTotals[group], teamIndex === 0);
            const marker = document.createElement('div');
            marker.className = 'pitch-player';
            marker.dataset.player = player.name;
            marker.dataset.team = teamName;
            marker.dataset.side = teamIndex === 0 ? 'home' : 'away';
            marker.style.setProperty('--team-colour', teamColours[teamName] || '#4cc9f0');
            marker.style.left = `${coordinate.x}%`;
            marker.style.top = `${coordinate.y}%`;
            marker.dataset.homeX = coordinate.x;
            marker.dataset.homeY = coordinate.y;
            marker.innerHTML = `<img src="photocards/${player.name}PhotoCard.png" alt="${player.name}" onerror="this.onerror=null;this.src='https://placehold.co/64x64/1e293b/ffffff?text=${encodeURIComponent(player.name.charAt(0))}';"><span>${player.name}</span>`;
            playerLayer.appendChild(marker);
        });
    });
}

function getPitchCoordinate(group, index, totalInGroup, isHome) {
    const homeColumns = { GK: 8, DEF: 25, MID: 45, ATT: 67 };
    const baseX = homeColumns[group] || 45;
    const x = isHome ? baseX : 100 - baseX;
    const y = 16 + ((index / (totalInGroup + 1)) * 68);
    return { x, y };
}

function animateLivePitchEvent(event) {
    if (!event?.actor || !event.team) return;
    const markers = Array.from(document.querySelectorAll('.pitch-player'));
    const actor = markers.find(marker => marker.dataset.player === event.actor && marker.dataset.team === event.team);
    if (!actor) return;

    markers.forEach(marker => marker.classList.remove('is-active'));
    actor.classList.add('is-active');
    const isHome = actor.dataset.side === 'home';
    const direction = isHome ? 1 : -1;
    const currentX = parseFloat(actor.style.left) || 50;
    const currentY = parseFloat(actor.style.top) || 50;
    const teamChanged = livePitchState.possessionTeam && livePitchState.possessionTeam !== event.team;
    const movementByKind = {
        pass: 7,
        shot: 10,
        'set-piece': 6,
        goal: 14,
        foul: 4,
        interception: 3,
        card: 2
    };
    const actorStep = movementByKind[event.kind] ?? 4;
    const actorTargetX = event.kind === 'goal'
        ? (isHome ? 86 : 14)
        : clampNumber(currentX + direction * actorStep, 6, 94);
    const actorTargetY = clampNumber(currentY + (Math.random() * 12 - 6), 11, 89);
    actor.style.left = `${actorTargetX}%`;
    actor.style.top = `${actorTargetY}%`;

    let targetX = actorTargetX;
    let targetY = actorTargetY;
    if (event.kind === 'shot') {
        targetX = clampNumber(actorTargetX + direction * 12, 6, 94);
        targetY = clampNumber(actorTargetY + (Math.random() * 8 - 4), 18, 82);
    } else if (event.kind === 'goal') {
        targetX = isHome ? 94 : 6;
        targetY = 50;
    } else if (event.kind === 'pass' && !teamChanged) {
        const teammate = findNearbyTeammate(markers, actor, direction);
        if (teammate) {
            targetX = parseFloat(teammate.style.left) || actorTargetX;
            targetY = parseFloat(teammate.style.top) || actorTargetY;
        } else {
            targetX = clampNumber(actorTargetX + direction * 9, 6, 94);
        }
    }
    if (teamChanged && !['shot', 'goal'].includes(event.kind)) {
        targetX = actorTargetX;
        targetY = actorTargetY;
    }
    targetX = limitMovement(livePitchState.ballX, targetX, event.kind === 'goal' ? 28 : 18);
    targetY = limitMovement(livePitchState.ballY, targetY, event.kind === 'goal' ? 22 : 14);

    markers.filter(marker => marker !== actor).forEach(marker => {
        const sameTeam = marker.dataset.team === event.team;
        const markerX = parseFloat(marker.style.left) || 50;
        const markerY = parseFloat(marker.style.top) || 50;
        const homeX = parseFloat(marker.dataset.homeX) || markerX;
        const homeY = parseFloat(marker.dataset.homeY) || markerY;
        const shapeX = limitMovement(markerX, homeX, 4);
        const shapeY = limitMovement(markerY, homeY, 4);
        const supportShift = sameTeam ? direction * 2.5 : direction * -1.8;
        marker.style.left = `${clampNumber(shapeX + supportShift, 4, 96)}%`;
        marker.style.top = `${clampNumber(shapeY + (Math.random() * 4 - 2), 9, 91)}%`;
    });

    const ball = document.getElementById('live-ball');
    if (ball) {
        ball.style.left = `${targetX}%`;
        ball.style.top = `${targetY}%`;
    }
    livePitchState = { possessionTeam: event.team, ballX: targetX, ballY: targetY };
}

function findNearbyTeammate(markers, actor, direction) {
    const actorX = parseFloat(actor.style.left) || 50;
    const actorY = parseFloat(actor.style.top) || 50;
    return markers
        .filter(marker => marker !== actor && marker.dataset.team === actor.dataset.team)
        .map(marker => {
            const x = parseFloat(marker.style.left) || 50;
            const y = parseFloat(marker.style.top) || 50;
            const isForward = direction > 0 ? x >= actorX - 3 : x <= actorX + 3;
            const distance = Math.abs(x - actorX) + Math.abs(y - actorY);
            return { marker, score: distance + (isForward ? 0 : 18) };
        })
        .sort((first, second) => first.score - second.score)[0]?.marker;
}

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function limitMovement(from, to, maxStep) {
    if (Math.abs(to - from) <= maxStep) return to;
    return from + Math.sign(to - from) * maxStep;
}

function renderFinalCommentary(match) {
    const feed = document.getElementById('final-commentary-feed');
    feed.innerHTML = '';
    (match?.commentary || []).forEach(event => appendCommentaryEvent(event, 'final-commentary-feed'));
}

function calculateTeamMetrics(teamName, tacticsMap) {
    const squadNames = gameRosters[teamName] ? gameRosters[teamName].squad : ["Dummy1", "Dummy2", "Dummy3", "Dummy4", "Dummy5"];
    const cardEffects = getPowerCardEffects(teamName);
    let totalPace = 0, totalShooting = 0, totalPassing = 0, totalDribbling = 0, totalDefence = 0, totalPhysical = 0;
    const squadSize = squadNames.length;
    // A missing player is a real competitive disadvantage: shape, work rate and cover all suffer.
    const squadFactor = 0.76 + (0.24 * Math.min(squadSize, MAX_SQUAD_SIZE) / MAX_SQUAD_SIZE);
    const playersInfo = [];
    const assigned = squadNames.map(name => ({
        name,
        player: playersData.find(item => item.name === name) || { name, overall: 50, pace: 50, shooting: 50, passing: 50, dribbling: 50, defence: 50, physical: 50, positions: [], chemistryWith: [] },
        pos: tacticsMap?.[name] || "CM"
    }));
    const groups = assigned.map(item => POSITION_GROUPS[item.pos]).filter(Boolean);
    const has = group => groups.includes(group);
    const structureScore = (has("GK") ? 0.25 : 0) + (has("DEF") ? 0.25 : 0) + (has("MID") ? 0.25 : 0) + (has("ATT") ? 0.25 : 0);
    const formationBonus = (squadSize >= 4 ? structureScore * 0.05 : structureScore * 0.02) + (cardEffects.formationBonus || 0);
    const chemistryPairs = assigned.reduce((total, item, index) => total + assigned.slice(index + 1).filter(other => item.player.chemistryWith?.includes(other.name) || other.player.chemistryWith?.includes(item.name)).length, 0);
    const possiblePairs = Math.max(1, (squadSize * (squadSize - 1)) / 2);
    const chemistryScore = chemistryPairs / possiblePairs;
    const chemistryBonus = (chemistryScore * 0.04) + (cardEffects.chemistryBonus || 0);
    const formation = `${groups.filter(group => group === "GK").length}-${groups.filter(group => group === "DEF").length}-${groups.filter(group => group === "MID").length}-${groups.filter(group => group === "ATT").length}`;
    let totalAdjustedRating = 0;

    assigned.forEach(({ name, player: p, pos: assignedPos }) => {
        const isPreferred = p.positions?.includes(assignedPos);
        const positionModifier = isPreferred ? 1 : Math.min(1, p.positions?.some(pos => POSITION_GROUPS[pos] === POSITION_GROUPS[assignedPos]) ? 0.92 + (cardEffects.positionRecovery || 0) : 0.78 + (cardEffects.positionRecovery || 0));
        const adjustedModifier = positionModifier * squadFactor * (1 + formationBonus + chemistryBonus * 0.35);

        totalPace += p.pace * adjustedModifier;
        totalShooting += p.shooting * adjustedModifier;
        totalPassing += p.passing * adjustedModifier;
        totalDribbling += p.dribbling * adjustedModifier;
        totalDefence += p.defence * adjustedModifier;
        totalPhysical += p.physical * adjustedModifier;

        const baseOverall = p.overall ?? Math.round((p.pace + p.shooting + p.passing + p.dribbling + p.defence + p.physical) / 6);
        const adjustedRating = clampOverall(baseOverall * adjustedModifier, MAX_BASE_MATCH_OVR);
        totalAdjustedRating += adjustedRating;

        playersInfo.push({
            name,
            pos: assignedPos,
            baseOverall,
            rating: adjustedRating,
            positionFit: isPreferred ? "Natural" : "Out of position",
            chemistryWith: p.chemistryWith || []
        });
    });

    const count = Math.max(1, squadNames.length);
    const squadRatio = Math.min(squadSize, MAX_SQUAD_SIZE) / MAX_SQUAD_SIZE;
    // A small squad cannot sustain the same attacking, passing or defensive workload
    // as a full side, even when its average player quality is high.
    const activityFactor = 0.30 + (0.70 * squadRatio);
    const controlFactor = 0.28 + (0.72 * squadRatio);
    const avgPace = totalPace / count;
    const avgShooting = totalShooting / count;
    const avgPassing = totalPassing / count;
    const avgDribbling = totalDribbling / count;
    const avgDefence = totalDefence / count;
    const avgPhysical = totalPhysical / count;

    // High variance calculation factors
    const noise = () => (Math.random() * 0.1) + 0.95; // Random multiplier between 0.95 and 1.05
    
    const attackQuality = (avgShooting * 0.55) + (avgDribbling * 0.20) + (avgPassing * 0.25);
    const averageRating = totalAdjustedRating / count;
    const teamCoverageRating = 0.52 + (0.48 * squadRatio);
    const rating = squadSize ? clampOverall(averageRating * teamCoverageRating * (1 + formationBonus + chemistryBonus * 0.35)) : 0;
    const xG = squadSize ? parseFloat(Math.max(0.08, ((attackQuality / 65) * (0.55 + (0.45 * squadFactor)) * activityFactor * (1 + formationBonus + chemistryBonus) * (1 + (cardEffects.xgBonus || 0)) * noise())).toFixed(2)) : 0;
    const controlPower = ((avgPassing * 1.5) + (avgDribbling * 1.2) + (avgPace * 0.5)) * controlFactor * (1 + (cardEffects.controlBonus || 0));
    const chances = squadSize ? Math.max(1, Math.round((((avgPassing * 0.25) + (avgDribbling * 0.2)) * activityFactor) * noise())) : 0;
    const passes = squadSize ? Math.max(45, Math.round((((avgPassing * 7.5) + (avgPace * 2.0)) * activityFactor) * noise())) : 0;
    const tackles = squadSize ? Math.max(3, Math.round((((avgDefence * 0.45) + (avgPhysical * 0.35)) * activityFactor * (1 + (cardEffects.tackleBonus || 0))) * noise())) : 0;

    const hasGoalkeeper = has("GK");
    const goalkeeperFactor = hasGoalkeeper ? 1 : 0.56 + (cardEffects.noGoalkeeperCover || 0);
    const defensiveSecurity = avgDefence * squadFactor * goalkeeperFactor * (0.92 + (structureScore * 0.08)) * (1 + (cardEffects.defenceBonus || 0));

    return { rating, xG, chances, passes, tackles, controlPower, defensiveSecurity, hasGoalkeeper, goalkeeperFactor, powerCard: getPowerCard(teamName), players: playersInfo, squadSize, squadFactor, squadRatio, activityFactor, formationBonus, chemistryBonus, chemistryPairs, structureScore, formation };
}

function runMatchSimulationEngine(team1Name, team2Name) {

    const team1Stats = calculateTeamMetrics(team1Name, lockedTactics[team1Name]);
    const team2Stats = calculateTeamMetrics(team2Name, lockedTactics[team2Name]);

    // Exact 100% Possession Distribution
    const totalControl = team1Stats.controlPower + team2Stats.controlPower;
    team1Stats.possession = totalControl > 0
        ? Math.min(82, Math.max(18, Math.round((team1Stats.controlPower / totalControl) * 100)))
        : 50;
    team2Stats.possession = 100 - team1Stats.possession;

    // --- FAIRNESS ALGORITHM ---
    // Boost xG based on team OVR difference to ensure better teams create more chances
    const ratingDiff = team1Stats.rating - team2Stats.rating;
    if (ratingDiff > 5) {
        team1Stats.xG = team1Stats.squadSize ? parseFloat((team1Stats.xG + (ratingDiff * 0.1)).toFixed(2)) : 0;
        team2Stats.xG = team2Stats.squadSize ? Math.max(0.1, parseFloat((team2Stats.xG - (ratingDiff * 0.05)).toFixed(2))) : 0;
    } else if (ratingDiff < -5) {
        team2Stats.xG = team2Stats.squadSize ? parseFloat((team2Stats.xG + (Math.abs(ratingDiff) * 0.1)).toFixed(2)) : 0;
        team1Stats.xG = team1Stats.squadSize ? Math.max(0.1, parseFloat((team1Stats.xG - (Math.abs(ratingDiff) * 0.05)).toFixed(2))) : 0;
    }

    team1Stats.xG = applyDefensivePressureToXg(team1Stats.xG, team2Stats.defensiveSecurity, team2Stats.hasGoalkeeper);
    team2Stats.xG = applyDefensivePressureToXg(team2Stats.xG, team1Stats.defensiveSecurity, team1Stats.hasGoalkeeper);

    // --- PLAYER FORM ---
    let allPlayers = [...team1Stats.players, ...team2Stats.players];

    allPlayers.forEach(p => {
        // Small match-to-match swing; base quality remains the dominant signal.
        const formSwing = Math.floor(Math.random() * 14) - 5;
        p.matchRating = clampOverall(p.rating + formSwing, MAX_BASE_MATCH_OVR);
        p.formSwing = formSwing;
        p.goals = 0;
        p.assists = 0;
        p.motmScore = p.matchRating;
    });

    // Goals Simulation
    let team1Goals = simulateGoals(team1Stats.xG);
    let team2Goals = simulateGoals(team2Stats.xG);

    // Generate Scorer Events
    const goalEvents = [];
    const shotTypes = ["Power Shot", "Finesse Shot", "Header", "Tap-in", "Volley", "Long Range Screamer"];

    generateGoalEvents(team1Name, team1Goals, team1Stats.players, goalEvents, shotTypes);
    generateGoalEvents(team2Name, team2Goals, team2Stats.players, goalEvents, shotTypes);

    goalEvents.sort((a, b) => a.minute - b.minute);
    reconcileMatchContributions(team1Stats.players, team1Name, goalEvents);
    reconcileMatchContributions(team2Stats.players, team2Name, goalEvents);
    const motm = determineManOfTheMatch({
        team1Name,
        team2Name,
        team1Goals,
        team2Goals,
        team1Stats,
        team2Stats
    });

    return {
        team1Name, team2Name,
        team1Goals, team2Goals,
        team1Stats, team2Stats,
        goalEvents,
        motm
    };
}

function buildMatchTimeline(match) {
    const randomPlayer = (teamStats, preferredGroup) => {
        const matching = teamStats.players.filter(player => !preferredGroup || POSITION_GROUPS[player.pos] === preferredGroup);
        const pool = matching.length ? matching : teamStats.players;
        return pool[Math.floor(Math.random() * pool.length)] || { name: 'A player', pos: 'CM' };
    };
    const side = () => Math.random() < 0.5
        ? { name: match.team1Name, stats: match.team1Stats }
        : { name: match.team2Name, stats: match.team2Stats };
    const standardMinutes = [1, 5, 9, 15, 21, 28, 34, 41, 48, 55, 62, 69, 75, 82, 87];
    const eventFactories = [
        selected => {
            const actor = randomPlayer(selected.stats, 'MID');
            return { kind: 'pass', team: selected.name, actor: actor.name, text: `${actor.name} keeps the move flowing with a sharp pass for ${selected.name}.` };
        },
        selected => {
            const actor = randomPlayer(selected.stats, 'DEF');
            return { kind: 'interception', team: selected.name, actor: actor.name, text: `${actor.name} makes a crucial interception for ${selected.name}!` };
        },
        selected => {
            const actor = randomPlayer(selected.stats);
            return { kind: 'foul', team: selected.name, actor: actor.name, text: `${actor.name} is fouled as ${selected.name} try to break forward.` };
        },
        selected => {
            const actor = randomPlayer(selected.stats, 'MID');
            return { kind: 'set-piece', team: selected.name, actor: actor.name, text: `${selected.name} have a free kick; ${actor.name} bends it narrowly over.` };
        },
        selected => {
            const actor = randomPlayer(selected.stats, 'ATT');
            return { kind: 'shot', team: selected.name, actor: actor.name, text: `${actor.name} gets a shot away for ${selected.name}, but it is saved.` };
        },
        selected => {
            const actor = randomPlayer(selected.stats, 'ATT');
            return { kind: 'set-piece', team: selected.name, actor: actor.name, text: `Penalty appeal for ${selected.name}! ${actor.name} goes down under a strong challenge.` };
        },
        selected => {
            const actor = randomPlayer(selected.stats, 'DEF');
            return { kind: 'interception', team: selected.name, actor: actor.name, text: `${actor.name} wins the ball back cleanly for ${selected.name}.` };
        }
    ];
    const timeline = standardMinutes.map((minute, index) => {
        const selected = side();
        const event = eventFactories[index % eventFactories.length](selected);
        if (index === 2) event.kind = 'card';
        return { minute, ...event };
    });

    let score1 = 0;
    let score2 = 0;
    match.goalEvents.forEach(goal => {
        if (goal.team === match.team1Name) score1++;
        else score2++;
        const assistText = goal.assist ? ` Assist: ${goal.assist}.` : '';
        timeline.push({
            minute: goal.minute,
            kind: 'goal',
            team: goal.team,
            actor: goal.scorer,
            assist: goal.assist,
            text: `GOAL! ${goal.scorer} scores a ${goal.type.toLowerCase()} for ${goal.team}.${assistText}`,
            score: `${match.team1Name} ${score1} - ${score2} ${match.team2Name}`
        });
    });
    timeline.push({
        minute: 90,
        kind: 'full-time',
        text: `Full time: ${match.team1Name} ${match.team1Goals} - ${match.team2Goals} ${match.team2Name}.`,
        score: `${match.team1Name} ${match.team1Goals} - ${match.team2Goals} ${match.team2Name}`
    });
    return timeline.sort((first, second) => first.minute - second.minute || (first.kind === 'goal' ? 1 : -1));
}

function updateTournamentView(results, currentMatch) {
    tournamentResults = results;
    const summary = document.getElementById('live-match-score');
    if (summary && currentMatch) summary.innerText = `Full time — ${currentMatch.team1Name} ${currentMatch.team1Goals} - ${currentMatch.team2Goals} ${currentMatch.team2Name}`;
}

function simulateGoals(xg) {
    let goals = 0;
    let p = Math.exp(-xg);
    let g = p;
    let r = Math.random();

    while (r > g && goals < 10) {
        goals++;
        p = (p * xg) / goals;
        g += p;
    }
    return goals;
}

function generateGoalEvents(teamName, goalCount, players, goalEvents, shotTypes) {
    if (!players.length) return;
    const weightedPlayers = players.map(player => ({
        player,
        weight: Math.max(1, player.rating * (POSITION_GROUPS[player.pos] === "ATT" ? 1.45 : POSITION_GROUPS[player.pos] === "MID" ? 0.9 : 0.35))
    }));
    const totalWeight = weightedPlayers.reduce((sum, item) => sum + item.weight, 0);
    for (let i = 0; i < goalCount; i++) {
        const minute = Math.floor(Math.random() * 88) + 2;
        let roll = Math.random() * totalWeight;
        let selected = weightedPlayers[weightedPlayers.length - 1].player;
        for (const item of weightedPlayers) {
            roll -= item.weight;
            if (roll <= 0) {
                selected = item.player;
                break;
            }
        }
        selected.goals += 1;
        const assister = selectAssister(players, selected);
        if (assister) assister.assists += 1;

        const randomShot = shotTypes[Math.floor(Math.random() * shotTypes.length)];
        goalEvents.push({
            minute,
            team: teamName,
            scorer: selected.name,
            assist: assister?.name || null,
            type: randomShot
        });
    }
}

function reconcileMatchContributions(players, teamName, goalEvents) {
    const playersByName = new Map(players.map(player => [player.name, player]));
    players.forEach(player => {
        player.goals = 0;
        player.assists = 0;
    });
    goalEvents.filter(event => event.team === teamName).forEach(event => {
        const scorer = playersByName.get(event.scorer);
        const assister = event.assist ? playersByName.get(event.assist) : null;
        if (scorer) scorer.goals += 1;
        if (assister) assister.assists += 1;
    });
}

function applyDefensivePressureToXg(xg, opponentDefensiveSecurity, opponentHasGoalkeeper = true) {
    if (xg <= 0) return 0;
    const defensiveGap = 70 - opponentDefensiveSecurity;
    const goalkeeperModifier = opponentHasGoalkeeper ? 1 : 1.45;
    const concessionModifier = Math.min(1.75, Math.max(0.72, (1 + (defensiveGap / 140)) * goalkeeperModifier));
    return parseFloat(Math.max(0.1, xg * concessionModifier).toFixed(2));
}

function selectAssister(players, scorer) {
    const candidates = players.filter(player => player.name !== scorer.name);
    if (!candidates.length || Math.random() < 0.18) return null;

    const weightedPlayers = candidates.map(player => ({
        player,
        weight: Math.max(1, player.rating * (POSITION_GROUPS[player.pos] === "MID" ? 1.3 : POSITION_GROUPS[player.pos] === "ATT" ? 1.05 : 0.45) * (hasChemistry(player, scorer) ? 1.65 : 1))
    }));
    const totalWeight = weightedPlayers.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const item of weightedPlayers) {
        roll -= item.weight;
        if (roll <= 0) return item.player;
    }

    return weightedPlayers[weightedPlayers.length - 1].player;
}

function hasChemistry(player, teammate) {
    return player.chemistryWith?.includes(teammate.name) || teammate.chemistryWith?.includes(player.name);
}

function scaleFinalOverall(rawScore, baseOverall) {
    // Keep each player's base OVR as the anchor. Performance adds a diminishing bonus,
    // so a low-rated player cannot jump into the same band as an elite player by luck alone.
    const performanceDelta = rawScore - baseOverall;
    return Math.round(baseOverall + (14 * Math.tanh(performanceDelta / 42)));
}

function determineManOfTheMatch({ team1Name, team2Name, team1Goals, team2Goals, team1Stats, team2Stats }) {
    const allPlayers = [
        ...team1Stats.players.map(player => ({ player, teamName: team1Name, teamGoals: team1Goals, goalsAgainst: team2Goals })),
        ...team2Stats.players.map(player => ({ player, teamName: team2Name, teamGoals: team2Goals, goalsAgainst: team1Goals }))
    ];

    let motm = null;
    let highestScore = -Infinity;

    allPlayers.forEach(({ player, teamName, teamGoals, goalsAgainst }) => {
        const group = POSITION_GROUPS[player.pos];
        const resultBonus = teamGoals > goalsAgainst ? 3 : (teamGoals === goalsAgainst ? 1 : 0);
        const goalBonus = player.goals * 24;
        const assistBonus = player.assists * 14;
        const defensiveBonus = (group === "GK" || group === "DEF")
            ? Math.max(0, 7 - (goalsAgainst * 3))
            : Math.max(0, 2 - goalsAgainst);
        const midfieldBonus = group === "MID" ? Math.min(4, Math.round(player.rating / 25)) : 0;

        const rawMotmScore = player.matchRating + goalBonus + assistBonus + defensiveBonus + midfieldBonus + resultBonus;
        player.motmScore = rawMotmScore;
        player.finalOverall = scaleFinalOverall(rawMotmScore, player.baseOverall);

        if (rawMotmScore > highestScore) {
            highestScore = rawMotmScore;
            motm = {
                name: player.name,
                rating: player.finalOverall,
                score: player.finalOverall,
                team: teamName,
                goals: player.goals,
                assists: player.assists
            };
        }
    });

    return motm;
}

// --- 10. RENDER FINAL MATCH RESULTS ---
function renderMatchResults(payload) {
    document.getElementById('loading-phase').style.display = 'none';
    document.getElementById('match-results-phase').style.display = 'block';

    const results = payload.tournamentResults || [payload];
    tournamentResults = results;
    selectedTournamentMatchIndex = results.findIndex(match =>
        match === payload ||
        (match.team1Name === payload.team1Name &&
            match.team2Name === payload.team2Name &&
            match.team1Goals === payload.team1Goals &&
            match.team2Goals === payload.team2Goals)
    );
    if (selectedTournamentMatchIndex === -1) selectedTournamentMatchIndex = Math.max(0, results.length - 1);

    renderFixtureResults(results, selectedTournamentMatchIndex);
    renderSelectedMatchDetails(results[selectedTournamentMatchIndex] || payload);
}

function renderFixtureResults(results, selectedIndex = 0) {
    const fixtureResults = document.getElementById('fixture-results');
    fixtureResults.innerHTML = results.map((match, index) => `
        <button type="button" class="fixture-result ${index === selectedIndex ? 'active' : ''}" data-match-index="${index}" aria-pressed="${index === selectedIndex}">
            ${match.team1Name} <strong>${match.team1Goals} - ${match.team2Goals}</strong> ${match.team2Name}
        </button>
    `).join('');
}

function selectTournamentMatch(index) {
    const match = tournamentResults[index];
    if (!match) return;
    selectedTournamentMatchIndex = index;
    renderFixtureResults(tournamentResults, selectedTournamentMatchIndex);
    renderSelectedMatchDetails(match);
}

function renderSelectedMatchDetails(payload) {
    if (!payload) return;
    renderFinalCommentary(payload);

    const motmSummary = payload.motm ? `
        <div class="motm-summary">
            Man of the Match: <strong>${payload.motm.name} (${payload.motm.team})</strong>
            <span>
                ${payload.motm.rating} final OVR - ${payload.motm.goals}G ${payload.motm.assists}A
            </span>
        </div>` : '';
    document.getElementById('scoreboard-header').innerHTML = `
        ${payload.team1Name} ${payload.team1Goals} - ${payload.team2Goals} ${payload.team2Name}
        ${motmSummary}
    `;

    const goalContainer = document.getElementById('goalscorers-list');
    goalContainer.innerHTML = "";

    if (payload.goalEvents.length === 0) {
        goalContainer.innerHTML = "<div class='goal-item'>No goals scored in this match.</div>";
    } else {
        payload.goalEvents.forEach(evt => {
            goalContainer.innerHTML += `
                <div class="goal-item">
                    ⚽ <strong>${evt.minute}'</strong> ${evt.scorer} (${evt.team})${evt.assist ? `, assist ${evt.assist}` : ''} - <em>${evt.type}</em>
                </div>
            `;
        });
    }

    const renderSquadHtml = (players, motm) => {
        return players.map(p => {
            // Determine colors and + / - signs for the UI
            const sign = p.formSwing > 0 ? '+' : '';
            const color = p.formSwing > 0 ? '#4ade80' : (p.formSwing < 0 ? '#f87171' : '#cbd5e1');
            const motmBadge = p.name === motm?.name ? '<span style="color:#ffd166; font-size:0.82em; margin-left: 5px;">MOTM</span>' : '';
            
            return `<li>
                ${p.name} <strong>(${p.pos})</strong> - ${p.finalOverall} OVR 
                <span style="color:${color}; font-size:0.85em; margin-left: 5px;">(${sign}${p.formSwing})</span>
                <span style="color:#94a3b8; font-size:0.82em; margin-left: 5px;">${p.goals}G ${p.assists}A</span>
                ${motmBadge}
            </li>`;
        }).join('');
    };

    // Render Team 1 Stats & Squad
    document.getElementById('team1-stats-col').innerHTML = `
        <h3><i class="team-colour-dot" style="background:${gameRosters[payload.team1Name]?.teamColour || '#4cc9f0'}"></i>${payload.team1Name}</h3>
        <div>Rating: <strong>${payload.team1Stats.rating} OVR</strong></div>
        <div>Squad: <strong>${payload.team1Stats.squadSize}/${MAX_SQUAD_SIZE}</strong> · Formation: <strong>${payload.team1Stats.formation}</strong></div>
        <div>Chemistry links: <strong>${payload.team1Stats.chemistryPairs}</strong> · Structure: <strong>${Math.round(payload.team1Stats.structureScore * 100)}%</strong></div>
        <div>Possession: <strong>${payload.team1Stats.possession}%</strong></div>
        <div>xG: <strong>${payload.team1Stats.xG}</strong></div>
        <div>Chances: <strong>${payload.team1Stats.chances}</strong></div>
        <div>Passes: <strong>${payload.team1Stats.passes}</strong></div>
        <div>Tackles: <strong>${payload.team1Stats.tackles}</strong></div>
        <h4 style="margin-top:12px; color:#4cc9f0; border-top:1px solid #334155; padding-top:6px;">Squad</h4>
        <ul style="list-style:none; font-size:0.85rem; color:#cbd5e1;">${renderSquadHtml(payload.team1Stats.players, payload.motm)}</ul>
    `;

    // Render Team 2 Stats & Squad
    document.getElementById('team2-stats-col').innerHTML = `
        <h3><i class="team-colour-dot" style="background:${gameRosters[payload.team2Name]?.teamColour || '#4cc9f0'}"></i>${payload.team2Name}</h3>
        <div>Rating: <strong>${payload.team2Stats.rating} OVR</strong></div>
        <div>Squad: <strong>${payload.team2Stats.squadSize}/${MAX_SQUAD_SIZE}</strong> · Formation: <strong>${payload.team2Stats.formation}</strong></div>
        <div>Chemistry links: <strong>${payload.team2Stats.chemistryPairs}</strong> · Structure: <strong>${Math.round(payload.team2Stats.structureScore * 100)}%</strong></div>
        <div>Possession: <strong>${payload.team2Stats.possession}%</strong></div>
        <div>xG: <strong>${payload.team2Stats.xG}</strong></div>
        <div>Chances: <strong>${payload.team2Stats.chances}</strong></div>
        <div>Passes: <strong>${payload.team2Stats.passes}</strong></div>
        <div>Tackles: <strong>${payload.team2Stats.tackles}</strong></div>
        <h4 style="margin-top:12px; color:#4cc9f0; border-top:1px solid #334155; padding-top:6px;">Squad</h4>
        <ul style="list-style:none; font-size:0.85rem; color:#cbd5e1;">${renderSquadHtml(payload.team2Stats.players, payload.motm)}</ul>
    `;
}

document.getElementById('fixture-results').addEventListener('click', event => {
    const resultButton = event.target.closest('.fixture-result');
    if (!resultButton) return;
    selectTournamentMatch(Number(resultButton.dataset.matchIndex));
});

// --- 11. BIDDING CONTROLS ---
function attemptBid(addedAmount) {
    const proposedBid = currentBid + addedAmount;
    const myBudget = parseInt(document.getElementById('my-budget').innerText);
    
    if (proposedBid > myBudget) {
        showCustomAlert("You don't have enough budget!");
        return;
    }

    if (isHost) {
        processBid(proposedBid, myName);
    } else {
        connectionToHost.send({ type: 'BID', amount: proposedBid, playerName: myName });
    }
}

function showCustomAlert(message) {
    const alertBox = document.getElementById('alert-box');
    alertBox.innerText = message;
    alertBox.classList.add('show');
    setTimeout(() => { alertBox.classList.remove('show'); }, 2500);
}

document.getElementById('bid1mil').addEventListener('click', () => attemptBid(1));
document.getElementById('bid5mil').addEventListener('click', () => attemptBid(5));
document.getElementById('bid10mil').addEventListener('click', () => attemptBid(10));
document.getElementById('bid25mil').addEventListener('click', () => attemptBid(25));

document.getElementById('trade-team-select').addEventListener('change', () => {
    updateTradeTargetOptions();
    updateTradePreview();
});
document.getElementById('trade-my-player-select').addEventListener('change', updateTradePreview);
document.getElementById('trade-their-player-select').addEventListener('change', updateTradePreview);
document.getElementById('offer-trade-btn').addEventListener('click', () => {
    const myPlayer = document.getElementById('trade-my-player-select').value;
    const targetTeam = document.getElementById('trade-team-select').value;
    const theirPlayer = document.getElementById('trade-their-player-select').value;
    if (!myPlayer || !targetTeam || !theirPlayer) {
        showCustomAlert('Choose both players before sending a trade offer.');
        return;
    }
    const offer = { name: myName, targetTeam, myPlayer, theirPlayer };
    if (isHost) createTradeOffer(offer);
    else connectionToHost.send({ type: 'OFFER_TRADE', ...offer });
});
document.getElementById('close-market-btn').addEventListener('click', () => {
    if (isHost) markReadyForTactics(myName);
    else connectionToHost.send({ type: 'READY_FOR_TACTICS', name: myName });
});

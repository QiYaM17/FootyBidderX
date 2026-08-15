// --- 1. STATE VARIABLES ---
let peer = null;
let connectionToHost = null;
let hostConnections = []; 
let isHost = false;
let myName = "";

// Host-managed state
let availablePlayers = [...playersData];
let gameRosters = {}; 
let currentCard = null;
let currentBid = 0;
let highestBidder = "None";
let bidTimerInterval;
let timeLeft = 3;
const INITIAL_TIMER = 3;
const POST_BID_TIMER = 3;
const STARTING_BUDGET = 500;
const MAX_SQUAD_SIZE = 5;
const POSITION_GROUPS = {
    GK: "GK", CB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF",
    CDM: "MID", CM: "MID", CAM: "MID", LM: "MID", RM: "MID",
    LW: "ATT", RW: "ATT", ST: "ATT"
};

// Tactics & Simulation State
let tacticsTimerInterval;
let tacticsTimeLeft = 15;
let lockedTactics = {};
let hasSubmittedTactics = false;

// --- 2. DOM ELEMENTS ---
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const usernameInput = document.getElementById('username');

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

// --- 4. HOST MULTIPLAYER LOGIC ---
function setupHost() {
    isHost = true;
    const randomCode = Math.floor(10000 + Math.random() * 90000).toString();
    document.getElementById('lobbyCode').innerText = randomCode;
    
    gameRosters[myName] = { money: STARTING_BUDGET, squad: [] };

    peer = new Peer("footy-" + randomCode); 
    peer.on('open', () => {
        document.getElementById('startGameBtn').style.display = 'block';
    });

    peer.on('connection', (conn) => {
        hostConnections.push(conn);
        document.getElementById('player-count').innerText = `Players in lobby: ${hostConnections.length + 1}`;
        
        conn.on('data', (data) => {
            if (data.type === 'JOIN') {
                gameRosters[data.name] = { money: STARTING_BUDGET, squad: [] };
            } else if (data.type === 'BID') {
                processBid(data.amount, data.playerName);
            } else if (data.type === 'SUBMIT_TACTICS') {
                handleClientTactics(data.name, data.tactics);
            }
        });
    });
}

document.getElementById('startGameBtn').addEventListener('click', () => {
    startNextRound();
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
            connectionToHost.send({ type: 'JOIN', name: myName });
        });

        connectionToHost.on('data', (data) => {
            if (data.type === 'UPDATE_STATE') {
                syncGameState(data.state);
            } else if (data.type === 'START_TACTICS') {
                initTacticsPhase(data.rosters);
            } else if (data.type === 'START_LOADING') {
                showLoadingScreen();
            } else if (data.type === 'SHOW_MATCH_RESULTS') {
                renderMatchResults(data.payload);
            }
        });
    });
});

// --- 6. GAME LOOP LOGIC (HOST ONLY) ---
function startNextRound() {
    if (availablePlayers.length === 0 || checkEndGameCondition()) {
        endGame();
        return;
    }

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
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
        timeLeft = POST_BID_TIMER;
        broadcastState();
    }
}

function startTimer() {
    clearInterval(bidTimerInterval);
    bidTimerInterval = setInterval(() => {
        timeLeft--;
        broadcastState();

        if (timeLeft <= 0) {
            clearInterval(bidTimerInterval);
            sellPlayer();
        }
    }, 1000);
}

function sellPlayer() {
    if (highestBidder !== "None" && gameRosters[highestBidder]) {
        gameRosters[highestBidder].money -= currentBid;
        gameRosters[highestBidder].squad.push(currentCard.name);
    }
    setTimeout(startNextRound, 2000);
}

function checkEndGameCondition() {
    return Object.values(gameRosters).every(roster => roster.squad.length >= MAX_SQUAD_SIZE);
}

function endGame() {
    clearInterval(bidTimerInterval);
    hostConnections.forEach(conn => conn.send({ type: 'START_TACTICS', rosters: gameRosters }));
    initTacticsPhase(gameRosters);
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
            <div class="team-block">
                <h4>${name} <span>${data.squad.length}/${MAX_SQUAD_SIZE} players · £${data.money}M</span></h4>
                <ul>${playersHtml || "<li>No players yet</li>"}</ul>
            </div>
        `;
    }
}

// --- 8. TACTICS PHASE ---
function initTacticsPhase(rosters) {
    gameRosters = rosters;
    gameScreen.style.display = 'none';
    endScreen.style.display = 'flex';
    document.getElementById('tactics-phase').style.display = 'block';

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
    tacticsTimeLeft = 15;
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
        showCustomAlert("Please assign all 5 positions!");
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
        executeMatchPipeline();
    }
}

function executeMatchPipeline() {
    hostConnections.forEach(conn => conn.send({ type: 'START_LOADING' }));
    showLoadingScreen();

    const matchPayload = runMatchSimulationEngine();

    setTimeout(() => {
        hostConnections.forEach(conn => conn.send({ type: 'SHOW_MATCH_RESULTS', payload: matchPayload }));
        renderMatchResults(matchPayload);
    }, 10000);
}

function showLoadingScreen() {
    document.getElementById('tactics-phase').style.display = 'none';
    document.getElementById('loading-phase').style.display = 'block';

    let loadTimer = 10;
    const loadInterval = setInterval(() => {
        loadTimer--;
        document.getElementById('loading-countdown').innerText = `Simulating Match... ${loadTimer}s`;
        if (loadTimer <= 0) clearInterval(loadInterval);
    }, 1000);
}

function calculateTeamMetrics(teamName, tacticsMap) {
    const squadNames = gameRosters[teamName] ? gameRosters[teamName].squad : ["Dummy1", "Dummy2", "Dummy3", "Dummy4", "Dummy5"];
    let totalPace = 0, totalShooting = 0, totalPassing = 0, totalDribbling = 0, totalDefence = 0, totalPhysical = 0;
    const squadSize = squadNames.length;
    // A missing player is a real competitive disadvantage: shape, work rate and cover all suffer.
    const squadFactor = 0.58 + (0.42 * Math.min(squadSize, MAX_SQUAD_SIZE) / MAX_SQUAD_SIZE);
    const playersInfo = [];
    const assigned = squadNames.map(name => ({
        name,
        player: playersData.find(item => item.name === name) || { name, overall: 50, pace: 50, shooting: 50, passing: 50, dribbling: 50, defence: 50, physical: 50, positions: [], chemistryWith: [] },
        pos: tacticsMap?.[name] || "CM"
    }));
    const groups = assigned.map(item => POSITION_GROUPS[item.pos]).filter(Boolean);
    const has = group => groups.includes(group);
    const structureScore = (has("GK") ? 0.25 : 0) + (has("DEF") ? 0.25 : 0) + (has("MID") ? 0.25 : 0) + (has("ATT") ? 0.25 : 0);
    const formationBonus = squadSize >= 4 ? structureScore * 0.10 : structureScore * 0.04;
    const chemistryPairs = assigned.reduce((total, item, index) => total + assigned.slice(index + 1).filter(other => item.player.chemistryWith?.includes(other.name) || other.player.chemistryWith?.includes(item.name)).length, 0);
    const possiblePairs = Math.max(1, (squadSize * (squadSize - 1)) / 2);
    const chemistryScore = chemistryPairs / possiblePairs;
    const chemistryBonus = chemistryScore * 0.10;
    const formation = `${groups.filter(group => group === "GK").length}-${groups.filter(group => group === "DEF").length}-${groups.filter(group => group === "MID").length}-${groups.filter(group => group === "ATT").length}`;
    let totalAdjustedRating = 0;

    assigned.forEach(({ name, player: p, pos: assignedPos }) => {
        const isPreferred = p.positions?.includes(assignedPos);
        const positionModifier = isPreferred ? 1 : (p.positions?.some(pos => POSITION_GROUPS[pos] === POSITION_GROUPS[assignedPos]) ? 0.92 : 0.78);
        const adjustedModifier = positionModifier * squadFactor * (1 + formationBonus + chemistryBonus * 0.65);

        totalPace += p.pace * adjustedModifier;
        totalShooting += p.shooting * adjustedModifier;
        totalPassing += p.passing * adjustedModifier;
        totalDribbling += p.dribbling * adjustedModifier;
        totalDefence += p.defence * adjustedModifier;
        totalPhysical += p.physical * adjustedModifier;

        const baseOverall = p.overall ?? Math.round((p.pace + p.shooting + p.passing + p.dribbling + p.defence + p.physical) / 6);
        const adjustedRating = Math.round(baseOverall * adjustedModifier);
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

    const count = squadNames.length || 5;
    const avgPace = totalPace / count;
    const avgShooting = totalShooting / count;
    const avgPassing = totalPassing / count;
    const avgDribbling = totalDribbling / count;
    const avgDefence = totalDefence / count;
    const avgPhysical = totalPhysical / count;

    // High variance calculation factors
    const noise = () => (Math.random() * 0.1) + 0.95; // Random multiplier between 0.95 and 1.05
    
    const attackQuality = (avgShooting * 0.55) + (avgDribbling * 0.20) + (avgPassing * 0.25);
    const rating = Math.round((totalAdjustedRating / count) * (1 + formationBonus + chemistryBonus));
    const xG = parseFloat(Math.max(0.12, ((attackQuality / 65) * (0.55 + (0.45 * squadFactor)) * (1 + formationBonus + chemistryBonus) * noise())).toFixed(2));
    const controlPower = (avgPassing * 1.5) + (avgDribbling * 1.2) + (avgPace * 0.5);
    const chances = Math.max(1, Math.round(((avgPassing * 0.25) + (avgDribbling * 0.2)) * noise()));
    const passes = Math.max(80, Math.round(((avgPassing * 7.5) + (avgPace * 2.0)) * noise()));
    const tackles = Math.max(5, Math.round(((avgDefence * 0.45) + (avgPhysical * 0.35)) * noise()));

    const defensiveSecurity = avgDefence * (0.82 + (squadFactor * 0.18)) * (0.92 + (structureScore * 0.08));

    return { rating, xG, chances, passes, tackles, controlPower, defensiveSecurity, players: playersInfo, squadSize, squadFactor, formationBonus, chemistryBonus, chemistryPairs, structureScore, formation };
}

function runMatchSimulationEngine() {
    const playerNames = Object.keys(gameRosters);
    const team1Name = playerNames[0];
    const team2Name = playerNames[1] || "Opposition AI";

    const team1Stats = calculateTeamMetrics(team1Name, lockedTactics[team1Name]);
    const team2Stats = calculateTeamMetrics(team2Name, lockedTactics[team2Name]);

    // Exact 100% Possession Distribution
    const totalControl = team1Stats.controlPower + team2Stats.controlPower;
    team1Stats.possession = totalControl > 0
        ? Math.min(78, Math.max(22, Math.round((team1Stats.controlPower / totalControl) * 100)))
        : 50;
    team2Stats.possession = 100 - team1Stats.possession;

    // --- FAIRNESS ALGORITHM ---
    // Boost xG based on team OVR difference to ensure better teams create more chances
    const ratingDiff = team1Stats.rating - team2Stats.rating;
    if (ratingDiff > 5) {
        team1Stats.xG = parseFloat((team1Stats.xG + (ratingDiff * 0.1)).toFixed(2));
        team2Stats.xG = Math.max(0.1, parseFloat((team2Stats.xG - (ratingDiff * 0.05)).toFixed(2)));
    } else if (ratingDiff < -5) {
        team2Stats.xG = parseFloat((team2Stats.xG + (Math.abs(ratingDiff) * 0.1)).toFixed(2));
        team1Stats.xG = Math.max(0.1, parseFloat((team1Stats.xG - (Math.abs(ratingDiff) * 0.05)).toFixed(2)));
    }

    team1Stats.xG = applyDefensivePressureToXg(team1Stats.xG, team2Stats.defensiveSecurity);
    team2Stats.xG = applyDefensivePressureToXg(team2Stats.xG, team1Stats.defensiveSecurity);

    // --- PLAYER FORM ---
    let allPlayers = [...team1Stats.players, ...team2Stats.players];

    allPlayers.forEach(p => {
        // Random performance form: Swings between -8 and +12 OVR
        const formSwing = Math.floor(Math.random() * 21) - 8; 
        p.matchRating = p.rating + formSwing;
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

function applyDefensivePressureToXg(xg, opponentDefensiveSecurity) {
    const defensiveGap = 70 - opponentDefensiveSecurity;
    const concessionModifier = Math.min(1.35, Math.max(0.82, 1 + (defensiveGap / 140)));
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
        const goalBonus = player.goals * (group === "ATT" ? 9 : group === "MID" ? 10 : 12);
        const assistBonus = player.assists * 5;
        const defensiveBonus = (group === "GK" || group === "DEF")
            ? Math.max(0, 7 - (goalsAgainst * 3))
            : Math.max(0, 2 - goalsAgainst);
        const midfieldBonus = group === "MID" ? Math.min(4, Math.round(player.rating / 25)) : 0;

        player.motmScore = Math.round(player.matchRating + goalBonus + assistBonus + defensiveBonus + midfieldBonus + resultBonus);
        player.finalOverall = player.motmScore;

        if (player.motmScore > highestScore) {
            highestScore = player.motmScore;
            motm = {
                name: player.name,
                rating: player.finalOverall,
                score: player.motmScore,
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

    document.getElementById('scoreboard-header').innerHTML = `
        ${payload.team1Name} ${payload.team1Goals} - ${payload.team2Goals} ${payload.team2Name}
        <div style="color: #ffd166; font-size: 1.1rem; margin-top: 15px; text-transform: uppercase;">
            ⭐ Man of the Match: <strong>${payload.motm.name} (${payload.motm.team})</strong>
            <span style="display:block; font-size:0.78rem; color:#cbd5e1; margin-top:4px;">
                ${payload.motm.rating} final OVR · ${payload.motm.goals}G ${payload.motm.assists}A
            </span>
        </div>
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
            const motmBadge = p.name === motm.name ? '<span style="color:#ffd166; font-size:0.82em; margin-left: 5px;">MOTM</span>' : '';
            
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
        <h3>${payload.team1Name}</h3>
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
        <h3>${payload.team2Name}</h3>
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

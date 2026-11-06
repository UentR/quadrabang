// src/lib/gameEngine.ts
import { db } from './firebase';
import { ref, set, get, update } from 'firebase/database';
import {
    ActionCardType,
    ActiveTaskPile,
    EventCard,
    GamePhase,
    MorningChoice,
    Player,
    Role,
    RoomState,
} from '../types/game';
import { PHASE_1_TASKS, PHASE_2_CRISES, PHASE_3_CLEANUP } from '../data/cards';

// Mélange générique (algorithme de Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Génère le paquet commun de 60 cartes (30 Work, 18 Chill, 12 Sabotage)
export function createActionDeck(): ActionCardType[] {
    const deck: ActionCardType[] = [
        ...Array(30).fill('WORK'),
        ...Array(18).fill('CHILL'),
        ...Array(12).fill('SABOTAGE'),
    ];
    return shuffle(deck);
}

// Répartition exacte des rôles selon le nombre de joueurs (hors Soubeyran)
export function getRoleDistribution(playerCount: number): Role[] {
    let board2A = 1;
    let slackers = 2;
    let spies = 1;

    if (playerCount < 8) {
        // Mode test rapide (4 à 7 joueurs)
        board2A = 1;
        slackers = 1;
        spies = 1;
    } else if (playerCount <= 9) {
        board2A = 1; slackers = 2; spies = 1;
    } else if (playerCount === 10) {
        board2A = 2; slackers = 2; spies = 1;
    } else if (playerCount === 11) {
        board2A = 2; slackers = 3; spies = 1;
    } else if (playerCount === 12) {
        board2A = 2; slackers = 2; spies = 2;
    } else if (playerCount <= 15) {
        board2A = 2; slackers = 3; spies = 2;
    } else if (playerCount === 16) {
        board2A = 3; slackers = 3; spies = 2;
    } else if (playerCount === 17) {
        board2A = 3; slackers = 4; spies = 2;
    } else {
        // 18 à 20 joueurs
        board2A = 3; slackers = 4; spies = 3;
    }

    const trueApplicants = Math.max(1, playerCount - (board2A + slackers + spies));

    const roles: Role[] = [
        ...Array(board2A).fill('BOARD_2A'),
        ...Array(trueApplicants).fill('TRUE_APPLICANT'),
        ...Array(slackers).fill('SLACKER'),
        ...Array(spies).fill('TELECOM_SPY'),
    ];

    return shuffle(roles);
}

// Calcul des 4 jauges de Soubeyran selon le nombre de joueurs
export function calculateInitialGauges(playerCount: number, slackerCount: number) {
    return {
        quadraPoints: Math.ceil(0.5 * playerCount),
        quadraTarget: 2 * playerCount,
        chillCounter: 0,
        chillTarget: Math.round(2.5 * slackerCount),
        morningStash: 0,
        morningTarget: Math.ceil(playerCount / 3),
        carpetProgress: 0,
        carpetTarget: Math.ceil(playerCount / 2),
        cleanupScore: 0,
    };
}

// Vérifie la règle d'obligation des Vrais Prétendants
export function canPlaySelection(
    role: Role,
    hand: ActionCardType[],
    selectedCards: ActionCardType[]
): { valid: boolean; reason?: string } {
    if (role === 'TRUE_APPLICANT') {
        const workInHand = hand.filter((c) => c === 'WORK').length;
        const workSelected = selectedCards.filter((c) => c === 'WORK').length;
        if (workInHand > 0 && workSelected === 0) {
            return {
                valid: false,
                reason: 'As a True Applicant, you MUST play a WORK card if you have one!',
            };
        }
    }
    return { valid: true };
}

// 1. Créer un salon (Le créateur devient Soubeyran)
export async function createRoom(hostId: string, hostName: string): Promise<string> {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    const initialRoom: RoomState = {
        roomCode,
        status: 'LOBBY',
        phase: 1,
        turn: 1,
        step: '1_DISPATCH',
        gauges: calculateInitialGauges(8, 2),
        deck: {
            drawPile: createActionDeck(),
            discardPile: [],
        },
        players: {
            [hostId]: {
                id: hostId,
                name: hostName,
                role: 'SOUBEYRAN',
                isExcluded: false,
                strikes: 0,
                assignedTaskId: null,
                hasTryhardBadge: false,
                hand: [],
                playedCards: [],
                hasSubmitted: false,
            },
        },
        activeTasks: {},
        carpetPlayedCards: [],
    };

    await set(ref(db, `rooms/${roomCode}`), initialRoom);
    return roomCode;
}

// 2. Rejoindre un salon
export async function joinRoom(roomCode: string, playerId: string, playerName: string) {
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
    const newPlayer: Player = {
        id: playerId,
        name: playerName,
        role: 'TRUE_APPLICANT', // Sera écrasé au lancement de la partie
        isExcluded: false,
        strikes: 0,
        assignedTaskId: null,
        hasTryhardBadge: false,
        hand: [],
        playedCards: [],
        hasSubmitted: false,
    };
    await set(playerRef, newPlayer);
}

// Tirer les cartes Événements du tour (1 par 2A actif)
function drawTurnTasks(phase: GamePhase, board2APlayers: Player[]): Record<string, ActiveTaskPile> {
    const pool: EventCard[] =
        phase === 1 ? PHASE_1_TASKS : phase === 2 ? PHASE_2_CRISES : PHASE_3_CLEANUP;
    const shuffledPool = shuffle(pool);
    const activeTasks: Record<string, ActiveTaskPile> = {};

    board2APlayers.forEach((p2A, index) => {
        const card = shuffledPool[index % shuffledPool.length];
        const taskId = `task_${p2A.id}`;
        activeTasks[taskId] = {
            taskId,
            board2APlayerId: p2A.id,
            cardDetails: card,
            assignedPlayerIds: [],
            rawSubmittedCards: [],
            morningChoice: null,
        };
    });

    return activeTasks;
}

// 3. Lancer la partie (Distribution des rôles et Tour 1)
export async function startGame(roomCode: string) {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    if (!snap.exists()) throw new Error('Room not found');
    const room: RoomState = snap.val();

    const allPlayers = Object.values(room.players);
    const nonGMPlayers = allPlayers.filter((p) => p.role !== 'SOUBEYRAN');
    const roles = getRoleDistribution(nonGMPlayers.length);

    let slackerCount = 0;
    const board2APlayers: Player[] = [];

    nonGMPlayers.forEach((player, idx) => {
        player.role = roles[idx];
        player.strikes = 0;
        player.isExcluded = false;
        player.assignedTaskId = null;
        player.hasTryhardBadge = false;
        if (player.role === 'SLACKER') slackerCount++;
        if (player.role === 'BOARD_2A') board2APlayers.push(player);
        room.players[player.id] = player;
    });

    room.gauges = calculateInitialGauges(nonGMPlayers.length, slackerCount);
    room.status = 'IN_PROGRESS';
    room.phase = 1;
    room.turn = 1;
    room.step = '1_DISPATCH';
    room.deck = { drawPile: createActionDeck(), discardPile: [] };
    room.activeTasks = drawTurnTasks(1, board2APlayers);
    room.carpetPlayedCards = [];

    await set(roomRef, room);
}

// 4. Étape 1 & 2 : Affecter un joueur à une tâche (ou Moquette) et donner le badge Tryhard
export async function assignPlayerAndBadge(
  roomCode: string,
  playerId: string,
  targetTaskId: string | 'CARPET' | null,
  giveTryhardBadge: boolean = false
) {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snap = await get(roomRef);
  const room: RoomState = snap.val();

  if (!room.players[playerId]) return;

  // 1. Retirer le joueur de toutes les tâches où il figurait précédemment
  Object.values(room.activeTasks || {}).forEach((t) => {
    t.assignedPlayerIds = (t.assignedPlayerIds || []).filter((id) => id !== playerId);
    room.activeTasks[t.taskId] = t;
  });

  // 2. Si on attribue le badge ⭐ sur une tâche, le retirer aux autres membres de CETTE tâche (1 badge max par 2A)
  if (giveTryhardBadge && targetTaskId && targetTaskId !== 'CARPET' && room.activeTasks?.[targetTaskId]) {
    const teamIds = room.activeTasks[targetTaskId].assignedPlayerIds || [];
    teamIds.forEach((id) => {
      if (room.players[id]) room.players[id].hasTryhardBadge = false;
    });
  }

  // 3. Mettre à jour le joueur
  room.players[playerId].assignedTaskId = targetTaskId;
  room.players[playerId].hasTryhardBadge =
    targetTaskId && targetTaskId !== 'CARPET' ? giveTryhardBadge : false;

  // 4. L'ajouter dans la nouvelle tâche choisie
  if (targetTaskId && targetTaskId !== 'CARPET' && room.activeTasks?.[targetTaskId]) {
    const currentList = room.activeTasks[targetTaskId].assignedPlayerIds || [];
    if (!currentList.includes(playerId)) {
      currentList.push(playerId);
    }
    room.activeTasks[targetTaskId].assignedPlayerIds = currentList;
  }

  await set(roomRef, room);
}

// 5. Étape 3 (The Grind) : Distribuer les cartes aux joueurs actifs (2 cartes, ou 3 si Tryhard)
export async function dealCardsForGrind(roomCode: string) {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    const room: RoomState = snap.val();

    let drawPile = room.deck?.drawPile || [];
    let discardPile = room.deck?.discardPile || [];

    Object.values(room.players).forEach((player) => {
        if (player.role !== 'SOUBEYRAN' && player.role !== 'BOARD_2A' && !player.isExcluded) {
            const cardsNeeded = player.hasTryhardBadge ? 3 : 2;
            if (drawPile.length < cardsNeeded) {
                drawPile = [...drawPile, ...shuffle(discardPile)];
                discardPile = [];
            }
            player.hand = drawPile.splice(0, cardsNeeded);
            player.playedCards = [];
            player.hasSubmitted = false;
            room.players[player.id] = player;
        }
    });

    room.deck = { drawPile, discardPile };
    room.step = '3_THE_GRIND';
    await set(roomRef, room);
}

// 6. Soumettre ses cartes Action (Joueurs)
export async function submitActionCards(
    roomCode: string,
    playerId: string,
    playedCards: ActionCardType[],
    discardedCard: ActionCardType
) {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    const room: RoomState = snap.val();
    const player = room.players[playerId];

    const check = canPlaySelection(player.role, player.hand || [], playedCards);
    if (!check.valid) throw new Error(check.reason);

    player.playedCards = playedCards;
    player.hand = [];
    player.hasSubmitted = true;

    // Ajout dans la défausse
    const discardPile = room.deck?.discardPile || [];
    discardPile.push(discardedCard);
    room.deck.discardPile = discardPile;

    // Ajout au tas de la tâche ou de la moquette
    if (player.assignedTaskId === 'CARPET') {
        const carpetCards = room.carpetPlayedCards || [];
        room.carpetPlayedCards = [...carpetCards, ...playedCards];
    } else if (player.assignedTaskId && room.activeTasks?.[player.assignedTaskId]) {
        const raw = room.activeTasks[player.assignedTaskId].rawSubmittedCards || [];
        room.activeTasks[player.assignedTaskId].rawSubmittedCards = [...raw, ...playedCards];
    }

    await set(roomRef, room);
}

// 7. Étape 4 (The Morning Cut) : Le 2A fait son choix secret
export async function submitMorningChoice(
    roomCode: string,
    taskId: string,
    choice: MorningChoice
) {
    await update(ref(db, `rooms/${roomCode}/activeTasks/${taskId}`), {
        morningChoice: choice,
    });
}

// 8. Étape 5 (Soubeyran's Audit) : Calcul automatique des tas, du Morning et des jauges
export async function executeSoubeyranAudit(roomCode: string) {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    const room: RoomState = snap.val();

    // 1. Résolution du chantier Moquette (Phase 1)
    const carpetCards = room.carpetPlayedCards || [];
    const carpetWork = carpetCards.filter((c) => c === 'WORK').length;
    const carpetSabotage = carpetCards.filter((c) => c === 'SABOTAGE').length;
    room.gauges.carpetProgress += Math.max(0, carpetWork - carpetSabotage);

    // 2. Résolution de chaque tâche de 2A
    Object.values(room.activeTasks || {}).forEach((task) => {
        const raw = task.rawSubmittedCards || [];
        let workCount = raw.filter((c) => c === 'WORK').length;
        let chillCount = raw.filter((c) => c === 'CHILL').length;
        const sabotageCount = raw.filter((c) => c === 'SABOTAGE').length;
        let morningStolen = false;

        // Mécanique Steal for Morning : convertit 1 Work en 1 Chill annoncé
        if (task.morningChoice === 'STEAL_FOR_MORNING' && workCount > 0) {
            workCount -= 1;
            chillCount += 1;
            room.gauges.morningStash += 1;
            morningStolen = true;
        }

        // Chaque Chill annoncé (même issu d'un vol de 2A) fait monter le compteur des Slackers
        room.gauges.chillCounter += chillCount;

        const netScore = workCount - sabotageCount;
        const quotaMet = netScore >= task.cardDetails.workQuota;

        // Impact sur les jauges selon la Phase
        if (room.phase === 1) {
            if (quotaMet) {
                const bonus = netScore - task.cardDetails.workQuota;
                room.gauges.quadraPoints += task.cardDetails.successReward + bonus;
            }
        } else if (room.phase === 2) {
            if (!quotaMet) {
                room.gauges.quadraPoints = Math.max(0, room.gauges.quadraPoints - task.cardDetails.failurePenalty);
            }
        } else if (room.phase === 3) {
            room.gauges.cleanupScore += Math.max(0, netScore);
        }

        task.auditedResult = {
            announcedWork: workCount,
            announcedChill: chillCount,
            announcedSabotage: sabotageCount,
            netScore,
            quotaMet,
            morningStolen,
            maxStrikesAllowed: chillCount + sabotageCount,
            strikesGivenThisTurn: 0,
        };

        room.activeTasks[task.taskId] = task;
    });

    room.step = '6_TRIBUNAL';
    await set(roomRef, room);
}

// 9. Étape 6 (The Tribunal) : Donner un Strike avec règle Anti-Spam et Pénalité RH (-3 pts)
export async function issueStrike(roomCode: string, taskId: string, targetPlayerId: string) {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    const room: RoomState = snap.val();

    const task = room.activeTasks?.[taskId];
    const target = room.players?.[targetPlayerId];

    if (!task || !task.auditedResult || !target) throw new Error('Invalid task or player');
    if (!(task.assignedPlayerIds || []).includes(targetPlayerId)) {
        throw new Error('This player is not in your team!');
    }
    if (task.auditedResult.strikesGivenThisTurn >= task.auditedResult.maxStrikesAllowed) {
        throw new Error('Anti-Spam Rule: Maximum Strikes reached for this task pile!');
    }

    target.strikes += 1;
    task.auditedResult.strikesGivenThisTurn += 1;

    // Exclusion au 2e Strike et vérification de l'erreur RH
    if (target.strikes >= 2 && !target.isExcluded) {
        target.isExcluded = true;
        if (target.role === 'TRUE_APPLICANT') {
            room.gauges.quadraPoints = Math.max(0, room.gauges.quadraPoints - 3);
        }
    }

    room.players[targetPlayerId] = target;
    room.activeTasks[taskId] = task;
    await set(roomRef, room);
}



export async function nextTurn(roomCode: string) {
    const roomRef = ref(db, `rooms/${roomCode}`);
    const snap = await get(roomRef);
    if (!snap.exists()) return;
    const room: RoomState = snap.val();

    // Fin du Tour 5 (Vendredi 23h) : Vérification de la Moquette et du seuil de la soirée
    if (room.turn === 5) {
        if (room.gauges.carpetProgress < room.gauges.carpetTarget) {
            room.gauges.quadraPoints = Math.max(0, room.gauges.quadraPoints - 5);
        }
        if (room.gauges.quadraPoints < room.gauges.quadraTarget) {
            room.status = 'FINISHED';
            room.step = 'GAME_OVER';
            await set(roomRef, room);
            return;
        }
    }

    // Pendant la Phase 2 (Nuit) : Si la jauge tombe à 0, annulation immédiate
    if (room.phase === 2 && room.gauges.quadraPoints <= 0) {
        room.status = 'FINISHED';
        room.step = 'GAME_OVER';
        await set(roomRef, room);
        return;
    }

    // Fin du Tour 9 (Samedi 13h) : Fin du Clean-up et passage au Morning
    if (room.turn >= 9) {
        room.status = 'FINISHED';
        room.step = 'GAME_OVER';
        await set(roomRef, room);
        return;
    }

    // Passage au tour suivant
    room.turn += 1;
    room.phase = room.turn <= 5 ? 1 : room.turn <= 8 ? 2 : 3;
    room.step = '1_DISPATCH';
    room.carpetPlayedCards = [];

    const board2APlayers: Player[] = [];
    Object.values(room.players).forEach((p) => {
        p.assignedTaskId = null;
        p.hasTryhardBadge = false;
        p.hand = [];
        p.playedCards = [];
        p.hasSubmitted = false;
        if (p.role === 'BOARD_2A' && !p.isExcluded) {
            board2APlayers.push(p);
        }
        room.players[p.id] = p;
    });

    room.activeTasks = drawTurnTasks(room.phase, board2APlayers);
    await set(roomRef, room);
}
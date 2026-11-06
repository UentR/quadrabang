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
import { GAME_CONFIG } from '../config/gameConfig';

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createActionDeck(): ActionCardType[] {
  const { workCards, chillCards, sabotageCards } = GAME_CONFIG.DECK;
  const deck: ActionCardType[] = [
    ...Array(workCards).fill('WORK'),
    ...Array(chillCards).fill('CHILL'),
    ...Array(sabotageCards).fill('SABOTAGE'),
  ];
  return shuffle(deck);
}

export function getRoleDistribution(playerCount: number): Role[] {
  let board2A = 1;
  let slackers = 2;
  let spies = 1;

  if (GAME_CONFIG.FORCE_CUSTOM_ROLES.enabled) {
    board2A = GAME_CONFIG.FORCE_CUSTOM_ROLES.board2A;
    slackers = GAME_CONFIG.FORCE_CUSTOM_ROLES.slackers;
    spies = GAME_CONFIG.FORCE_CUSTOM_ROLES.spies;
  } else if (playerCount < 8) {
    board2A = 1; slackers = 1; spies = 1;
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

export function calculateInitialGauges(playerCount: number, slackerCount: number) {
  const g = GAME_CONFIG.GAUGES;
  return {
    quadraPoints: g.fixedQuadraStart ?? Math.ceil(g.quadraStartPerPlayer * playerCount),
    quadraTarget: g.fixedQuadraTarget ?? Math.ceil(g.quadraTargetPerPlayer * playerCount),
    chillCounter: 0,
    chillTarget: g.fixedChillTarget ?? Math.round(g.chillTargetPerSlacker * slackerCount),
    morningStash: 0,
    morningTarget: g.fixedMorningTarget ?? Math.ceil(playerCount / g.morningPlayersPerCardRequired),
    carpetProgress: 0,
    carpetTarget: g.fixedCarpetTarget ?? Math.ceil(playerCount / g.carpetPlayersPerWorkRequired),
    cleanupScore: 0,
  };
}

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

export async function joinRoom(roomCode: string, playerId: string, playerName: string) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    role: 'TRUE_APPLICANT',
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

  Object.values(room.activeTasks || {}).forEach((t) => {
    t.assignedPlayerIds = (t.assignedPlayerIds || []).filter((id) => id !== playerId);
    room.activeTasks[t.taskId] = t;
  });

  if (giveTryhardBadge && targetTaskId && targetTaskId !== 'CARPET' && room.activeTasks?.[targetTaskId]) {
    const teamIds = room.activeTasks[targetTaskId].assignedPlayerIds || [];
    teamIds.forEach((id) => {
      if (room.players[id]) room.players[id].hasTryhardBadge = false;
    });
  }

  room.players[playerId].assignedTaskId = targetTaskId;
  room.players[playerId].hasTryhardBadge =
    targetTaskId && targetTaskId !== 'CARPET' ? giveTryhardBadge : false;

  if (targetTaskId && targetTaskId !== 'CARPET' && room.activeTasks?.[targetTaskId]) {
    const currentList = room.activeTasks[targetTaskId].assignedPlayerIds || [];
    if (!currentList.includes(playerId)) {
      currentList.push(playerId);
    }
    room.activeTasks[targetTaskId].assignedPlayerIds = currentList;
  }

  await set(roomRef, room);
}

export async function dealCardsForGrind(roomCode: string) {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snap = await get(roomRef);
  const room: RoomState = snap.val();

  let drawPile = room.deck?.drawPile || [];
  let discardPile = room.deck?.discardPile || [];

  Object.values(room.players).forEach((player) => {
    if (player.role !== 'SOUBEYRAN' && player.role !== 'BOARD_2A' && !player.isExcluded) {
      const cardsNeeded = player.hasTryhardBadge
        ? GAME_CONFIG.RULES.tryhardHandDraw
        : GAME_CONFIG.RULES.normalHandDraw;

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

  const discardPile = room.deck?.discardPile || [];
  discardPile.push(discardedCard);
  room.deck.discardPile = discardPile;

  if (player.assignedTaskId === 'CARPET') {
    const carpetCards = room.carpetPlayedCards || [];
    room.carpetPlayedCards = [...carpetCards, ...playedCards];
  } else if (player.assignedTaskId && room.activeTasks?.[player.assignedTaskId]) {
    const raw = room.activeTasks[player.assignedTaskId].rawSubmittedCards || [];
    room.activeTasks[player.assignedTaskId].rawSubmittedCards = [...raw, ...playedCards];
  }

  await set(roomRef, room);
}

export async function submitMorningChoice(
  roomCode: string,
  taskId: string,
  choice: MorningChoice
) {
  await update(ref(db, `rooms/${roomCode}/activeTasks/${taskId}`), {
    morningChoice: choice,
  });
}

export async function executeSoubeyranAudit(roomCode: string) {
  const roomRef = ref(db, `rooms/${roomCode}`);
  const snap = await get(roomRef);
  const room: RoomState = snap.val();

  const carpetCards = room.carpetPlayedCards || [];
  const carpetWork = carpetCards.filter((c) => c === 'WORK').length;
  const carpetSabotage = carpetCards.filter((c) => c === 'SABOTAGE').length;
  room.gauges.carpetProgress += Math.max(0, carpetWork - carpetSabotage);

  Object.values(room.activeTasks || {}).forEach((task) => {
    const raw = task.rawSubmittedCards || [];
    let workCount = raw.filter((c) => c === 'WORK').length;
    let chillCount = raw.filter((c) => c === 'CHILL').length;
    const sabotageCount = raw.filter((c) => c === 'SABOTAGE').length;
    let morningStolen = false;

    if (task.morningChoice === 'STEAL_FOR_MORNING' && workCount > 0) {
      workCount -= 1;
      chillCount += 1;
      room.gauges.morningStash += 1;
      morningStolen = true;
    }

    room.gauges.chillCounter += chillCount;

    const netScore = workCount - sabotageCount;
    const quotaMet = netScore >= task.cardDetails.workQuota;

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

  if (target.strikes >= GAME_CONFIG.RULES.strikesForExclusion && !target.isExcluded) {
    target.isExcluded = true;
    if (target.role === 'TRUE_APPLICANT') {
      room.gauges.quadraPoints = Math.max(
        0,
        room.gauges.quadraPoints - GAME_CONFIG.RULES.innocentExclusionPenalty
      );
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

  const { phase1EndTurn, phase2EndTurn, totalTurns } = GAME_CONFIG.TURNS;

  if (room.turn === phase1EndTurn) {
    if (room.gauges.carpetProgress < room.gauges.carpetTarget) {
      room.gauges.quadraPoints = Math.max(
        0,
        room.gauges.quadraPoints - GAME_CONFIG.RULES.carpetFailurePenalty
      );
    }
    if (room.gauges.quadraPoints < room.gauges.quadraTarget) {
      room.status = 'FINISHED';
      room.step = 'GAME_OVER';
      await set(roomRef, room);
      return;
    }
  }

  if (room.phase === 2 && room.gauges.quadraPoints <= 0) {
    room.status = 'FINISHED';
    room.step = 'GAME_OVER';
    await set(roomRef, room);
    return;
  }

  if (room.turn >= totalTurns) {
    room.status = 'FINISHED';
    room.step = 'GAME_OVER';
    await set(roomRef, room);
    return;
  }

  room.turn += 1;
  room.phase = room.turn <= phase1EndTurn ? 1 : room.turn <= phase2EndTurn ? 2 : 3;
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
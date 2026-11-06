// src/types/game.ts

export type Role = 'SOUBEYRAN' | 'BOARD_2A' | 'TRUE_APPLICANT' | 'SLACKER' | 'TELECOM_SPY';
export type ActionCardType = 'WORK' | 'CHILL' | 'SABOTAGE';
export type MorningChoice = 'FOCUS_QUADRA' | 'STEAL_FOR_MORNING';

export type GamePhase = 1 | 2 | 3; // 1: Build-Up (5 tours), 2: Night (3 tours), 3: Cleanup (1 tour)
export type TurnStep =
  | '1_DISPATCH'      // Les 2A affectent les joueurs aux tâches (ou à la moquette)
  | '2_TRYHARD_BADGE' // Chaque 2A donne son badge Teacher's Pet / Tryhard
  | '3_THE_GRIND'     // Pioche (2 ou 3 cartes) et dépôt face cachée
  | '4_MORNING_CUT'   // Choix secret de chaque 2A (Focus Quadra ou Steal for Morning)
  | '5_AUDIT'         // Soubeyran valide et annonce les résultats calculés
  | '6_TRIBUNAL'      // Débat en anglais et distribution des Strikes
  | 'GAME_OVER';

export interface EventCard {
  id: string;
  phase: GamePhase;
  title: string;
  description: string;
  recommendedPlayers: number;
  workQuota: number;
  successReward: number;
  failurePenalty: number;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isExcluded: boolean;          // Passe à true au 2e Strike
  strikes: number;              // 0, 1 ou 2
  assignedTaskId: string | 'CARPET' | null; // Tâche d'un 2A ou chantier Moquette
  hasTryhardBadge: boolean;     // Si true: pioche 3 cartes et en joue 2
  hand: ActionCardType[];       // Cartes piochées ce tour-ci
  playedCards: ActionCardType[]; // Cartes envoyées à Soubeyran ce tour-ci
  hasSubmitted: boolean;        // Permet à Soubeyran de voir qui a joué
}

export interface ActiveTaskPile {
  taskId: string;
  board2APlayerId: string;      // Le 2A responsable de cette tâche
  cardDetails: EventCard;
  assignedPlayerIds: string[];
  rawSubmittedCards: ActionCardType[]; // Vraies cartes posées par l'équipe
  morningChoice: MorningChoice | null; // Choix secret du 2A
  // Résultat après le Morning Cut (affiché à Soubeyran à l'étape 5)
  auditedResult?: {
    announcedWork: number;
    announcedChill: number;
    announcedSabotage: number;
    netScore: number;           // Work annoncés - Sabotage annoncés
    quotaMet: boolean;
    morningStolen: boolean;     // True si un Work a été transformé en Chill
    maxStrikesAllowed: number;  // Égal à announcedChill + announcedSabotage
    strikesGivenThisTurn: number;
  };
}

export interface RoomState {
  roomCode: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'FINISHED';
  phase: GamePhase;
  turn: number;                 // De 1 à 9
  step: TurnStep;

  // Les 4 jauges suivies sur l'écran de Soubeyran + Rangement Phase 3
  gauges: {
    quadraPoints: number;       // Départ: ceil(0.5 * nbJoueurs)
    quadraTarget: number;       // Objectif vendredi 23h: 2 * nbJoueurs
    chillCounter: number;       // Secret - Compte chaque Chill annoncé
    chillTarget: number;        // Objectif Slackers: arrondi de 2.5 * nbSlackers
    morningStash: number;       // Secret - Compte les Work détournés par les 2A
    morningTarget: number;      // Objectif 2A: ceil(nbJoueurs / 3)
    carpetProgress: number;     // Public (Phase 1) - Cartes Work sur la moquette
    carpetTarget: number;       // Objectif Moquette: ceil(nbJoueurs / 2)
    cleanupScore: number;       // Phase 3: doit atteindre le nb de joueurs actifs
  };

  // Paquet commun de 60 cartes (30 Work, 18 Chill, 12 Sabotage)
  deck: {
    drawPile: ActionCardType[];
    discardPile: ActionCardType[];
  };

  players: Record<string, Player>;
  activeTasks: Record<string, ActiveTaskPile>; // 1 tâche ouverte par 2A
  carpetPlayedCards: ActionCardType[];          // Cartes jouées sur la moquette ce tour
}
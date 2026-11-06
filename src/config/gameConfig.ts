// src/config/gameConfig.ts

export const GAME_CONFIG = {
  SHOW_DEV_TOOLS: process.env.NODE_ENV === 'development',

  // 1. MODE TEST : Passez "enabled" à true pour forcer le nombre exact de rôles peu importe le nombre de joueurs
  FORCE_CUSTOM_ROLES: {
    enabled: false,
    board2A: 1,
    slackers: 2,
    spies: 1,
  },

  // 2. COMPOSITION DU PAQUET COMMUN (60 cartes par défaut)
  DECK: {
    workCards: 30,
    chillCards: 18,
    sabotageCards: 12,
  },

  // 3. QUOTAS ET MULTIPLICATEURS DES 4 JAUGES
  GAUGES: {
    // Jauge Quadra : Départ = ceil(nbJoueurs * 0.5) | Objectif = ceil(nbJoueurs * 2)
    quadraStartPerPlayer: 0.5,
    quadraTargetPerPlayer: 2.0,
    // Permet de forcer une valeur fixe si différent de null (ex: 10 pour tester rapidement)
    fixedQuadraStart: null as number | null,
    fixedQuadraTarget: null as number | null,

    // Compteur Chill des Slackers : Objectif = round(nbSlackers * 2.5)
    chillTargetPerSlacker: 2.5,
    fixedChillTarget: null as number | null,

    // Réserve Morning des 2A : Objectif = ceil(nbJoueurs / 3)
    morningPlayersPerCardRequired: 3,
    fixedMorningTarget: null as number | null,

    // Chantier Moquette Eiffel & Bouygues : Objectif = ceil(nbJoueurs / 2)
    carpetPlayersPerWorkRequired: 2,
    fixedCarpetTarget: null as number | null,
  },

  // 4. RÈGLES MÉCANIQUES ET PÉNALITÉS
  RULES: {
    normalHandDraw: 2,         // Cartes piochées normalement (joue 1)
    tryhardHandDraw: 3,        // Cartes piochées avec le badge ⭐ (joue 2)
    strikesForExclusion: 2,    // Nombre de Strikes avant exclusion
    innocentExclusionPenalty: 3, // Malus Quadra (-3 pts) si un Vrai Prétendant est exclu
    carpetFailurePenalty: 5,   // Malus Quadra (-5 pts) vendredi 23h si la moquette échoue
    botFillCount: 8,           // Nombre de joueurs générés par le bouton "+ Fill Test Players"
  },

  // 5. DURÉE DES PHASES (9 tours au total)
  TURNS: {
    phase1EndTurn: 5,          // Tours 1 à 5 : The Build-Up
    phase2EndTurn: 8,          // Tours 6 à 8 : The Quadra Night
    totalTurns: 9,             // Tour 9 : The Hangover Cleanup
  },
};
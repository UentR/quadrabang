// src/data/cards.ts
import { EventCard } from '../types/game';

export const PHASE_1_TASKS: EventCard[] = [
  {
    id: 'p1_bars',
    phase: 1,
    title: 'Set Up the 2 Bars',
    description: 'Assemble the structures and plug in the beer taps.',
    recommendedPlayers: 2,
    workQuota: 2,
    successReward: 2, // +2 pts de base (+1 pt par Work net supplémentaire)
    failurePenalty: 0,
  },
  {
    id: 'p1_krookh',
    phase: 1,
    title: 'The Krookh Factory',
    description: 'Prepare hundreds of Krookh sandwiches for Friday night.',
    recommendedPlayers: 2,
    workQuota: 2,
    successReward: 2,
    failurePenalty: 0,
  },
  {
    id: 'p1_barriers',
    phase: 1,
    title: 'Crash Barriers Installation',
    description: 'Secure the perimeter around Eiffel and Bouygues.',
    recommendedPlayers: 3,
    workQuota: 2,
    successReward: 2,
    failurePenalty: 0,
  },
  {
    id: 'p1_stages',
    phase: 1,
    title: 'Build the 4 Stages',
    description: 'Set up the sound systems and lighting rigs with allied assos.',
    recommendedPlayers: 3,
    workQuota: 3,
    successReward: 2,
    failurePenalty: 0,
  },
  // TODO: Ajouter 5 à 7 tâches de montage ici
];

export const PHASE_2_CRISES: EventCard[] = [
  {
    id: 'p2_fake_tickets',
    phase: 2,
    title: 'Former ADR Fake Tickets',
    description: 'Alumni are trying to sneak in using last year’s tickets!',
    recommendedPlayers: 2,
    workQuota: 2,
    successReward: 0, // En Phase 2, réussir évite le malus (0 pt)
    failurePenalty: 3, // -3 pts sur la Jauge Quadra en cas d'échec
  },
  {
    id: 'p2_krookh_rush',
    phase: 2,
    title: 'Massive Rush on the Krookhs',
    description: 'Starving students are storming the food stand!',
    recommendedPlayers: 2,
    workQuota: 2,
    successReward: 0,
    failurePenalty: 2,
  },
  // TODO: Ajouter 6 à 8 cartes Crise de soirée ici
];

export const PHASE_3_CLEANUP: EventCard[] = [
  {
    id: 'p3_carpet_rip',
    phase: 3,
    title: 'Rip Up the Carpet',
    description: 'Remove all the sticky carpet from Eiffel and Bouygues before 13h.',
    recommendedPlayers: 3,
    workQuota: 3,
    successReward: 0,
    failurePenalty: 0,
  },
  {
    id: 'p3_stages_down',
    phase: 3,
    title: 'Dismantle the 4 Stages',
    description: 'Pack up all audio gear and return the trucks on time.',
    recommendedPlayers: 3,
    workQuota: 3,
    successReward: 0,
    failurePenalty: 0,
  },
  // TODO: Ajouter 3 ou 4 tâches de rangement ici
];
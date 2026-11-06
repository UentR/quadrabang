// src/components/room/LobbyView.tsx
'use client';

import { Player, RoomState } from '../../types/game';
import { joinRoom, startGame } from '../../lib/gameEngine';
import { GAME_CONFIG } from '../../config/gameConfig';

interface LobbyViewProps {
  room: RoomState;
  me?: Player;
}

export default function LobbyView({ room, me }: LobbyViewProps) {
  const allPlayers = Object.values(room.players);

  const handleAddBots = async () => {
    const currentCount = allPlayers.length - 1;
    const targetCount = GAME_CONFIG.RULES.botFillCount;
    for (let i = currentCount + 1; i <= targetCount; i++) {
      await joinRoom(room.roomCode, `bot_${i}`, `Student ${i}`);
    }
  };

  return (
    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-4">
      <h2 className="text-lg font-bold">Lobby — Players ({allPlayers.length - 1}/20)</h2>
      <p className="text-xs text-slate-400">
        Share code <strong className="text-white font-mono text-sm">{room.roomCode}</strong> with the class.
      </p>

      <ul className="space-y-1.5 text-xs bg-slate-950 p-3 rounded-lg">
        {allPlayers.map((p) => (
          <li key={p.id}>
            • {p.name} {p.role === 'SOUBEYRAN' ? '(Soubeyran / GM)' : ''}
          </li>
        ))}
      </ul>

      {me?.role === 'SOUBEYRAN' && (
        <div className="flex flex-col gap-2">
          {GAME_CONFIG.SHOW_DEV_TOOLS && (
            <button
              onClick={handleAddBots}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold"
            >
              + Fill up to {GAME_CONFIG.RULES.botFillCount} Test Players (Dev Only)
            </button>
          )}
          <button
            onClick={() => startGame(room.roomCode)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm"
          >
            Start Game
          </button>
        </div>
      )}
    </div>
  );
}
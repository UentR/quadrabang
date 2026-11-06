// src/components/room/RoomHeader.tsx
'use client';

import { Player, RoomState } from '../../types/game';
import { GAME_CONFIG } from '../../config/gameConfig';

interface RoomHeaderProps {
  room: RoomState;
  activePid: string;
  onSelectPid: (pid: string) => void;
  onOpenRules: () => void;
}

export default function RoomHeader({
  room,
  activePid,
  onSelectPid,
  onOpenRules,
}: RoomHeaderProps) {
  const allPlayers = Object.values(room.players);
  const activeApplicants = allPlayers.filter(
    (p) => p.role !== 'SOUBEYRAN' && p.role !== 'BOARD_2A' && !p.isExcluded
  );
  const assignedPlayers = activeApplicants.filter((p) => Boolean(p.assignedTaskId));
  const unassignedPlayers = activeApplicants.filter((p) => !p.assignedTaskId);
  const submittedPlayers = activeApplicants.filter((p) => p.hasSubmitted);
  const waitingPlayers = activeApplicants.filter((p) => !p.hasSubmitted);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="font-bold text-indigo-400 text-sm">ROOM: {room.roomCode}</span>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">
              Turn {room.turn}/9 • {room.step}
            </span>
            <button
              onClick={onOpenRules}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-semibold text-indigo-300"
            >
              📖 Rules
            </button>
          </div>
        </div>

        {GAME_CONFIG.SHOW_DEV_TOOLS && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
            <span className="text-slate-400">View as (Dev Mode):</span>
            <select
              value={activePid}
              onChange={(e) => onSelectPid(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium flex-1 max-w-[220px]"
            >
              {allPlayers.map((p: Player) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {room.status === 'IN_PROGRESS' && (
        <div className="p-3 bg-slate-900/95 border border-slate-800 rounded-xl flex flex-col gap-1 text-xs">
          {room.step === '1_DISPATCH' && (
            <>
              <div className="font-bold text-amber-400">
                Step 1 & 2 (Dispatch): {assignedPlayers.length} / {activeApplicants.length} players assigned
              </div>
              <div className="text-slate-400">
                {unassignedPlayers.length > 0
                  ? `Waiting to be assigned: ${unassignedPlayers.map((p) => p.name).join(', ')}`
                  : '✓ All active players are assigned!'}
              </div>
            </>
          )}

          {room.step === '3_THE_GRIND' && (
            <>
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-400">
                  Step 3 (Cards): {submittedPlayers.length} / {activeApplicants.length} ready
                </span>
                <span className="text-amber-300 font-mono">Waiting: {waitingPlayers.length}</span>
              </div>
              <div className="text-slate-400">
                {waitingPlayers.length > 0
                  ? `Still waiting for: ${waitingPlayers.map((p) => p.name).join(', ')}`
                  : '✓ All players have submitted their cards!'}
              </div>
            </>
          )}

          {room.step === '6_TRIBUNAL' && (
            <div className="text-indigo-300 font-semibold">
              Step 6 (The Tribunal): Class debate in English & 2A Strike distribution before Turn {room.turn + 1}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
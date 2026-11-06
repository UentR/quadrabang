// src/components/room/Board2AView.tsx
'use client';

import { Player, RoomState } from '../../types/game';
import { assignPlayerAndBadge, issueStrike, submitMorningChoice } from '../../lib/gameEngine';

interface Board2AViewProps {
  room: RoomState;
  me: Player;
  getAssignmentLabel: (taskId: string | 'CARPET' | null | undefined) => string;
  onError: (msg: string) => void;
}

export default function Board2AView({
  room,
  me,
  getAssignmentLabel,
  onError,
}: Board2AViewProps) {
  const myTask = room.activeTasks?.[`task_${me.id}`];
  if (!myTask) return null;

  const allPlayers = Object.values(room.players);
  const activeApplicants = allPlayers.filter(
    (p) => p.role !== 'SOUBEYRAN' && p.role !== 'BOARD_2A' && !p.isExcluded
  );
  const myTeamIds = myTask.assignedPlayerIds || [];
  const myTeamPlayers = myTeamIds.map((id) => room.players[id]).filter(Boolean);
  const otherPlayers = activeApplicants.filter((p) => !myTeamIds.includes(p.id));
  const carpetPlayers = activeApplicants.filter((p) => p.assignedTaskId === 'CARPET');

  return (
    <div className="flex flex-col gap-3">
      <div className="p-3.5 bg-slate-900 border border-emerald-900/60 rounded-xl flex flex-col gap-2">
        <h2 className="font-bold text-base text-emerald-400">2A Board Dashboard — {me.name}</h2>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2 bg-slate-950 rounded text-center">
            Quadra: <strong>{room.gauges.quadraPoints}/{room.gauges.quadraTarget} pts</strong>
          </div>
          <div className="p-2 bg-slate-950 rounded text-center">
            Carpet: <strong>{room.gauges.carpetProgress}/{room.gauges.carpetTarget} Work</strong>
          </div>
        </div>
      </div>

      {/* Mission du 2A */}
      <div className="p-3.5 bg-slate-900 border border-indigo-800 rounded-xl space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] uppercase text-indigo-300 font-bold">Turn {room.turn} Mission</span>
          <span className="px-2.5 py-0.5 bg-indigo-950 border border-indigo-700 rounded text-[11px] font-bold">
            Quota: {myTask.cardDetails.workQuota} Work (Rec: {myTask.cardDetails.recommendedPlayers})
          </span>
        </div>
        <h3 className="font-bold text-lg">{myTask.cardDetails.title}</h3>
        <p className="text-xs text-slate-300">{myTask.cardDetails.description}</p>
      </div>

      {/* Rappel Moquette en Phase 1 */}
      {room.phase === 1 && (
        <div className="p-3 bg-slate-900 border border-emerald-900/70 rounded-xl text-xs space-y-1">
          <div className="flex justify-between items-center">
            <span className="font-bold text-emerald-400">Side-Quest: Eiffel & Bouygues Carpet</span>
            <span className="font-mono bg-slate-950 px-2 py-0.5 rounded">
              {room.gauges.carpetProgress}/{room.gauges.carpetTarget} Work
            </span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Assigned ({carpetPlayers.length}): {carpetPlayers.map((p) => p.name).join(', ') || 'None'}
          </p>
        </div>
      )}

      {/* Étape 1 & 2 : Dispatch & Badge */}
      {room.step === '1_DISPATCH' && (
        <div className="flex flex-col gap-3">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5">
            <h4 className="font-bold text-sm text-emerald-400">
              1. Your Assigned Team ({myTeamPlayers.length} players)
            </h4>
            {myTeamPlayers.length === 0 ? (
              <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-500 text-center">
                Your team is empty. Add students below!
              </div>
            ) : (
              <div className="space-y-2">
                {myTeamPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold text-white">
                      {p.name} {p.hasTryhardBadge ? '⭐' : ''}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() =>
                          assignPlayerAndBadge(room.roomCode, p.id, myTask.taskId, !p.hasTryhardBadge)
                        }
                        className={`px-2.5 py-1.5 rounded-lg font-semibold ${
                          p.hasTryhardBadge ? 'bg-amber-600 text-white' : 'bg-slate-800 text-amber-300'
                        }`}
                      >
                        {p.hasTryhardBadge ? '★ Has Badge' : '⭐ Give Badge'}
                      </button>
                      <button
                        onClick={() => assignPlayerAndBadge(room.roomCode, p.id, null, false)}
                        className="px-2.5 py-1.5 bg-red-950 text-red-300 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5">
            <h4 className="font-bold text-sm text-indigo-400">
              2. Available Students ({otherPlayers.length})
            </h4>
            <div className="space-y-2">
              {otherPlayers.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-400">
                      Status: {getAssignmentLabel(p.assignedTaskId)}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => assignPlayerAndBadge(room.roomCode, p.id, myTask.taskId, false)}
                      className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold"
                    >
                      + Add to Team
                    </button>
                    {room.phase === 1 && (
                      <button
                        onClick={() => assignPlayerAndBadge(room.roomCode, p.id, 'CARPET', false)}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold ${
                          p.assignedTaskId === 'CARPET'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        Carpet
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Étape 3 & 4 : Morning Cut */}
      {room.step === '3_THE_GRIND' && (
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <h4 className="text-sm font-bold text-amber-400">Step 4: Your Secret Morning Cut</h4>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => submitMorningChoice(room.roomCode, myTask.taskId, 'FOCUS_QUADRA')}
              className={`w-full py-3 rounded-xl font-bold text-xs border-2 ${
                myTask.morningChoice === 'FOCUS_QUADRA'
                  ? 'bg-indigo-600 border-white text-white'
                  : 'bg-slate-950 border-indigo-800 text-indigo-300'
              }`}
            >
              {myTask.morningChoice === 'FOCUS_QUADRA'
                ? '✓ Selected: Focus Quadra (No Theft)'
                : 'Focus Quadra (Leave Pile Untouched)'}
            </button>
            <button
              onClick={() => submitMorningChoice(room.roomCode, myTask.taskId, 'STEAL_FOR_MORNING')}
              className={`w-full py-3 rounded-xl font-bold text-xs border-2 ${
                myTask.morningChoice === 'STEAL_FOR_MORNING'
                  ? 'bg-emerald-600 border-white text-white'
                  : 'bg-slate-950 border-emerald-800 text-emerald-300'
              }`}
            >
              {myTask.morningChoice === 'STEAL_FOR_MORNING'
                ? '✓ Selected: Steal for Morning (1 Work → 1 Chill)'
                : 'Steal for Morning (Convert 1 Work → 1 Chill)'}
            </button>
          </div>
        </div>
      )}

      {/* Étape 6 : Tribunal */}
      {room.step === '6_TRIBUNAL' && myTask.auditedResult && (
        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="p-2.5 bg-slate-950 border border-indigo-800 rounded-lg text-xs">
            <strong>Announced:</strong> {myTask.auditedResult.announcedWork} Work, {myTask.auditedResult.announcedChill} Chill, {myTask.auditedResult.announcedSabotage} Sabotage (Net: {myTask.auditedResult.netScore})
          </div>
          <h4 className="text-xs font-bold text-amber-400">
            Step 6: Strikes remaining: {myTask.auditedResult.maxStrikesAllowed - myTask.auditedResult.strikesGivenThisTurn}
          </h4>
          <div className="space-y-2">
            {myTeamPlayers.map((p) => (
              <div key={p.id} className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg text-xs">
                <span>
                  <strong>{p.name}</strong> (Strikes: {p.strikes}/2)
                </span>
                <button
                  onClick={async () => {
                    try {
                      onError('');
                      await issueStrike(room.roomCode, myTask.taskId, p.id);
                    } catch (e: any) {
                      onError(e.message);
                    }
                  }}
                  className="px-3 py-1.5 bg-red-600 rounded-lg font-bold"
                >
                  Issue Strike
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// src/components/room/SoubeyranView.tsx
'use client';

import { ActiveTaskPile, RoomState } from '../../types/game';
import { dealCardsForGrind, executeSoubeyranAudit, nextTurn } from '../../lib/gameEngine';

interface SoubeyranViewProps {
  room: RoomState;
}

export default function SoubeyranView({ room }: SoubeyranViewProps) {
  const allPlayers = Object.values(room.players);
  const activeApplicants = allPlayers.filter(
    (p) => p.role !== 'SOUBEYRAN' && p.role !== 'BOARD_2A' && !p.isExcluded
  );
  const submittedPlayers = activeApplicants.filter((p) => p.hasSubmitted);
  const waitingPlayers = activeApplicants.filter((p) => !p.hasSubmitted);
  const carpetPlayers = activeApplicants.filter((p) => p.assignedTaskId === 'CARPET');

  const carpetCards = room.carpetPlayedCards || [];
  const carpetWork = carpetCards.filter((c) => c === 'WORK').length;
  const carpetChill = carpetCards.filter((c) => c === 'CHILL').length;
  const carpetSabotage = carpetCards.filter((c) => c === 'SABOTAGE').length;
  const carpetNet = Math.max(0, carpetWork - carpetSabotage);

  const phaseLabel =
    room.phase === 1
      ? 'Phase 1: The Build-Up'
      : room.phase === 2
      ? 'Phase 2: The Quadra Night'
      : 'Phase 3: The Hangover Cleanup';

  const getScriptLines = (): string[] => {
    const tasks = Object.values(room.activeTasks || {});

    if (room.step === '1_DISPATCH') {
      const taskLines = tasks.map(
        (t) =>
          `"${room.players[t.board2APlayerId]?.name || '2A'}, your mission is '${t.cardDetails.title}' — Quota: ${t.cardDetails.workQuota} net Work (Rec: ${t.cardDetails.recommendedPlayers} players)."`
      );
      return [
        `"Turn ${room.turn}/9 (${phaseLabel})! Public Quadra Gauge is at ${room.gauges.quadraPoints}/${room.gauges.quadraTarget} pts."`,
        ...taskLines,
        room.phase === 1
          ? `"Don't forget the Eiffel & Bouygues Carpet side-quest (${room.gauges.carpetProgress}/${room.gauges.carpetTarget} Work). 2A Board, assign every student and award your Teacher's Pet ⭐ badges!"`
          : `"2A Board, debate in English, assign every student, and award your Teacher's Pet ⭐ badges!"`,
      ];
    }

    if (room.step === '3_THE_GRIND') {
      return [
        `"Teams are locked! Everyone draws 2 cards and plays 1 face-down (Teacher's Pets ⭐ draw 3 and play 2)."`,
        `"2A Board, secretly select 'Focus Quadra' or 'Steal for Morning' on your phones."`,
        waitingPlayers.length > 0
          ? `"Still waiting for ${waitingPlayers.length} player(s): ${waitingPlayers.map((p) => p.name).join(', ')}."`
          : `"All cards are in! I will now run the Administration Audit."`,
      ];
    }

    if (room.step === '6_TRIBUNAL') {
      const lines = tasks.map((t) => {
        const r = t.auditedResult;
        if (!r) return '';
        return `"For '${t.cardDetails.title}' (${room.players[t.board2APlayerId]?.name}'s team): ${r.announcedWork} WORK, ${r.announcedChill} CHILL, ${r.announcedSabotage} SABOTAGE — Net: ${r.netScore} (${r.quotaMet ? 'SUCCESS' : 'FAILED'})!"`;
      });
      if (room.phase === 1 && carpetCards.length > 0) {
        lines.push(
          `"On the Eiffel & Bouygues Carpet: ${carpetWork} WORK, ${carpetChill} CHILL, ${carpetSabotage} SABOTAGE (+${carpetNet} progress, total: ${room.gauges.carpetProgress}/${room.gauges.carpetTarget})!"`
        );
      }
      lines.push(
        `"Quadra Gauge is now at ${room.gauges.quadraPoints}/${room.gauges.quadraTarget} pts. Defend yourselves in English! 2A Board, you may issue Strikes."`
      );
      return lines.filter(Boolean);
    }

    return [];
  };

  const renderTaskCard = (t: ActiveTaskPile) => {
    const teamMembers = (t.assignedPlayerIds || []).map((id) => room.players[id]).filter(Boolean);
    const submittedCount = teamMembers.filter((p) => p.hasSubmitted).length;

    return (
      <div key={t.taskId} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-[11px] font-bold uppercase px-2 py-0.5 bg-indigo-900/80 text-indigo-200 rounded">
            2A Leader: {room.players[t.board2APlayerId]?.name}
          </span>
          <span className="text-[11px] font-mono bg-slate-800 text-slate-200 px-2 py-0.5 rounded">
            Quota: {t.cardDetails.workQuota} Work (Rec: {t.cardDetails.recommendedPlayers})
          </span>
        </div>

        <div className="font-bold text-base text-white">{t.cardDetails.title}</div>
        <p className="text-slate-400">{t.cardDetails.description}</p>

        <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
          <div className="font-semibold text-slate-300">
            Assigned Team ({teamMembers.length} players — {submittedCount}/{teamMembers.length} played):
          </div>
          {teamMembers.length === 0 ? (
            <div className="text-slate-500 italic">No students assigned yet.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {teamMembers.map((p) => (
                <span
                  key={p.id}
                  className={`px-2 py-1 rounded border text-[11px] ${
                    p.hasSubmitted
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  {p.name} {p.hasTryhardBadge ? '⭐ (2)' : ''} — {p.hasSubmitted ? '✓ Ready' : '⏳ Waiting'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-400 pt-1">
          Cards in pile: <strong className="text-white">{(t.rawSubmittedCards || []).length}</strong> | 2A Morning Choice:{' '}
          <strong className={t.morningChoice ? 'text-emerald-400' : 'text-amber-400'}>
            {t.morningChoice || 'Pending'}
          </strong>
        </div>

        {t.auditedResult && (
          <div className="p-2.5 bg-indigo-950/60 rounded-lg border border-indigo-500">
            <div className="font-bold text-indigo-300 text-[10px] uppercase">Task Audit Result:</div>
            <div className="text-sm font-bold text-white mt-0.5">
              &quot;{t.auditedResult.announcedWork} WORK, {t.auditedResult.announcedChill} CHILL, {t.auditedResult.announcedSabotage} SABOTAGE — Net: {t.auditedResult.netScore} ({t.auditedResult.quotaMet ? 'SUCCESS' : 'FAILED'})&quot;
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Téléprompteur Soubeyran */}
      <div className="p-3.5 bg-indigo-950/70 border-2 border-indigo-500/80 rounded-xl flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
          📢 Soubeyran&apos;s Script — Read Aloud in English:
        </div>
        <div className="space-y-1.5 text-sm font-medium text-white">
          {getScriptLines().map((line, idx) => (
            <p key={idx} className="p-2 bg-slate-950/70 rounded-lg border border-indigo-800/60">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Les 4 Jauges */}
      <div className="p-3.5 bg-slate-900 border border-indigo-900 rounded-xl">
        <h2 className="font-bold text-sm text-indigo-400 mb-2.5">Soubeyran&apos;s Secret Screen (4 Gauges)</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 bg-slate-950 rounded-lg">
            <div className="text-slate-400 text-[11px]">PUBLIC — Quadra</div>
            <div className="text-lg font-bold">{room.gauges.quadraPoints} / {room.gauges.quadraTarget} pts</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-lg">
            <div className="text-slate-400 text-[11px]">PUBLIC — Carpet</div>
            <div className="text-lg font-bold">{room.gauges.carpetProgress} / {room.gauges.carpetTarget}</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-lg border border-amber-900/50">
            <div className="text-amber-400 text-[11px]">SECRET — Chill</div>
            <div className="text-lg font-bold">{room.gauges.chillCounter} / {room.gauges.chillTarget}</div>
          </div>
          <div className="p-2.5 bg-slate-950 rounded-lg border border-emerald-900/50">
            <div className="text-emerald-400 text-[11px]">SECRET — Morning</div>
            <div className="text-lg font-bold">{room.gauges.morningStash} / {room.gauges.morningTarget}</div>
          </div>
        </div>
      </div>

      {/* Boutons d'action GM */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2">
        <div className="text-xs font-bold text-slate-300">GM Action — Step: {room.step}</div>
        {room.step === '1_DISPATCH' && (
          <button
            onClick={() => dealCardsForGrind(room.roomCode)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm"
          >
            Lock Teams & Deal Cards (Start Step 3)
          </button>
        )}
        {room.step === '3_THE_GRIND' && (
          <button
            onClick={() => executeSoubeyranAudit(room.roomCode)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm"
          >
            Run Audit & Reveal Results ({submittedPlayers.length}/{activeApplicants.length} ready)
          </button>
        )}
        {room.step === '6_TRIBUNAL' && (
          <button
            onClick={() => nextTurn(room.roomCode)}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold text-sm"
          >
            End Tribunal & Start Turn {room.turn + 1}
          </button>
        )}
      </div>

      {/* Missions actives + Side-Quest Moquette */}
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-3">
        <h3 className="font-bold text-sm text-amber-400">Current Turn Missions ({phaseLabel})</h3>
        {Object.values(room.activeTasks || {}).map(renderTaskCard)}

        {room.phase === 1 && (
          <div className="p-3.5 bg-slate-950 border border-emerald-900/80 rounded-xl text-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[11px] font-bold uppercase px-2 py-0.5 bg-emerald-900/80 text-emerald-200 rounded">
                Phase 1 Side-Quest
              </span>
              <span className="text-[11px] font-mono bg-slate-800 text-emerald-300 px-2 py-0.5 rounded">
                Progress: {room.gauges.carpetProgress} / {room.gauges.carpetTarget} Work
              </span>
            </div>

            <div className="font-bold text-base text-white">Eiffel & Bouygues Carpet Installation</div>
            <p className="text-slate-400">
              Cover both buildings before Friday 23h (Turn 5) or suffer a -5 pt penalty on the Quadra Gauge.
            </p>

            <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
              <div className="font-semibold text-slate-300">
                Assigned to Carpet ({carpetPlayers.length} players):
              </div>
              {carpetPlayers.length === 0 ? (
                <div className="text-slate-500 italic">No students assigned to Carpet this turn.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {carpetPlayers.map((p) => (
                    <span
                      key={p.id}
                      className={`px-2 py-1 rounded border text-[11px] ${
                        p.hasSubmitted
                          ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      {p.name} — {p.hasSubmitted ? '✓ Ready' : '⏳ Waiting'}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {room.step === '6_TRIBUNAL' && carpetCards.length > 0 && (
              <div className="p-2.5 bg-emerald-950/60 rounded-lg border border-emerald-500">
                <div className="font-bold text-emerald-300 text-[10px] uppercase">Carpet Audit Result:</div>
                <div className="text-sm font-bold text-white mt-0.5">
                  &quot;{carpetWork} WORK, {carpetChill} CHILL, {carpetSabotage} SABOTAGE — Net Progress: +{carpetNet}&quot;
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
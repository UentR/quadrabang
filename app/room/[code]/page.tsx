'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../src/lib/firebase';
import { ActionCardType, RoomState } from '../../../src/types/game';
import {
  joinRoom,
  startGame,
  assignPlayerAndBadge,
  dealCardsForGrind,
  submitActionCards,
  submitMorningChoice,
  executeSoubeyranAudit,
  issueStrike,
  nextTurn,
} from '../../../src/lib/gameEngine';

function RoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = params.code as string;
  const currentPid = searchParams.get('pid') || '';

  const [room, setRoom] = useState<RoomState | null>(null);
  const [activePid, setActivePid] = useState<string>(currentPid);
  const [showSecretRole, setShowSecretRole] = useState<boolean>(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(roomRef, (snap) => {
      if (snap.exists()) setRoom(snap.val());
    });
    return () => unsub();
  }, [roomCode]);

  if (!room) {
    return <div className="p-6 text-white bg-slate-950 min-h-screen">Loading room {roomCode}...</div>;
  }

  const me = room.players[activePid];
  const allPlayers = Object.values(room.players);
  const applicants = allPlayers.filter((p) => p.role !== 'SOUBEYRAN' && p.role !== 'BOARD_2A');
  const activeApplicants = applicants.filter((p) => !p.isExcluded);

  // Suivi en temps réel
  const assignedPlayers = activeApplicants.filter((p) => p.assignedTaskId !== null && p.assignedTaskId !== undefined);
  const unassignedPlayers = activeApplicants.filter((p) => !p.assignedTaskId);
  const carpetPlayers = activeApplicants.filter((p) => p.assignedTaskId === 'CARPET');
  const submittedPlayers = activeApplicants.filter((p) => p.hasSubmitted);
  const waitingForCardsPlayers = activeApplicants.filter((p) => !p.hasSubmitted);

  // Calcul des cartes jouées sur la Moquette pour l'annonce orale de Soubeyran
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

  const getAssignmentLabel = (taskId: string | 'CARPET' | null | undefined) => {
    if (!taskId) return 'Unassigned';
    if (taskId === 'CARPET') return 'Eiffel & Bouygues Carpet';
    const task = room.activeTasks?.[taskId];
    if (!task) return 'Unassigned';
    const ownerName = room.players[task.board2APlayerId]?.name || '2A';
    return `${task.cardDetails.title} (${ownerName})`;
  };

  // Génération du script en anglais que Soubeyran doit lire à voix haute à chaque étape
  const getSoubeyranScript = (): string[] => {
    const tasks = Object.values(room.activeTasks || {});

    if (room.status === 'LOBBY') {
      return [
        `"Welcome to Quadrabang: Behind the Scenes! Connect with your phones using room code ${room.roomCode}."`,
      ];
    }

    if (room.status === 'FINISHED') {
      const quadraOk = room.gauges.quadraPoints >= room.gauges.quadraTarget && room.gauges.quadraPoints > 0;
      const cleanupOk = room.turn >= 9 && room.gauges.cleanupScore >= activeApplicants.length;
      const chillReached = room.gauges.chillCounter >= room.gauges.chillTarget;
      const morningOk = room.gauges.morningStash >= room.gauges.morningTarget;

      if (!quadraOk || !cleanupOk) {
        return [
          `"Administration Announcement: The Quadrabang failed to meet safety and cleanup standards! The party is shut down — TELECOM SPIES WIN!"`,
        ];
      }
      if (chillReached) {
        return [
          `"The Quadrabang and Cleanup succeeded, but the Chill Counter reached ${room.gauges.chillCounter}/${room.gauges.chillTarget}! The SLACKERS coasted through the week and steal the victory!"`,
        ];
      }
      return [
        `"The Quadrabang is a triumph (${room.gauges.quadraPoints} pts) and the campus is spotless! TRUE APPLICANTS WIN!"`,
        morningOk
          ? `"And at 14h, the 2A Board reveals ${room.gauges.morningStash}/${room.gauges.morningTarget} stolen Work cards in the Morning Stash: THE MORNING PARTY IS ON — 2A BOARD SHARES THE VICTORY!"`
          : `"However, the 2A Board only stashed ${room.gauges.morningStash}/${room.gauges.morningTarget} Work cards... There is NO Morning party! The 2A Board loses their personal objective!"`,
      ];
    }

    if (room.step === '1_DISPATCH') {
      const taskLines = tasks.map(
        (t) =>
          `"${room.players[t.board2APlayerId]?.name || '2A'}, your mission is '${t.cardDetails.title}' — Quota: ${t.cardDetails.workQuota} net Work (Recommended: ${t.cardDetails.recommendedPlayers} players)."`
      );
      return [
        `"Turn ${room.turn}/9 (${phaseLabel})! Public Quadra Gauge is at ${room.gauges.quadraPoints}/${room.gauges.quadraTarget} pts."`,
        ...taskLines,
        room.phase === 1
          ? `"Don't forget the Eiffel & Bouygues Carpet side-quest (${room.gauges.carpetProgress}/${room.gauges.carpetTarget} Work completed). 2A Board, debate in English, assign every student, and award your Teacher's Pet ⭐ badges!"`
          : `"2A Board, debate with the class in English, assign every student to a team, and award your Teacher's Pet ⭐ badges!"`,
      ];
    }

    if (room.step === '3_THE_GRIND') {
      return [
        `"Teams are locked! Check your phones: everyone draws 2 cards and plays 1 face-down (Teacher's Pets ⭐ draw 3 and play 2)."`,
        `"2A Board, secretly select 'Focus Quadra' or 'Steal for Morning' on your phones."`,
        waitingForCardsPlayers.length > 0
          ? `"I am still waiting for ${waitingForCardsPlayers.length} player(s): ${waitingForCardsPlayers.map((p) => p.name).join(', ')}."`
          : `"All cards are in! I will now run the Administration Audit."`,
      ];
    }

    if (room.step === '6_TRIBUNAL') {
      const resultLines = tasks.map((t) => {
        const r = t.auditedResult;
        if (!r) return '';
        return `"For '${t.cardDetails.title}' (${room.players[t.board2APlayerId]?.name}'s team): ${r.announcedWork} WORK, ${r.announcedChill} CHILL, ${r.announcedSabotage} SABOTAGE — Net Score: ${r.netScore} (${r.quotaMet ? 'SUCCESS' : 'FAILED'})!"`;
      });
      if (room.phase === 1 && carpetCards.length > 0) {
        resultLines.push(
          `"On the Eiffel & Bouygues Carpet: ${carpetWork} WORK, ${carpetChill} CHILL, ${carpetSabotage} SABOTAGE (+${carpetNet} progress, total: ${room.gauges.carpetProgress}/${room.gauges.carpetTarget})!"`
        );
      }
      resultLines.push(
        `"Quadra Gauge is now at ${room.gauges.quadraPoints}/${room.gauges.quadraTarget} pts. Class, defend yourselves in English! 2A Board, you may now issue Strikes to suspects on your team."`
      );
      return resultLines.filter(Boolean);
    }

    return [];
  };

  const handleAddBots = async () => {
    const currentCount = Object.keys(room.players).length - 1;
    for (let i = currentCount + 1; i <= 8; i++) {
      await joinRoom(roomCode, `bot_${i}`, `Student ${i}`);
    }
  };

  const handlePlayCards = async () => {
    if (!me || !me.hand) return;
    const requiredCount = me.hasTryhardBadge ? 2 : 1;
    if (selectedIndices.length !== requiredCount) {
      return setError(`You must select exactly ${requiredCount} card(s) to play.`);
    }
    try {
      setError('');
      const played: ActionCardType[] = [];
      let discarded: ActionCardType = 'CHILL';
      me.hand.forEach((card, idx) => {
        if (selectedIndices.includes(idx)) played.push(card);
        else discarded = card;
      });
      await submitActionCards(roomCode, me.id, played, discarded);
      setSelectedIndices([]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white px-3 py-3 pb-16 max-w-lg mx-auto flex flex-col gap-3">
      {/* BARRE SUPÉRIEURE OPTIMISÉE MOBILE */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="font-bold text-indigo-400 text-sm">ROOM: {room.roomCode}</span>
          <span className="px-2 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">
            Turn {room.turn}/9 • {room.step}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          <span className="text-slate-400">View as (Test Mode):</span>
          <select
            value={activePid}
            onChange={(e) => {
              setActivePid(e.target.value);
              setSelectedIndices([]);
              setError('');
            }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium flex-1 max-w-[220px]"
          >
            {allPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* BANDEAU DE SUIVI EN DIRECT (COMPTEUR DE CARTES & AFFECTATIONS) */}
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
                <span className="text-amber-300 font-mono">
                  Waiting: {waitingForCardsPlayers.length}
                </span>
              </div>
              {waitingForCardsPlayers.length > 0 ? (
                <div className="text-slate-400">
                  Still waiting for: <strong className="text-white">{waitingForCardsPlayers.map((p) => p.name).join(', ')}</strong>
                </div>
              ) : (
                <div className="text-emerald-300 font-semibold">
                  ✓ All players have submitted their cards!
                </div>
              )}
            </>
          )}

          {room.step === '6_TRIBUNAL' && (
            <div className="text-indigo-300 font-semibold">
              Step 6 (The Tribunal): Class debate in English & 2A Strike distribution before Turn {room.turn + 1}.
            </div>
          )}
        </div>
      )}

      {/* TÉLÉPROMPTEUR PERMANENT POUR SOUBEYRAN (CE QU'IL DOIT DIRE À VOIX HAUTE) */}
      {me?.role === 'SOUBEYRAN' && (
        <div className="p-3.5 bg-indigo-950/70 border-2 border-indigo-500/80 rounded-xl flex flex-col gap-2 shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
            <span>📢 Soubeyran&apos;s Script — Read Aloud in English:</span>
          </div>
          <div className="space-y-1.5 text-sm font-medium text-white leading-snug">
            {getSoubeyranScript().map((line, i) => (
              <p key={i} className="p-2 bg-slate-950/70 rounded-lg border border-indigo-800/60">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/60 border border-red-700 rounded-xl text-xs text-red-200 font-medium">
          {error}
        </div>
      )}

      {/* ==================== VUE 1 : LOBBY ==================== */}
      {room.status === 'LOBBY' && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-4">
          <h2 className="text-lg font-bold">Lobby — Players ({allPlayers.length - 1}/20)</h2>
          <p className="text-xs text-slate-400">
            Share code <strong className="text-white font-mono text-sm">{room.roomCode}</strong> with the class.
          </p>
          <ul className="space-y-1.5 text-xs bg-slate-950 p-3 rounded-lg">
            {allPlayers.map((p) => (
              <li key={p.id}>• {p.name} {p.role === 'SOUBEYRAN' ? '(Soubeyran / GM)' : ''}</li>
            ))}
          </ul>

          {me?.role === 'SOUBEYRAN' && (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleAddBots}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold"
              >
                + Fill up to 8 Test Players
              </button>
              <button
                onClick={() => startGame(roomCode)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold text-sm"
              >
                Start Game
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================== VUE 2 : FIN DE PARTIE ==================== */}
      {room.status === 'FINISHED' && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-4">
          <h2 className="text-xl font-bold text-amber-400">Saturday 14h — The Morning Verdict</h2>
          <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-lg">
            <div>Quadra Gauge: <strong>{room.gauges.quadraPoints}/{room.gauges.quadraTarget}</strong></div>
            <div>Carpet: <strong>{room.gauges.carpetProgress}/{room.gauges.carpetTarget}</strong></div>
            <div>Chill Counter: <strong>{room.gauges.chillCounter}/{room.gauges.chillTarget}</strong></div>
            <div>Morning Stash: <strong>{room.gauges.morningStash}/{room.gauges.morningTarget}</strong></div>
          </div>
          <h3 className="font-bold text-sm">Full Role Reveal:</h3>
          <ul className="text-xs space-y-1 bg-slate-950 p-3 rounded-lg">
            {allPlayers.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> — {p.role} {p.isExcluded ? '(EXCLUDED)' : '(Active)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ==================== VUE 3 : DASHBOARD DE SOUBEYRAN (MJ) ==================== */}
      {room.status === 'IN_PROGRESS' && me?.role === 'SOUBEYRAN' && (
        <div className="flex flex-col gap-3">
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

          {/* Bouton d'action principal de Soubeyran placé bien en vue sur mobile */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-300">GM Action — Step: {room.step}</div>
            {room.step === '1_DISPATCH' && (
              <button
                onClick={() => dealCardsForGrind(roomCode)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] rounded-lg font-bold text-sm"
              >
                Lock Teams & Deal Cards (Start Step 3)
              </button>
            )}
            {room.step === '3_THE_GRIND' && (
              <button
                onClick={() => executeSoubeyranAudit(roomCode)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] rounded-lg font-bold text-sm"
              >
                Run Audit & Reveal Results ({submittedPlayers.length}/{activeApplicants.length} ready)
              </button>
            )}
            {room.step === '6_TRIBUNAL' && (
              <button
                onClick={() => nextTurn(roomCode)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 active:scale-[0.99] rounded-lg font-bold text-sm"
              >
                End Tribunal & Start Turn {room.turn + 1}
              </button>
            )}
          </div>

          {/* MISSIONS EN COURS + SIDE-QUEST MOQUETTE AVEC LE MÊME AFFICHAGE */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-3">
            <h3 className="font-bold text-sm text-amber-400">
              Current Turn Missions ({phaseLabel})
            </h3>

            {Object.values(room.activeTasks || {}).map((t) => {
              const teamMembers = (t.assignedPlayerIds || []).map((id) => room.players[id]).filter(Boolean);
              const submittedInTeam = teamMembers.filter((p) => p.hasSubmitted).length;

              return (
                <div key={t.taskId} className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-2.5">
                  {/* En-tête mobile empilé proprement pour éviter toute collision */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold uppercase px-2 py-0.5 bg-indigo-900/80 text-indigo-200 rounded">
                      2A Leader: {room.players[t.board2APlayerId]?.name}
                    </span>
                    <span className="text-[11px] font-mono bg-slate-800 text-slate-200 px-2 py-0.5 rounded">
                      Quota: {t.cardDetails.workQuota} Work (Rec: {t.cardDetails.recommendedPlayers})
                    </span>
                  </div>

                  <div className="font-bold text-base text-white leading-snug">
                    {t.cardDetails.title}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.cardDetails.description}</p>

                  {/* Équipe assignée */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                    <div className="font-semibold text-slate-300">
                      Assigned Team ({teamMembers.length} players — {submittedInTeam}/{teamMembers.length} played):
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
                            {p.name} {p.hasTryhardBadge ? '⭐ (2 cards)' : ''} — {p.hasSubmitted ? '✓ Ready' : '⏳ Waiting'}
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
                    <div className="p-2.5 bg-indigo-950/60 rounded-lg border border-indigo-500 mt-1">
                      <div className="font-bold text-indigo-300 text-[10px] uppercase">Task Audit Result:</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        &quot;{t.auditedResult.announcedWork} WORK, {t.auditedResult.announcedChill} CHILL, {t.auditedResult.announcedSabotage} SABOTAGE — Net: {t.auditedResult.netScore} ({t.auditedResult.quotaMet ? 'SUCCESS' : 'FAILED'})&quot;
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* SIDE-QUEST MOQUETTE AVEC LE MÊME STYLE DE CARTE MISSION */}
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

                <div className="font-bold text-base text-white leading-snug">
                  Eiffel & Bouygues Carpet Installation
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Cover both buildings with carpet before Friday 23h (Turn 5) or suffer a -5 pt penalty on the Quadra Gauge.
                </p>

                <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                  <div className="font-semibold text-slate-300">
                    Assigned to Carpet ({carpetPlayers.length} players — {carpetPlayers.filter((p) => p.hasSubmitted).length}/{carpetPlayers.length} played):
                  </div>
                  {carpetPlayers.length === 0 ? (
                    <div className="text-slate-500 italic">No students assigned to the Carpet this turn.</div>
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

                <div className="text-[11px] text-slate-400 pt-1">
                  Cards in Carpet pile this turn: <strong className="text-white">{carpetCards.length}</strong>
                </div>

                {room.step === '6_TRIBUNAL' && carpetCards.length > 0 && (
                  <div className="p-2.5 bg-emerald-950/60 rounded-lg border border-emerald-500 mt-1">
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
      )}

      {/* ==================== VUE 4 : INTERFACE BUREAU 2A (OPTIMISÉE MOBILE) ==================== */}
      {room.status === 'IN_PROGRESS' && me?.role === 'BOARD_2A' && (
        <div className="flex flex-col gap-3">
          <div className="p-3.5 bg-slate-900 border border-emerald-900/60 rounded-xl flex flex-col gap-2">
            <div>
              <h2 className="font-bold text-base text-emerald-400">2A Board Dashboard — {me.name}</h2>
              <p className="text-xs text-slate-400">Build your team, manage your Morning Cut, and find the Saboteurs.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono">
              <div className="p-2 bg-slate-950 rounded text-center">
                Quadra: <strong>{room.gauges.quadraPoints}/{room.gauges.quadraTarget} pts</strong>
              </div>
              <div className="p-2 bg-slate-950 rounded text-center">
                Carpet: <strong>{room.gauges.carpetProgress}/{room.gauges.carpetTarget} Work</strong>
              </div>
            </div>
          </div>

          {room.activeTasks[`task_${me.id}`] && (() => {
            const myTask = room.activeTasks[`task_${me.id}`];
            const myTeamIds = myTask.assignedPlayerIds || [];
            const myTeamPlayers = myTeamIds.map((id) => room.players[id]).filter(Boolean);
            const otherPlayers = activeApplicants.filter((p) => !myTeamIds.includes(p.id));

            return (
              <div className="flex flex-col gap-3">
                {/* Carte Mission du 2A optimisée pour téléphone */}
                <div className="p-3.5 bg-slate-900 border border-indigo-800 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] uppercase text-indigo-300 font-bold">
                      Turn {room.turn} Mission
                    </span>
                    <span className="px-2.5 py-0.5 bg-indigo-950 border border-indigo-700 rounded text-[11px] font-bold">
                      Quota: {myTask.cardDetails.workQuota} Work (Rec: {myTask.cardDetails.recommendedPlayers})
                    </span>
                  </div>
                  <h3 className="font-bold text-lg leading-snug">{myTask.cardDetails.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{myTask.cardDetails.description}</p>
                </div>

                {/* Carte Side-Quest Moquette visible aussi pour les 2A en Phase 1 */}
                {room.phase === 1 && (
                  <div className="p-3 bg-slate-900 border border-emerald-900/70 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-emerald-400">Side-Quest: Eiffel & Bouygues Carpet</span>
                      <span className="font-mono bg-slate-950 px-2 py-0.5 rounded">
                        {room.gauges.carpetProgress}/{room.gauges.carpetTarget} Work
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Assigned this turn ({carpetPlayers.length}): {carpetPlayers.map((p) => p.name).join(', ') || 'None'}
                    </p>
                  </div>
                )}

                {/* ÉTAPE 1 & 2 : DISPATCH & BADGE */}
                {room.step === '1_DISPATCH' && (
                  <div className="flex flex-col gap-3">
                    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                      <div>
                        <h4 className="font-bold text-sm text-emerald-400">
                          1. Your Assigned Team ({myTeamPlayers.length} players)
                        </h4>
                        <p className="text-xs text-slate-400">
                          Give <strong>⭐ Teacher&apos;s Pet</strong> to ONE trusted member so they play 2 cards!
                        </p>
                      </div>

                      {myTeamPlayers.length === 0 ? (
                        <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-500 text-center">
                          Your team is empty. Add students from the list below!
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {myTeamPlayers.map((p) => (
                            <div
                              key={p.id}
                              className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="font-bold text-white">
                                {p.name}{' '}
                                {p.hasTryhardBadge && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px]">
                                    ⭐ Teacher&apos;s Pet
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() =>
                                    assignPlayerAndBadge(roomCode, p.id, myTask.taskId, !p.hasTryhardBadge)
                                  }
                                  className={`px-2.5 py-1.5 rounded-lg font-semibold ${
                                    p.hasTryhardBadge
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-slate-800 text-amber-300'
                                  }`}
                                >
                                  {p.hasTryhardBadge ? '★ Has Badge' : '⭐ Give Badge'}
                                </button>
                                <button
                                  onClick={() => assignPlayerAndBadge(roomCode, p.id, null, false)}
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

                    <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-2.5">
                      <div>
                        <h4 className="font-bold text-sm text-indigo-400">
                          2. Available Students ({otherPlayers.length})
                        </h4>
                        <p className="text-xs text-slate-400">
                          Recruit students to your mission or send them to the Carpet side-quest.
                        </p>
                      </div>

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
                                onClick={() => assignPlayerAndBadge(roomCode, p.id, myTask.taskId, false)}
                                className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold"
                              >
                                + Add to Team
                              </button>
                              {room.phase === 1 && (
                                <button
                                  onClick={() => assignPlayerAndBadge(roomCode, p.id, 'CARPET', false)}
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

                {/* ÉTAPE 3 & 4 : THE MORNING CUT */}
                {room.step === '3_THE_GRIND' && (
                  <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-indigo-400">Your Team&apos;s Card Submissions</h4>
                      <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                        {myTeamPlayers.map((p) => (
                          <span
                            key={p.id}
                            className={`px-2 py-1 rounded border ${
                              p.hasSubmitted
                                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                                : 'bg-slate-950 border-slate-700 text-slate-400'
                            }`}
                          >
                            {p.name}: {p.hasSubmitted ? '✓ Ready' : '⏳ Thinking...'}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <h4 className="text-sm font-bold text-amber-400">Step 4: Your Secret Morning Cut</h4>
                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          onClick={() => submitMorningChoice(roomCode, myTask.taskId, 'FOCUS_QUADRA')}
                          className={`w-full py-3 rounded-xl font-bold text-xs border-2 ${
                            myTask.morningChoice === 'FOCUS_QUADRA'
                              ? 'bg-indigo-600 border-white text-white'
                              : 'bg-slate-950 border-indigo-800 text-indigo-300'
                          }`}
                        >
                          {myTask.morningChoice === 'FOCUS_QUADRA' ? '✓ Selected: Focus Quadra (No Theft)' : 'Focus Quadra (Leave Pile Untouched)'}
                        </button>
                        <button
                          onClick={() => submitMorningChoice(roomCode, myTask.taskId, 'STEAL_FOR_MORNING')}
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
                  </div>
                )}

                {/* ÉTAPE 6 : TRIBUNAL */}
                {room.step === '6_TRIBUNAL' && myTask.auditedResult && (
                  <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                    <div className="p-2.5 bg-slate-950 border border-indigo-800 rounded-lg text-xs">
                      <strong>Announced by Soubeyran:</strong> {myTask.auditedResult.announcedWork} Work, {myTask.auditedResult.announcedChill} Chill, {myTask.auditedResult.announcedSabotage} Sabotage (Net: {myTask.auditedResult.netScore})
                    </div>
                    <h4 className="text-xs font-bold text-amber-400">
                      Step 6: Strikes remaining for your team: {myTask.auditedResult.maxStrikesAllowed - myTask.auditedResult.strikesGivenThisTurn}
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
                                setError('');
                                await issueStrike(roomCode, myTask.taskId, p.id);
                              } catch (e: any) {
                                setError(e.message);
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
          })()}
        </div>
      )}

      {/* ==================== VUE 5 : PRÉTENDANT, SLACKER & ESPION ==================== */}
      {room.status === 'IN_PROGRESS' &&
        me &&
        ['TRUE_APPLICANT', 'SLACKER', 'TELECOM_SPY'].includes(me.role) && (
          <div className="flex flex-col gap-3">
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center gap-2">
              <div>
                <h2 className="font-bold text-base">{me.name}</h2>
                <p className="text-xs text-slate-400">
                  Strikes: {me.strikes}/2 {me.hasTryhardBadge ? '• ⭐ Play 2 cards!' : ''}
                </p>
              </div>
              <button
                onClick={() => setShowSecretRole(!showSecretRole)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono shrink-0"
              >
                {showSecretRole ? `ROLE: ${me.role}` : 'Tap for Role'}
              </button>
            </div>

            {me.isExcluded ? (
              <div className="p-5 bg-red-950/40 border border-red-800 rounded-xl text-center text-xs">
                You received 2 Strikes and have been excluded from the Quadrabang preparation.
              </div>
            ) : (
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex flex-col gap-3">
                <div className="text-xs">
                  Assigned Mission:{' '}
                  <strong className="text-indigo-300">
                    {getAssignmentLabel(me.assignedTaskId)}
                  </strong>
                </div>

                {room.step === '3_THE_GRIND' && (
                  <div className="space-y-3">
                    {me.hasSubmitted ? (
                      <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl text-center text-xs">
                        ✓ Card(s) submitted to Soubeyran! Waiting for {waitingForCardsPlayers.length} player(s)...
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-300">
                          Tap <strong>{me.hasTryhardBadge ? 2 : 1}</strong> card(s) to play face-down:
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                          {(me.hand || []).map((card, idx) => {
                            const isSelected = selectedIndices.includes(idx);
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedIndices(selectedIndices.filter((i) => i !== idx));
                                  } else {
                                    setSelectedIndices([...selectedIndices, idx]);
                                  }
                                }}
                                className={`py-6 rounded-xl font-bold text-sm border-2 transition ${
                                  isSelected
                                    ? 'border-indigo-400 bg-indigo-950 text-white scale-[1.02]'
                                    : 'border-slate-700 bg-slate-950 text-slate-300'
                                }`}
                              >
                                {card}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={handlePlayCards}
                          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-sm"
                        >
                          Submit Selected Card(s)
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white bg-slate-950 min-h-screen">Loading Quadrabang...</div>}>
      <RoomContent />
    </Suspense>
  );
}
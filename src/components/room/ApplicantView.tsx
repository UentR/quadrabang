// src/components/room/ApplicantView.tsx
'use client';

import { useState } from 'react';
import { ActionCardType, Player, RoomState } from '../../types/game';
import { submitActionCards } from '../../lib/gameEngine';

interface ApplicantViewProps {
  room: RoomState;
  me: Player;
  getAssignmentLabel: (taskId: string | 'CARPET' | null | undefined) => string;
  onError: (msg: string) => void;
}

export default function ApplicantView({
  room,
  me,
  getAssignmentLabel,
  onError,
}: ApplicantViewProps) {
  const [showRole, setShowRole] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const toggleCard = (idx: number) => {
    if (selectedIndices.includes(idx)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== idx));
    } else {
      setSelectedIndices([...selectedIndices, idx]);
    }
  };

  const handlePlayCards = async () => {
    if (!me.hand) return;
    const requiredCount = me.hasTryhardBadge ? 2 : 1;
    if (selectedIndices.length !== requiredCount) {
      return onError(`You must select exactly ${requiredCount} card(s) to play.`);
    }
    try {
      onError('');
      const played: ActionCardType[] = [];
      let discarded: ActionCardType = 'CHILL';
      me.hand.forEach((card, idx) => {
        if (selectedIndices.includes(idx)) played.push(card);
        else discarded = card;
      });
      await submitActionCards(room.roomCode, me.id, played, discarded);
      setSelectedIndices([]);
    } catch (e: any) {
      onError(e.message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex justify-between items-center gap-2">
        <div>
          <h2 className="font-bold text-base">{me.name}</h2>
          <p className="text-xs text-slate-400">
            Strikes: {me.strikes}/2 {me.hasTryhardBadge ? '• ⭐ Play 2 cards!' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowRole(!showRole)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono"
        >
          {showRole ? `ROLE: ${me.role}` : 'Tap for Role'}
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
            <strong className="text-indigo-300">{getAssignmentLabel(me.assignedTaskId)}</strong>
          </div>

          {room.step === '3_THE_GRIND' && (
            <div className="space-y-3">
              {me.hasSubmitted ? (
                <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl text-center text-xs">
                  ✓ Card(s) submitted face-down to Soubeyran!
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
                          onClick={() => toggleCard(idx)}
                          className={`py-6 rounded-xl font-bold text-sm border-2 transition ${
                            isSelected
                              ? 'border-indigo-400 bg-indigo-950 text-white'
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
  );
}
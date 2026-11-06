// app/room/[code]/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../src/lib/firebase';
import { RoomState } from '../../../src/types/game';
import RulesModal from '../../../src/components/RulesModal';
import RoomHeader from '../../../src/components/room/RoomHeader';
import LobbyView from '../../../src/components/room/LobbyView';
import SoubeyranView from '../../../src/components/room/SoubeyranView';
import Board2AView from '../../../src/components/room/Board2AView';
import ApplicantView from '../../../src/components/room/ApplicantView';
import GameOverView from '../../../src/components/room/GameOverView';

function RoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = params.code as string;
  const currentPid = searchParams.get('pid') || '';

  const [room, setRoom] = useState<RoomState | null>(null);
  const [activePid, setActivePid] = useState<string>(currentPid);
  const [error, setError] = useState<string>('');
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!roomCode) return;
    const roomRef = ref(db, `rooms/${roomCode}`);
    return onValue(roomRef, (snap) => {
      if (snap.exists()) setRoom(snap.val());
    });
  }, [roomCode]);

  if (!room) {
    return <div className="p-6 text-white bg-slate-950 min-h-screen">Loading room {roomCode}...</div>;
  }

  const me = room.players[activePid];

  const getAssignmentLabel = (taskId: string | 'CARPET' | null | undefined) => {
    if (!taskId) return 'Unassigned';
    if (taskId === 'CARPET') return 'Eiffel & Bouygues Carpet';
    const task = room.activeTasks?.[taskId];
    if (!task) return 'Unassigned';
    const ownerName = room.players[task.board2APlayerId]?.name || '2A';
    return `${task.cardDetails.title} (${ownerName})`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white px-3 py-3 pb-16 max-w-lg mx-auto flex flex-col gap-3">
      <RoomHeader
        room={room}
        activePid={activePid}
        onSelectPid={(pid) => {
          setActivePid(pid);
          setError('');
        }}
        onOpenRules={() => setIsRulesOpen(true)}
      />

      {error && (
        <div className="p-3 bg-red-900/60 border border-red-700 rounded-xl text-xs text-red-200 font-medium">
          {error}
        </div>
      )}

      {room.status === 'LOBBY' && <LobbyView room={room} me={me} />}
      {room.status === 'FINISHED' && <GameOverView room={room} />}

      {room.status === 'IN_PROGRESS' && me?.role === 'SOUBEYRAN' && (
        <SoubeyranView room={room} />
      )}

      {room.status === 'IN_PROGRESS' && me?.role === 'BOARD_2A' && (
        <Board2AView
          room={room}
          me={me}
          getAssignmentLabel={getAssignmentLabel}
          onError={setError}
        />
      )}

      {room.status === 'IN_PROGRESS' &&
        me &&
        ['TRUE_APPLICANT', 'SLACKER', 'TELECOM_SPY'].includes(me.role) && (
          <ApplicantView
            room={room}
            me={me}
            getAssignmentLabel={getAssignmentLabel}
            onError={setError}
          />
        )}

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
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
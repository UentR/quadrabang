// app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createRoom, joinRoom } from '../src/lib/gameEngine';
import RulesModal from '../src/components/RulesModal';

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return setError('Please enter your name');
    try {
      const hostId = 'user_' + Math.random().toString(36).substring(2, 8);
      const code = await createRoom(hostId, name.trim());
      router.push(`/room/${code}?pid=${hostId}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleJoin = async () => {
    if (!name.trim() || !roomCode.trim()) {
      return setError('Please enter your name and a 4-letter room code');
    }
    try {
      const code = roomCode.trim().toUpperCase();
      const playerId = 'user_' + Math.random().toString(36).substring(2, 8);
      await joinRoom(code, playerId, name.trim());
      router.push(`/room/${code}?pid=${playerId}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold tracking-wide">QUADRABANG</h1>
          <p className="text-slate-400 text-xs">Behind the Scenes — Social Deduction Game</p>
          <button
            onClick={() => setIsRulesOpen(true)}
            className="mt-1 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs font-semibold text-indigo-300"
          >
            📖 Read Game Rules
          </button>
        </div>

        {error && <div className="p-3 bg-red-900/50 text-red-200 text-xs rounded-lg">{error}</div>}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-300 font-medium">Your Name / Nickname</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Thomas"
            className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm"
          />
        </div>

        <button
          onClick={handleCreate}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-sm"
        >
          Create Room (Play as Soubeyran)
        </button>

        <div className="border-t border-slate-800" />

        <div className="flex flex-col gap-3">
          <input
            type="text"
            maxLength={4}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="4-LETTER ROOM CODE"
            className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-center font-mono tracking-widest uppercase text-sm"
          />
          <button
            onClick={handleJoin}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm"
          >
            Join Room (Play as Student)
          </button>
        </div>
      </div>

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}
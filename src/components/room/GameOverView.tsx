// src/components/room/GameOverView.tsx
'use client';

import { RoomState } from '../../types/game';

interface GameOverViewProps {
  room: RoomState;
}

export default function GameOverView({ room }: GameOverViewProps) {
  const allPlayers = Object.values(room.players);

  return (
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
  );
}
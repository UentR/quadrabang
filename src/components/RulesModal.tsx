// src/components/RulesModal.tsx
'use client';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-lg text-indigo-400">📖 Quadrabang — Official Rules</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold text-white"
          >
            ✕ Close
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          <section className="space-y-1">
            <h3 className="font-bold text-sm text-white">1. Roles & Secret Agendas</h3>
            <p>• <strong className="text-indigo-300">Soubeyran (GM):</strong> Represents the Administration, audits piles, and announces results.</p>
            <p>• <strong className="text-emerald-300">2A Board (Public):</strong> Assigns teams, awards ⭐ Teacher&apos;s Pet badges, issues Strikes, and secretly steals Work for Saturday&apos;s Morning party.</p>
            <p>• <strong className="text-sky-300">True Applicants (Secret):</strong> Must validate the party and cleanup. <strong>Obligation:</strong> You MUST play a WORK card if you draw one.</p>
            <p>• <strong className="text-amber-300">Slackers (Secret):</strong> Want the party to succeed while reaching the secret Chill Counter threshold without getting excluded.</p>
            <p>• <strong className="text-red-300">Telecom Spies (Secret):</strong> Win if the party is canceled on Friday 23h, drops to 0 at night, or fails Saturday Cleanup.</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-bold text-sm text-white">2. Turn Sequence (6 Steps)</h3>
            <p><strong>1. Dispatch:</strong> 2As assign players to their Task or to the Eiffel & Bouygues Carpet side-quest.</p>
            <p><strong>2. Teacher&apos;s Pet ⭐:</strong> Each 2A gives 1 badge to a trusted member (draws 3 cards, plays 2).</p>
            <p><strong>3. The Grind:</strong> Players draw 2 cards (3 with badge) from the 60-card deck (30 Work, 18 Chill, 12 Sabotage) and play 1 face-down (2 with badge).</p>
            <p><strong>4. The Morning Cut:</strong> Each 2A secretly chooses <em>Focus Quadra</em> or <em>Steal for Morning</em> (converts 1 Work in their pile into 1 announced Chill!).</p>
            <p><strong>5. Soubeyran&apos;s Audit:</strong> Net Score = Work − Sabotage. Soubeyran announces the result aloud.</p>
            <p><strong>6. The Tribunal:</strong> Debate in English! 2As may issue Strikes (max = Chill + Sabotage in pile). 2 Strikes = Exclusion (-3 pts HR penalty if innocent!).</p>
          </section>

          <section className="space-y-1">
            <h3 className="font-bold text-sm text-white">3. The 3 Phases (9 Turns)</h3>
            <p>• <strong>Phase 1 — Build-Up (Turns 1–5):</strong> Meet task quotas (+2 pts +1/extra Work) and finish the Carpet side-quest (or suffer -5 pts) to reach the Quadra Target by Friday 23h.</p>
            <p>• <strong>Phase 2 — Quadra Night (Turns 6–8):</strong> Beat emergency Crises to avoid losing points.</p>
            <p>• <strong>Phase 3 — Cleanup (Turn 9):</strong> Score enough Net Work to match the number of active players before Saturday 14h (The Morning Verdict).</p>
          </section>
        </div>
      </div>
    </div>
  );
}
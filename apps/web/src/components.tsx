import type { ReactNode } from 'react';
import type { HomeCandidate, SoulCandidate } from '@infinite-stellar/game-sdk';

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-orbit" />
      <span className="brand-star">✦</span>
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function SoulSigil({ soul, selected = false }: { soul: SoulCandidate; selected?: boolean }) {
  return (
    <div className={`soul-sigil soul-${soul.visualClass} ${selected ? 'is-selected' : ''}`}>
      <span className="soul-ring soul-ring-one" />
      <span className="soul-ring soul-ring-two" />
      <span className="soul-core">{soul.name.slice(0, 1)}</span>
    </div>
  );
}

export function PlanetVisual({ candidate, active = false }: { candidate?: HomeCandidate; active?: boolean }) {
  const className = candidate?.planetClass.toLowerCase() ?? 'unknown';
  return (
    <div className={`planet-visual planet-${className} ${active ? 'is-active' : ''}`} aria-hidden="true">
      <span className="planet-halo" />
      <span className="planet-body">
        <span className="planet-sheen" />
      </span>
      <span className="planet-orbit orbit-one" />
      <span className="planet-orbit orbit-two" />
    </div>
  );
}

export function ShortAddress({ address }: { address?: string }) {
  if (!address) return <span>Not connected</span>;
  return <span title={address}>{`${address.slice(0, 6)}…${address.slice(-4)}`}</span>;
}

export function StepRail({ active }: { active: number }) {
  const steps = ['Bind Soul', 'Create Seat', 'Find First Light', 'Awaken'];
  return (
    <ol className="step-rail" aria-label="Activation progress">
      {steps.map((step, index) => (
        <li key={step} className={index < active ? 'is-complete' : index === active ? 'is-active' : ''}>
          <span className="step-index">{index < active ? '✓' : index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'live' | 'warn' }) {
  return <span className={`status-pill status-${tone}`}>{children}</span>;
}

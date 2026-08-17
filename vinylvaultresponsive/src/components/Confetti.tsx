import React, { useEffect, useState } from "react";

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  rotation: number;
  delay: number;
}

const COLORS = ["#A94A42", "#8FA89B", "#D4AF37", "#2D4A3E", "#C85A32", "#1D4ED8", "#10B981"];

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: Math.random() * Math.PI * 2,
    distance: 90 + Math.random() * 110,
    size: 5 + Math.random() * 6,
    color: COLORS[i % COLORS.length],
    rotation: Math.random() * 360,
    delay: Math.random() * 60,
  }));
}

interface ConfettiProps {
  // Increment this number from the parent whenever a burst should fire.
  trigger: number;
}

export const Confetti: React.FC<ConfettiProps> = ({ trigger }) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setParticles(makeParticles(22));
    const timeout = setTimeout(() => setParticles([]), 900);
    return () => clearTimeout(timeout);
  }, [trigger]);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[65] pointer-events-none flex items-start justify-center">
      <div className="relative top-24 w-0 h-0">
        {particles.map((p) => {
          const tx = Math.cos(p.angle) * p.distance;
          const ty = Math.sin(p.angle) * p.distance;
          return (
            <span
              key={p.id}
              className="absolute rounded-sm"
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                left: 0,
                top: 0,
                animation: `confettiBurst 0.85s cubic-bezier(0.16, 1, 0.3, 1) ${p.delay}ms forwards`,
                // @ts-ignore custom properties
                "--tx": `${tx}px`,
                "--ty": `${ty}px`,
                "--rot": `${p.rotation}deg`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

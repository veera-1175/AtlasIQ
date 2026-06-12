import { useMemo } from "react";

interface Flake {
  id: number;
  left: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
  spin: number;
}

const COUNT = 72;

function buildFlakes(): Flake[] {
  return Array.from({ length: COUNT }, (_, id) => ({
    id,
    left: Math.random() * 100,
    size: 6 + Math.random() * 8,
    opacity: 0.35 + Math.random() * 0.5,
    duration: 12 + Math.random() * 20,
    delay: Math.random() * -24,
    drift: -28 + Math.random() * 56,
    spin: 180 + Math.random() * 360,
  }));
}

function SnowflakeShape({ size }: { size: number }) {
  const arm = (
    <g>
      <line x1="12" y1="1" x2="12" y2="23" />
      <line x1="12" y1="5" x2="9.5" y2="7.5" />
      <line x1="12" y1="5" x2="14.5" y2="7.5" />
      <line x1="12" y1="9" x2="10" y2="10.5" />
      <line x1="12" y1="9" x2="14" y2="10.5" />
      <line x1="12" y1="19" x2="9.5" y2="16.5" />
      <line x1="12" y1="19" x2="14.5" y2="16.5" />
    </g>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="snowflake-shape"
      aria-hidden
    >
      {[0, 60, 120].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 12 12)`}>
          {arm}
        </g>
      ))}
    </svg>
  );
}

export default function Snowfall() {
  const flakes = useMemo(buildFlakes, []);

  return (
    <div className="snowfall pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {flakes.map((f) => (
        <span
          key={f.id}
          className="snowflake"
          style={{
            left: `${f.left}%`,
            ["--flake-opacity" as string]: String(f.opacity),
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            ["--drift" as string]: `${f.drift}px`,
            ["--spin" as string]: `${f.spin}deg`,
          }}
        >
          <SnowflakeShape size={f.size} />
        </span>
      ))}
    </div>
  );
}

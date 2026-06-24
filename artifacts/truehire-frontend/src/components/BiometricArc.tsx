/**
 * BiometricArc — the signature visual element of TrueHire AI.
 *
 * An SVG arc ring that wraps the webcam feed and visually encodes
 * the live suspicion score:
 *
 *   Low  (0-33)  : Complete ring, sapphire-indigo glow — calm, trusted
 *   Med  (34-66) : Ring breaks into 2 arcs, shifts amber — attention
 *   High (67-100): 3 short fragments, red, pulsing — flagged
 *
 * Arc coverage decreases continuously as score rises (92% → 28%).
 * The number of arcs jumps at each band boundary.
 */

interface BiometricArcProps {
  score: number;
  className?: string;
}

const R = 90;
const CX = 100;
const CY = 100;
const CIRCUMFERENCE = 2 * Math.PI * R; // ≈ 565.5

const COLORS = {
  low: '#4F6AF7',
  medium: '#F59E0B',
  high: '#EF4444',
} as const;

const GLOWS = {
  low: 'drop-shadow(0 0 6px rgba(79,106,247,0.9)) drop-shadow(0 0 18px rgba(79,106,247,0.35))',
  medium: 'drop-shadow(0 0 6px rgba(245,158,11,0.9)) drop-shadow(0 0 14px rgba(245,158,11,0.35))',
  high: 'drop-shadow(0 0 6px rgba(239,68,68,0.9)) drop-shadow(0 0 14px rgba(239,68,68,0.35))',
};

type Band = 'low' | 'medium' | 'high';

function getBand(score: number): Band {
  if (score <= 33) return 'low';
  if (score <= 66) return 'medium';
  return 'high';
}

export default function BiometricArc({ score, className }: BiometricArcProps) {
  const band = getBand(score);

  // Coverage decreases linearly: 0.92 at score=0, 0.28 at score=100
  const coverage = 0.92 - (Math.min(100, Math.max(0, score)) / 100) * 0.64;

  // Number of arc segments per band
  const numArcs = band === 'low' ? 1 : band === 'medium' ? 2 : 3;

  const totalArcLen = coverage * CIRCUMFERENCE;
  const totalGapLen = (1 - coverage) * CIRCUMFERENCE;
  const arcLen = totalArcLen / numArcs;
  const gapLen = totalGapLen / numArcs;

  const dashArray = `${arcLen.toFixed(1)} ${gapLen.toFixed(1)}`;
  const color = COLORS[band];
  const glow = GLOWS[band];

  // Offset so the arc starts from the top (-90°)
  // strokeDashoffset shifts the start position within the dash pattern
  const dashOffset = 0;

  return (
    <svg
      viewBox="0 0 200 200"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className ?? ''}`}
      aria-hidden="true"
    >
      {/* Subtle background halo */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        stroke={color}
        strokeWidth={12}
        fill="none"
        opacity={0.06}
        style={{ transition: 'stroke 0.9s ease' }}
      />

      {/* Tick marks at 12 o'clock positions */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle - 90) * (Math.PI / 180);
        const x1 = CX + (R - 7) * Math.cos(rad);
        const y1 = CY + (R - 7) * Math.sin(rad);
        const x2 = CX + (R + 7) * Math.cos(rad);
        const y2 = CY + (R + 7) * Math.sin(rad);
        return (
          <line
            key={angle}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={1.5}
            opacity={0.3}
            strokeLinecap="round"
            style={{ transition: 'stroke 0.9s ease' }}
          />
        );
      })}

      {/* Active arc(s) */}
      <circle
        cx={CX}
        cy={CY}
        r={R}
        stroke={color}
        strokeWidth={3.5}
        fill="none"
        strokeDasharray={dashArray}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{
          filter: glow,
          transition: 'stroke-dasharray 0.85s ease, stroke 0.85s ease, filter 0.85s ease',
          transformOrigin: `${CX}px ${CY}px`,
          transform: 'rotate(-90deg)',
          animation: band === 'high' ? 'arc-pulse 1.4s ease-in-out infinite' : 'none',
        }}
      />
    </svg>
  );
}

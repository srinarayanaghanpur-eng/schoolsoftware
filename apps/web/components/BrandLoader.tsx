/**
 * Full-screen Sri Narayana branded loading screen.
 * 8-point star logo (spinning), gold "SRI" mark, on the school's deep-navy.
 */
export function BrandLoader({ message = "Loading…" }: { message?: string }) {
  const starPoints = "200,50 234,166 350,200 234,234 200,350 166,234 50,200 166,166";
  return (
    <div className="grid min-h-screen place-items-center" style={{ background: "#0c1334" }}>
      <div className="bl-wrap">
        <svg className="bl-logo" viewBox="0 0 400 400" width="168" height="168" role="img" aria-label="Sri Narayana High School">
          {/* faint guide ring + spinning highlight arc */}
          <circle cx="200" cy="200" r="184" fill="none" stroke="#e6cd8b" strokeOpacity="0.16" strokeWidth="2.5" />
          <circle className="bl-arc" cx="200" cy="200" r="184" fill="none" stroke="#e6cd8b" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="70 1200" />
          {/* slowly rotating 8-point star */}
          <g className="bl-star" fill="#5b7bd8">
            <polygon points={starPoints} />
            <polygon points={starPoints} transform="rotate(45 200 200)" />
          </g>
          {/* fixed center medallion */}
          <circle cx="200" cy="200" r="46" fill="#0c1334" />
          <text x="200" y="216" textAnchor="middle" fontFamily="Cinzel, Georgia, serif" fontWeight={600} fontSize={40} fill="#e6cd8b">SRI</text>
        </svg>
        <p className="bl-title">SRI NARAYANA HIGH SCHOOL</p>
        <p className="bl-msg">{message}<span className="bl-dots" /></p>
      </div>
    </div>
  );
}

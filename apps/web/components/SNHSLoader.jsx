"use client";

import "./SNHSLoader.css";

const DEFAULT_LOADER_TEXT = "SNHS";

export default function SNHSLoader({
  text = DEFAULT_LOADER_TEXT,
  erpName = "SNHS ERP",
  subtitle = "Sri Narayana High School ERP",
  schoolName = "Sri Narayana High School",
  message = "Loading",
  logoSrc = "/sri-narayana-high-school-logo.jpg",
  fullScreen = true,
  className = ""
}) {
  const letters = Array.from(text || DEFAULT_LOADER_TEXT);
  const rootClassName = [
    "snhs-loader",
    fullScreen ? "snhs-loader--fullscreen" : "snhs-loader--inline",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClassName} aria-label={`${erpName} loading screen`}>
      <div className="snhs-loader__surface" role="status" aria-live="polite">
        <div className="snhs-loader__product-mark">
          <span className="snhs-loader__product-dot" aria-hidden="true" />
          <span>{erpName}</span>
        </div>

        <div className="snhs-loader__badge-stage" aria-hidden="true">
          <div className="snhs-loader__logo-glow" />
          <div className="snhs-loader__outer-ring" />
          <div className="snhs-loader__inner-ring" />

          <div className="snhs-loader__badge-frame">
            <div className="snhs-loader__badge-core">
              <span className="snhs-loader__logo-fallback">SN</span>
              {logoSrc ? (
                <img
                  className="snhs-loader__logo"
                  src={logoSrc}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.style.opacity = "0";
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>

        <h1 className="snhs-loader__title" aria-label={text}>
          {letters.map((letter, index) => (
            <span
              className="snhs-loader__letter"
              style={{ "--snhs-letter-index": index }}
              aria-hidden="true"
              key={`${letter}-${index}`}
            >
              {letter === " " ? "\u00A0" : letter}
            </span>
          ))}
        </h1>

        <p className="snhs-loader__subtitle">{subtitle || schoolName}</p>

        <div className="snhs-loader__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="snhs-loader__progress" aria-hidden="true">
          <span className="snhs-loader__progress-fill" />
        </div>

        <span className="snhs-loader__sr-only">{message}</span>
      </div>
    </section>
  );
}

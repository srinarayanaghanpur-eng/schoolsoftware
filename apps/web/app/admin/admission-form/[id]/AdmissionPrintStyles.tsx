// Page + print CSS for the admission form (extracted from page.tsx).
// `global` is required: styled-jsx scopes to the rendering component, and
// these selectors target markup that lives in page.tsx / AdmissionPrintSheet.
// The `af-` prefix is used by this route alone, so nothing leaks.

export default function AdmissionPrintStyles() {
  return <style jsx global>{`
        /* ---------- Page Root ---------- */
        .af-page-root {
          min-height: 100vh;
          background: #eef0f7;
          font-family: Arial, "Helvetica Neue", sans-serif;
          padding-bottom: 80px;
        }

        /* ---------- Loading ---------- */
        .af-loading {
          display: flex;
          min-height: 100vh;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: #eef0f7;
          color: #475569;
          font-size: 14px;
          font-weight: 600;
        }
        .af-loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #d7deeb;
          border-top-color: #3033a1;
          border-radius: 50%;
          animation: af-spin 0.7s linear infinite;
        }
        @keyframes af-spin {
          to {
            transform: rotate(360deg);
          }
        }
        .af-error-text {
          color: #ed515d;
          font-size: 16px;
          font-weight: 700;
        }
        .af-back-btn {
          padding: 8px 18px;
          background: #3033a1;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
        }
        .af-back-btn:hover {
          background: #272a86;
        }

        /* ---------- Action Bar ---------- */
        .af-action-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          background: #ffffff;
          border-bottom: 1px solid #d7deeb;
          padding: 10px 24px;
          flex-wrap: wrap;
        }
        .af-action-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .af-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid #d7deeb;
          border-radius: 8px;
          background: #fff;
          color: #1f2937;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .af-action-btn:hover {
          background: #f4f5fb;
          border-color: #c7d1ec;
        }
        .af-action-back {
          color: #3033a1;
          border-color: #d7deeb;
        }
        .af-action-print {
          background: #3033a1;
          color: #fff;
          border-color: #3033a1;
        }
        .af-action-print:hover {
          background: #272a86;
        }
        .af-action-download {
          background: #0d8f5b;
          color: #fff;
          border-color: #0d8f5b;
        }
        .af-action-download:hover {
          background: #0a7a4d;
        }

        /* ---------- A4 Wrapper ---------- */
        .af-a4-wrapper {
          display: flex;
          justify-content: center;
          padding: 32px 16px;
        }
        .af-a4-sheet {
          width: 210mm;
          min-height: 297mm;
          background: #ffffff;
          box-shadow: 0 4px 24px rgba(15, 23, 42, 0.12);
          padding: 14mm 12mm 8mm;
          color: #172033;
          line-height: 1.3;
          position: relative;
        }

        /* ---------- Header ---------- */
        .af-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          border: 1.5px solid #1f2f8d;
          padding: 10px 14px;
        }
        .af-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
          min-width: 0;
        }
        .af-logo {
          width: 60px;
          height: 60px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .af-logo img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .af-school-info {
          flex: 1;
          min-width: 0;
        }
        .af-school-name {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 0.03em;
          margin: 0 0 3px;
          color: #1f2f8d;
        }
        .af-school-address {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          margin: 1px 0;
        }
        .af-school-contact {
          font-size: 10px;
          font-weight: 700;
          color: #475569;
          margin: 2px 0 0;
        }
        .af-photo-box {
          width: 88px;
          height: 100px;
          flex-shrink: 0;
          border: 2px dashed #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .af-photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .af-photo-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 10px;
          font-weight: 800;
          line-height: 1.2;
        }

        /* ---------- Title ---------- */
        .af-title-bar {
          background: #1f2f8d;
          color: #ffffff;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.06em;
          text-align: center;
          padding: 8px 10px;
          margin: 10px 0 0;
        }
        .af-title-sub {
          text-align: center;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          color: #1f2f8d;
          padding: 4px 10px 0;
        }

        /* ---------- Top Strip ---------- */
        .af-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 8px;
        }
        .af-strip-item {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #e2e8f0;
          padding: 5px 8px;
          min-height: 32px;
        }
        .af-strip-label {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }
        .af-strip-value {
          font-size: 12px;
          font-weight: 800;
          color: #111827;
        }

        /* ---------- Form Section ---------- */
        .af-section {
          border: 1px solid #d7deeb;
          margin-top: 8px;
          break-inside: avoid;
        }
        .af-section-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #eef2ff;
          border-bottom: 1px solid #d7deeb;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 900;
          color: #1f2f8d;
          letter-spacing: 0.04em;
        }
        .af-section-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #1f2f8d;
          color: #fff;
          font-size: 10px;
          font-weight: 900;
          flex-shrink: 0;
        }

        /* ---------- Grid ---------- */
        .af-grid {
          display: grid;
          gap: 6px;
          padding: 6px;
        }
        .af-grid-2 {
          grid-template-columns: repeat(2, 1fr);
        }
        .af-grid-3 {
          grid-template-columns: repeat(3, 1fr);
        }

        /* ---------- Field ---------- */
        .af-field {
          border: 1px solid #e2e8f0;
          padding: 5px 7px;
          min-height: 38px;
        }
        .af-field-wide {
          grid-column: span 2;
        }
        .af-label {
          display: block;
          font-size: 8.5px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 2px;
        }
        .af-value {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: #111827;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        /* ---------- Checklist ---------- */
        .af-checklist-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px 12px;
          padding: 8px 10px;
        }
        .af-check-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: default;
          font-size: 10px;
          font-weight: 700;
          color: #1f2937;
        }
        .af-check-box {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 15px;
          height: 15px;
          border: 1.5px solid #475569;
          flex-shrink: 0;
          background: #fff;
        }
        .af-check-tick {
          font-size: 11px;
          font-weight: 900;
          color: #0d8f5b;
          line-height: 1;
        }
        .af-check-label {
          line-height: 1.2;
        }
        .af-other-docs {
          display: flex;
          gap: 8px;
          padding: 2px 10px 10px;
          font-size: 10px;
          font-weight: 700;
          color: #1f2937;
        }
        .af-other-docs-label {
          white-space: nowrap;
        }
        .af-other-docs-value {
          font-weight: 800;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        /* ---------- Declaration ---------- */
        .af-office-note {
          font-size: 10px;
          font-style: italic;
          font-weight: 600;
          color: #64748b;
          margin: 0 0 8px 0;
        }
        .af-declaration-box {
          padding: 10px 12px;
        }
        .af-declaration-text {
          font-size: 10.5px;
          font-weight: 600;
          color: #334155;
          margin: 0;
          line-height: 1.6;
        }

        /* ---------- Signatures ---------- */
        .af-signatures {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          padding: 14px 12px 10px;
        }
        .af-signature {
          text-align: center;
        }
        .af-signature-line {
          height: 1px;
          border-top: 1.5px solid #475569;
          margin-bottom: 6px;
        }
        .af-signature-title {
          font-size: 9.5px;
          font-weight: 800;
          color: #475569;
        }

        /* ---------- Office Use ---------- */
        .af-office-note {
          font-size: 10px;
          color: #64748b;
          font-weight: 700;
          padding: 4px 10px 8px;
        }

        /* ---------- Footer ---------- */
        .af-footer {
          margin-top: 14px;
          padding-top: 6px;
          border-top: 1px solid #d7deeb;
          text-align: center;
        }
        .af-footer-text {
          font-size: 8px;
          font-weight: 600;
          color: #94a3b8;
        }

        /* =============== Print Styles =============== */
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .af-page-root {
            background: #fff !important;
            padding: 0 !important;
            min-height: auto !important;
          }

          .af-action-bar {
            display: none !important;
          }

          .af-a4-wrapper {
            padding: 0 !important;
            display: block !important;
          }

          .af-a4-sheet {
            width: 100% !important;
            min-height: auto !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .af-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .af-check-box {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-check-tick {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-section-heading {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-section-number {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-title-bar {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .af-header {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide non-form elements globally during print */
          nav,
          header,
          aside,
          .no-print {
            display: none !important;
          }
        }

        /* =============== Responsive =============== */
        @media (max-width: 900px) {
          .af-a4-sheet {
            width: 100%;
            min-height: auto;
            padding: 20px 14px;
            box-shadow: none;
          }
          .af-strip {
            grid-template-columns: 1fr;
          }
          .af-grid-3 {
            grid-template-columns: repeat(2, 1fr);
          }
          .af-checklist-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .af-signatures {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .af-school-name {
            font-size: 17px;
          }
          .af-photo-box {
            width: 70px;
            height: 80px;
          }
        }

        @media (max-width: 600px) {
          .af-grid-3,
          .af-grid-2 {
            grid-template-columns: 1fr;
          }
          .af-grid-3 {
            grid-template-columns: 1fr;
          }
          .af-field-wide {
            grid-column: span 1;
          }
          .af-header {
            flex-direction: column;
            align-items: stretch;
          }
          .af-header-left {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .af-photo-box {
            align-self: center;
          }
          .af-checklist-grid {
            grid-template-columns: 1fr 1fr;
          }
          .af-action-bar {
            flex-direction: column;
            align-items: stretch;
            padding: 10px 12px;
          }
          .af-action-right {
            justify-content: stretch;
          }
          .af-action-btn {
            flex: 1;
            justify-content: center;
          }
          .af-strip {
            grid-template-columns: 1fr;
          }
        }
  `}</style>;
}

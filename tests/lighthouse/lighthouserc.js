module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm --workspace @sri-narayana/web run dev",
      url: [
        "http://localhost:3000/login",
        "http://localhost:3000/admin/dashboard",
        "http://localhost:3000/admin/students",
        "http://localhost:3000/admin/finance",
        "http://localhost:3000/admin/attendance",
      ],
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        onlyCategories: ["performance", "accessibility", "best-practices"],
      },
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        "categories:performance": ["warn", { minScore: 0.6 }],
        "categories:accessibility": ["warn", { minScore: 0.8 }],
        "categories:best-practices": ["warn", { minScore: 0.7 }],
        "largest-contentful-paint": ["warn", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["warn", { maxNumericValue: 0.25 }],
        "total-blocking-time": ["warn", { maxNumericValue: 500 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "./tests/reports/lighthouse",
    },
  },
};

// Recharts ships without its own types and @types/recharts is unavailable.
// One ambient declaration keeps `tsc --noEmit` (and CI type gates) green;
// runtime behavior is unchanged.
declare module "recharts";

type Token = { type: "number"; value: number } | { type: "op"; value: string };

const OPS: Record<string, (a: number, b: number) => number> = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "×": (a, b) => a * b,
  "÷": (a, b) => a / b,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const chars = input.replace(/\s/g, "");
  let num = "";
  for (const ch of chars) {
    if (/[0-9.]/.test(ch)) {
      num += ch;
    } else if (["+", "-", "×", "÷"].includes(ch)) {
      if (num) { tokens.push({ type: "number", value: parseFloat(num) }); num = ""; }
      tokens.push({ type: "op", value: ch });
    }
  }
  if (num) tokens.push({ type: "number", value: parseFloat(num) });
  return tokens;
}

export function evaluate(input: string): number {
  const tokens = tokenize(input);
  if (tokens.length === 0) return 0;
  if (tokens.length === 1 && tokens[0]?.type === "number") return tokens[0].value;

  let result = tokens[0]?.type === "number" ? tokens[0].value : 0;
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i];
    const num = tokens[i + 1];
    if (op?.type !== "op" || num?.type !== "number") break;
    const fn = OPS[op.value];
    if (fn) result = fn(result, num.value);
  }
  return result;
}

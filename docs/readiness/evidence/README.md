# Gate Evidence Template

Copy this file to `CN-<slug>.md` when a gate opens and fill it in.

```markdown
# Gate Cx — <name>

- Commit: <full sha>
- Date: <ISO date>
- Operator: <name / role>
- Environment: <local | staging | CI>
- Related gate owner: <name / role>

## Commands run

```
<exact commands, in order>
```

## Output

<CI run URL, or pasted summary of the output>

## Manual checks

| Check | Result | Notes |
|---|---|---|
| <check> | PASS / FAIL | |

## Defects raised

| ID | Severity | Summary |
|---|---|---|
| | | |

## Result

PASS | FAIL

## Sign-off

- Name / role:
- Date:
- Signature / approval reference:
```

## Rules

- Command output must be a CI run URL or pasted verbatim. Screenshots alone do
  not satisfy a build or test gate.
- A FAIL result keeps the gate open; fix and re-run, do not append a second
  result to the same file.
- Link defect IDs to `../DEFECTS.md` and deferrals to `../DEFERRED.md`.

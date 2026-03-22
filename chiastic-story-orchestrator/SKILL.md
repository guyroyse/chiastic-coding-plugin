---
name: chiastic-story-orchestrator
description: Orchestrates a TDD pair programming workflow from a Gherkin feature file. Use when given a .feature file to implement.
disable-model-invocation: true
argument-hint: <path-to-feature-file>
metadata:
  version: 0.1.0
  author: Guy Royse
---

# Story Orchestrator

You orchestrate a TDD pair programming workflow. You receive a Gherkin feature file, decompose it into behaviors, and drive a pair of agents through red/green/refactor cycles for each one.

## Process

1. Read the Gherkin feature file at the path provided: $ARGUMENTS
2. Decompose the scenarios into discrete behaviors to implement — a scenario may yield one or more tasks.
3. Create a task for each behavior using TaskCreate, with dependencies so they are worked in order.
4. For each behavior, in sequence:
   a. Update the task to in_progress.
   b. Run `pair.js` with the behavior description.
   c. Parse the JSON result from the last line of output. Handle based on the `status` field (see Handling results below).
5. When all tasks are complete, report a summary of what was built.

## Running the pair

Invoke the pair script from the skill directory:

```bash
${CLAUDE_SKILL_DIR}/scripts/pair.js --behavior "<behavior description>"
```

The script manages two agents (Alice and Bob) through red/green/refactor cycles. It returns when the test writer signals there are no more tests to write for the behavior, or when max cycles is reached.

The script logs progress to stdout as it runs (cycle numbers, agent turns, commit messages). You don't need to parse this — it's useful context if something goes wrong and you need to report to the user.

The script outputs a JSON result as its last line:

```json
{ "behavior": "...", "status": "complete", "commits": 3, "error": null }
```

The `status` field will be one of:

- `complete` — the behavior was fully implemented.
- `max-cycles` — the pair ran out of cycles without completing.
- `error` — the pair encountered a failure (see `error` field for details).

## Handling results

- **`complete`**: Update the task to completed and move on.
- **`max-cycles`**: Stop and report to the user. The behavior may need to be broken down further.
- **`error`**: Read the error message. A timeout or CLI crash is worth retrying once. A repeated failure suggests a deeper problem. You may retry, skip (noting the failure), or stop and report to the user.

## Behavior decomposition

Read the scenarios and break them into discrete behaviors to implement. A simple scenario might map to a single task. A complex scenario might need to be decomposed into multiple tasks that build on each other. Use your judgment.

Order tasks from simplest to most complex — this lets the pair build up the implementation incrementally. Start with the base case, then layer on complexity so each task builds on what came before.

## Writing behavior descriptions

The behavior description you pass to `pair.js` is the test writer's primary input. It should be:

- **Specific enough** to write tests from — "multiples of 3 return Fizz" not "handle multiples"
- **Scoped to one behavior** — one clear thing to test and implement
- **Stated as what the system should do** — not how it should be implemented
- **Independent of implementation details** — describe the expected input/output or side effect, not the code structure

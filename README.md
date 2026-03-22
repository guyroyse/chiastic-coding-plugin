# Chiastic Coding Plugin

> **Work in progress.** This plugin is under active development and not yet ready for general use. Expect breaking changes.

A [Claude Code](https://claude.ai/claude-code) plugin that orchestrates AI agents into Agile team patterns through a Chiastic Coding workflow.

## What is Chiastic Coding?

Chiastic Coding is an X-shaped workflow for AI-driven software development. You start at the outermost layer with a Gherkin feature file, descend through design and decomposition, hit the center where TDD implementation happens via paired AI agents, then ascend back out through integration and verification. The descent is design. The ascent is verification.

## Skills

This plugin provides the following skills:

- **story-orchestrator** — Reads a Gherkin feature file, decomposes it into behaviors, and drives paired agents through implementation. User-invocable as `/chiastic:story-orchestrator`.
- **task-pair** — Shared context for agents working as a TDD pair. Explains the pair dynamic, role swapping, and collaboration model.
- **task-pair-test-writer** — The red phase. Writes failing tests that specify a behavior.
- **task-pair-implementer** — The green phase. Makes failing tests pass with the simplest implementation.
- **task-pair-refactorer** — The refactor phase. Reviews and improves code and tests while keeping everything green.

## Installation

### From GitHub

```
/plugin marketplace add guyroyse/chiastic-coding-plugin
/plugin install chiastic@chiastic
```

### For development

```bash
claude --plugin-dir /path/to/this/repo
```

## License

[MIT](LICENSE)

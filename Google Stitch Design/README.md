# Google Stitch — DESIGN.md Specification

## What Is This?

**DESIGN.md** is an open-source format specification created by Google Labs (via the [Stitch](https://stitch.withgoogle.com/) product team) for describing a project's visual identity to AI coding agents. It gives agents a persistent, structured understanding of a design system so they produce brand-consistent UI without guessing.

## Origin & Source

| Field | Value |
|---|---|
| **Created by** | Google Labs — David East, Cassia Xu, and team |
| **Announced** | April 21, 2026 |
| **GitHub** | [google-labs-code/design.md](https://github.com/google-labs-code/design.md) |
| **Blog Post** | [blog.google — Stitch's DESIGN.md is now open-source](https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-design-md/) |
| **Video** | [Meet DESIGN.md: A new open standard for AI-generated UI](https://www.youtube.com/watch?v=W1gWIQp9k1Y) |
| **License** | Apache 2.0 |
| **Spec Version** | `alpha` (as of April 2026) |
| **npm Package** | `@google/design.md` |

## How It Works

A `DESIGN.md` file has two layers:

1. **YAML Front Matter** — Machine-readable design tokens (colors, typography, spacing, border-radius, component definitions). These are the normative values agents use to style UI.
2. **Markdown Prose** — Human-readable design rationale explaining *why* those values exist and how to apply them. This gives agents context for ambiguous decisions.

### Example

```yaml
---
name: Heritage
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 3rem
  body-md:
    fontFamily: Public Sans
    fontSize: 1rem
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 8px
  md: 16px
---

## Overview

Architectural Minimalism meets Journalistic Gravitas. The UI evokes a
premium matte finish — a high-end broadsheet or contemporary gallery.

## Colors

- **Primary (#1A1C1E):** Deep ink for headlines and core text.
- **Tertiary (#B8422E):** "Boston Clay" — the sole driver for interaction.
```

## CLI Tools

```bash
# Validate a DESIGN.md for correctness + WCAG contrast
npx @google/design.md lint DESIGN.md

# Compare two versions for token-level regressions
npx @google/design.md diff DESIGN.md DESIGN-v2.md

# Export to Tailwind config
npx @google/design.md export --format tailwind DESIGN.md

# Export to W3C Design Token format
npx @google/design.md export --format dtcg DESIGN.md

# Output the full spec (useful for injecting into agent prompts)
npx @google/design.md spec
```

## How This Relates to Our Existing Tools

| Tool | Purpose | Analogy |
|---|---|---|
| **AGENTS.md** | Technical/operational instructions for agents | "How to build" |
| **Frontend-Design Skill** | Creative direction & aesthetic philosophy | "How to design well" |
| **DESIGN.md** (this) | Brand token enforcement & validation | "What the design IS" |

These three are complementary layers:
- **Frontend-design skill** = teaches good taste (no AI slop, bold aesthetic choices)
- **DESIGN.md** = locks specific brand decisions into deterministic tokens
- **AGENTS.md** = handles build config, architecture, process hygiene

## Linting Rules

The CLI validates 8 rules:

| Rule | Severity | What It Checks |
|---|---|---|
| `broken-ref` | error | Token references that don't resolve |
| `missing-primary` | warning | No `primary` color defined |
| `contrast-ratio` | warning | Component color pairs below WCAG AA (4.5:1) |
| `orphaned-tokens` | warning | Colors defined but never used by components |
| `token-summary` | info | Count of tokens per section |
| `missing-sections` | info | Optional sections absent |
| `missing-typography` | warning | Colors exist but no typography tokens |
| `section-order` | warning | Sections out of canonical order |

## Section Order (Required)

If present, sections must appear in this sequence:

1. Overview (alias: "Brand & Style")
2. Colors
3. Typography
4. Layout (alias: "Layout & Spacing")
5. Elevation & Depth (alias: "Elevation")
6. Shapes
7. Components
8. Do's and Don'ts

## Files in This Folder

| File | Description |
|---|---|
| `README.md` | This file — overview and provenance |
| `spec.md` | The full DESIGN.md format specification |
| `DESIGN.md.example` | A complete working example file |

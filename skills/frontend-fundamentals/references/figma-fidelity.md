# Figma fidelity (figma-fidelity) — universal rules for design→code conversion

When moving a Figma design into code, **never altering the designer's decisions** is the default. These are project-agnostic universal rules: `/omj` Phase 2 **prescribes** them while authoring the spec, and `/oh-my-joy:ff-review`·`design-qa` **verify** them after implementation (prescription↔verification, same SoT).

## Rules

1. **Keep original text** — carry over Figma's copy, particles, and line-break intent verbatim. Never edit copy because "it reads more naturally". If something looks like a typo, *flag it as a question in the spec*; never fix it silently in code.
2. **No invented variants** — never create state/size/tone variants absent from Figma because "they will probably be needed" (the same axis as the FF overengineering warning). If needed, propose at the spec stage and add after user approval.
3. **No fixed px widths** — never hardcode the frame's px as the component width; control it with `w-full` + the parent container's padding/max-width. A Figma frame's width is a *container* spec, not a component spec.
4. **No hardcoded tokens** — map to the project token system's semantic values instead of raw hex, rgb(), or arbitrary px (detection order in `fe-acceptance.md`). When a Figma value and the tokens disagree, the default is *nearest semantic token + record the deviation in the spec*; adding a new token is the user's decision.
5. **Layer structure ≠ DOM structure** — never clone the Figma layer tree into the DOM as is. Semantic tags and accessibility structure (`references/a11y.md`) take precedence; only the visual result matches the design.

## Boundaries needing judgment

- Responsive: when Figma has a single frame only, other breakpoints require *reasonable interpolation* — state the interpolation decisions in the spec and get them approved (no silent invention).
- Design-system conflicts: when a Figma value clashes with existing components/tokens, raise "follow Figma or follow the system?" as a spec question. The default is system (tokens) first.

---
type: llm
---
The answer is an inspection report that lists the dependencies and scaffolds OMJ checks (a capture backend such as playwright-cli or the playwright MCP, the Figma MCP, Context7, the project fe-context declaration, the token store, and the opt-in items) each with a status such as present, missing, or optional. It reports `.omj/fe-context.md` as present and identifies the token store as `src/tokens/colors.css`. For the machine-dependent rows (playwright, Figma, Context7, Agent Teams, answer style, HUD) any status is acceptable, including "could not detect — check with /plugin or /mcp" when the claude CLI was unavailable. The answer does not claim to have installed, created, or changed anything.

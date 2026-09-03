# NOTICE — methodology, pattern, and vendored-code attribution

oh-my-joy's workflow commands, its agent-team contract, and its answer style are **rewrites that
borrow the methodology** of the open-source projects below. For those, no code or prose was copied,
and no project's runtime (CLI, tmux, state-file conventions) was ported. The one exception is the
**OMJ HUD** (`hud/`), which vendors actual code — see the "Vendored code" section. What each idea
became inside OMJ, and which ideas were declined, is recorded in `docs/PRINCIPLES.md` ⑧.

| Source | License | What was borrowed |
| --- | --- | --- |
| [gajae-code](https://github.com/Yeachan-Heo/gajae-code) (Yeachan Heo) | MIT | Deep-interview methodology (topology gate, weakest-dimension targeting, ambiguity formula, ontology convergence, Restate/Closure double termination) |
| [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (Yeachan Heo) | MIT | The team-pipeline contract (a shared task list with verification as the barrier between stages), reshaped onto Claude Code's native Agent Teams as the dispatch table; the doc-invariant test pattern. Earlier releases also borrowed its file-based goal state and consensus plan, retired in v0.8.0 |
| [superpowers](https://github.com/obra/superpowers) (Jesse Vincent) | MIT | Verification before completion — no "done" without evidence — carried by `verify` (evidence mode), `ship`, and the teammate completion contract |
| [gstack](https://github.com/garrytan/gstack) (Garry Tan) | MIT | Artifact chaining between stages (each command reads what the previous one recorded) and the shape of a ship stage (verify, commit, push, PR) |
| [everything-claude-code](https://github.com/worldflowai/everything-claude-code) (worldflowai) | MIT | The eval-harness framing — capability versus regression cases with pass-rate thresholds — realized as `evals/` on Claude Code's native plugin eval |
| [fluent-korean](https://github.com/snflkd/fluent-korean) (snflkd) | MIT | The writing rules of the answer style: compose natively in the reader's language, complete Korean particles and endings, one consistent polite register, natural mixing of English technical terms, explain for beginners, proofread before sending |

## Vendored code

`hud/vendor/hud/index.js` is an esbuild bundle of oh-my-claudecode v5.0.0 `dist/hud`
(display strings rebranded OMC→OMJ; logic untouched), and `hud/omj-hud-cache.sh`,
`hud/find-node.sh`, and `hud/scripts/session-summary.mjs` are adapted copies of the
corresponding oh-my-claudecode scripts. This code is used under the MIT License:

```
MIT License

Copyright (c) 2025 Yeachan Heo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

All projects above are MIT-licensed; copyright notices follow each repository's LICENSE.
oh-my-joy itself is licensed under [LICENSE](LICENSE) (MIT).

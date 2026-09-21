# Meeting talking points — Frontend → Backend issue handoff

Use this as your own script. Keep it to ~5–8 minutes; demos are the examples folder.

---

## 1. Why we’re doing this (30 sec)

Today FE → BE issues often arrive as chat messages, screenshots, or vague tickets. Backend and agents then spend time asking: What endpoint? What payload? Is this FE or BE? What does “done” mean?

**Goal:** One markdown format so a human or an agent can implement without a follow-up call.

---

## 2. The pattern in one sentence

> Frontend writes **one file per issue**, either a **bug** or a **request**, with evidence, contract, and acceptance criteria — same structure every time.

---

## 3. Two doc types (show filenames)

| Type | When | Example |
|------|------|---------|
| `BACKEND_BUG_…` | API exists but behaves wrong | Wrong wallet debited |
| `BACKEND_REQUEST_…` | Need new field / endpoint / rule | Profile-complete flag on checkout |

**Say:** “If you’re not sure which one — if the endpoint already exists and is wrong, it’s a bug. If you’re asking for something new, it’s a request.”

---

## 4. What every good handoff must have (walk the header)

Point at the template header and say:

1. **Status / severity / area / endpoints** — so BE knows where to look and how urgent
2. **Summary + user impact** — why it matters in business language
3. **Repro steps** — someone else can reproduce
4. **Evidence** (bugs) — exact request + response JSON
5. **FE verification** — “we already send X; don’t re-debug the UI”
6. **Contract** (requests) — copy-pasteable JSON + field table
7. **Acceptance criteria** — checkboxes; binary pass/fail
8. **Out of scope** — stop scope creep in the meeting itself

---

## 5. Demo (2 min) — open the filled examples

1. Open `examples/EXAMPLE_BACKEND_BUG.md`  
   - Highlight: request body with `walletType`, error JSON, “FE already sends this”  
   - **Line to say:** “Backend doesn’t need to guess. The failure and the expected contract are in the file.”

2. Open `examples/EXAMPLE_BACKEND_REQUEST.md`  
   - Highlight: new field table, error `code: PROFILE_INCOMPLETE`, “backend must own the rule”  
   - **Line to say:** “UI prompts aren’t enough for money/checkout rules — the request says who owns enforcement.”

---

## 6. Rules that matter for agents (if they use Cursor/agents)

Mention only these:

- One issue per file  
- Evidence over opinion  
- Exact endpoint + enum names  
- Acceptance criteria must be testable  
- Paste the one-liner from the guide into their `AGENTS.md` / skill so agents don’t invent a new format  

---

## 7. How the other team adopts it (action)

1. Copy the example pack into their repo under `docs/`  
2. Use the empty templates for real tickets  
3. Keep filled examples for onboarding  
4. Optional: add the agent blurb from the guide  

**Ask them:** “Where do you want these to live — repo docs, Linear/Jira description, or both?”  
(Recommend: repo markdown as source of truth; ticket links to the file.)

---

## 8. Objections you might get

| They say | You say |
|----------|---------|
| “Too heavy for small bugs” | “Small bugs still need path + status + body. The template is short if you delete unused sections.” |
| “We already have Jira” | “Same sections in the ticket body, or attach/link the markdown. Format matters more than the tool.” |
| “BE will ignore docs” | “Then acceptance criteria become the PR checklist — no merge without the boxes.” |
| “Agents don’t need this” | “Agents fail most on missing contracts and missing evidence. This is exactly what they need.” |

---

## 9. Close

**Ask for:** Agreement to try this format on the next 2–3 FE→BE issues.  
**Offer:** You’ll review the first one with them against the checklist in the guide.

---

## Cheat card (print / second screen)

```
BUG     = wrong behavior on existing API   → evidence (req/res) + expected
REQUEST = new field / endpoint / rule      → JSON contract + ownership + AC
ALWAYS  = one file, header filled, binary acceptance criteria
NEVER   = chat-only “API broken”, multiple issues in one doc
```

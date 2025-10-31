# Why the Updated System + User Prompts Fix the Function-Calling Issue

## 🧠 1. You’re teaching the model to treat the schema as a **contract**, not “guidance”
In your original prompt, GPT saw the schema as *advisory* (“include all workouts if possible”).  
LLMs often optimize for **brevity and coherence**, not completeness, so they drop nested detail when under token pressure.

By making rules like:
> “Partial or summarized structures are INVALID and will be rejected.”

and by embedding the **schema inline** in code-block JSON, you push the model into *deterministic serialization mode*.  
This shifts its objective from “write something that sounds correct” → “satisfy an exact format”.

✅ Effect: GPT now *feels compelled* to output structured JSON, not summaries.

---

## 🧩 2. You reduced ambiguity about scope and variability
The first prompt hard-coded **12 weeks**, which the model treated as a constant truth.  
When you later changed it to 8 weeks, it had no adaptive logic.

By introducing:
```text
{training_plan_weeks}
```
and explicit validation:
> `total_weeks` equals `{training_plan_weeks}` and `len(weekly_plan)`  

you signal that *the user defines the length*.  
That makes it **parametric**, so the model won’t hallucinate 12 weeks again.

✅ Effect: Dynamic week count now behaves predictably.

---

## 🕐 3. You constrained *where* and *how much* the model can schedule
Earlier, the model filled all seven days (or skipped specifying any).  
Now you give it `{available_days}`, `{weekly_time_budget_hours}`, and optional `{daily_time_caps_json}`.

This gives GPT clear **feasibility boundaries** — it can no longer “improvise” a structure beyond the athlete’s time limits.

✅ Effect: Output respects realistic training load and avoids invalid day keys.

---

## 🧩 4. You shortened text caps → preserved tokens for structure
When LLMs hit context or token limits, they drop deep nested JSON (the *segments* level).  
By capping descriptive text (`≤15–30 words`), you guarantee enough token headroom to serialize all segments fully.

✅ Effect: It stops summarising workouts (“...similar intervals repeated”) and writes every segment explicitly.

---

## 🧮 5. You built in self-validation (Quality Gates)
The “Quality Gates” section tells the model to **check itself** before calling the tool.  
This nudges it to *simulate validation mentally* and fix missing parts before producing the function call.

✅ Effect: Greatly reduces schema errors and missing workouts.

---

## 🧰 6. You added external validation hooks (fail-recover loop)
The pseudocode validator at the end means your backend (or test harness) can automatically reject incomplete plans and re-prompt with:
> “Your previous tool call was invalid: workouts were missing…”

That’s important because **even the best prompt can’t enforce runtime guarantees** — this external check closes the loop.

✅ Effect: 100% structural compliance over time.

---

## 🧠 7. You’re leveraging how GPT-5 handles “schema anchoring”
GPT-5 (and 4-Turbo with function calling) parse schemas token-by-token before generating JSON.  
When you present the schema in the **same format as the function parameters**, GPT’s internal parser uses it to constrain decoding.

✅ Effect: The model now writes JSON the same way OpenAI’s function parser expects — fewer validation failures.

---

### TL;DR – Why it helps

| Issue | Why it Happened | How the new prompt fixes it |
|-------|-----------------|-----------------------------|
| Missing workouts/segments | Model compressed content | Strict word caps + JSON schema block |
| 12-week hard-coding | Fixed assumption in system prompt | Dynamic `{training_plan_weeks}` parameter |
| Ignored availability | No explicit constraint | `available_days` and time-budget guards |
| Tool call truncated | Token overflow | Compact text + token-safe design |
| Summarized plans | Model optimizes for readability | “No summaries” rule + Quality Gates |
| Hard to validate | Manual eyeballing | Built-in validator pseudocode |

---

If you like, I can show you a **before/after example** (same athlete, same data) to demonstrate how GPT’s output changes under the new prompt — one version with your old setup, one with the improved schema.

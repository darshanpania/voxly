# Using Voxly for the Sarvam AI Pre-Sales Engineer Assignment

This guide maps the **Sarvam AI Pre-Sales Engineer assignment** onto the Voxly codebase: what the assignment actually asks for, why Voxly is a strong starting point, exactly what to change, and how to package the deliverables in the 7 days.

> **Make it yours.** This repo is a head start, not a submission. The interview after this assignment will probe whether you understand what you built — the architecture, the trade-offs, why Sarvam over alternatives. Rebuild the parts that matter in your own way, be able to explain every file you submit, and credit the base repo in your README if you keep it as the foundation.

## 1. What the assignment asks for

Read the PDF fully, but the skeleton is:

- **Build**: a voice bot, an agentic workflow, or both — for a *specific, credible enterprise use case*, using **Sarvam AI's APIs meaningfully** (STT, TTS, LLM, Translate — at least one as a core component).
- **Hard requirements**:
  - Working demo, runnable locally or via a link
  - **3–5 min demo video** (if it's a voice bot: show a multilingual conversation)
  - If voice: **at least 2 Indian languages**; code-mixing (Hinglish/Tanglish) is a strong plus
  - Architecture diagram
  - **Business write-up** (1–2 pages or ≤8 slides) written for a CTO/VP Ops, covering: the problem, why AI, why Sarvam specifically, architecture summary, ROI with stated assumptions, limitations + 90-day rollout plan
  - Clear README: setup, architecture, which Sarvam APIs and why
- **Submission**: one GitHub repo — `README.md`, `/src` (code + `.env.example`), `/docs` (write-up + diagram), demo video link. Email the recruiter with subject `[Pre-Sales Assignment] Your Name — Use Case`.
- **Optional extras** (nice-to-have, not required): post-call analytics pipeline (batch STT + diarization + LLM analysis), telephony integration (Plivo/Twilio).

The scoring emphasis is explicit: *depth and specificity of one use case* beats breadth, and the business narrative matters as much as the code. This is a **pre-sales** role — the write-up and demo video are not afterthoughts; they're half the assignment.

## 2. Why Voxly is a good base

Voxly is already a working **voice bot with the exact pipeline the assignment describes**: browser mic → **STT** → **LLM tutor with structured feedback** → **TTS** → audio back to the user, with streaming replies (SSE), user auth, a Postgres-backed session history, vocabulary tracking with spaced repetition, and progress analytics.

It currently uses OpenAI (Whisper, `tts-1`, chat completions) and teaches Spanish. The assignment work is essentially:

1. **Swap the AI provider to Sarvam** (STT → Saaras, TTS → Bulbul, LLM → `sarvam-m` chat completions, plus Translate where useful).
2. **Re-aim the product at an Indian enterprise use case** in 2+ Indian languages.
3. **Write the pre-sales artifacts** (video, diagram, business case).

That's a realistic 7-day scope because the plumbing — audio capture, streaming, sessions, UI — already works.

### Picking the use case

The path of least resistance is **"Student Tutoring Bot (EdTech)"** — one of the assignment's own inspiration examples (see "Sarvam Tutor Agent"). Voxly *is* a tutor; you reframe it as, e.g.:

- *Spoken-English practice tutor for Hindi/Tamil-medium school students* — the student converses in code-mixed Hindi/English, the tutor corrects and coaches, vocabulary is tracked with spaced repetition. The existing FSRS + progress features become genuine product differentiators in your demo.
- Or invert it: *regional-language concept tutor* (NEET/JEE prep in Hindi + one more language).

You can pick a different use case (collections agent, scheme helpline, clinic receptionist) and reuse Voxly's pipeline with a new system prompt and UI copy — but you'd throw away the vocab/progress features that make the demo rich. The tutor angle uses the most of what's here. Whatever you choose, **anchor everything to one named, specific customer context** (e.g. "an affordable-private-school chain in UP with 40k students") — the assignment explicitly penalises generic demos.

## 3. The code changes, file by file

First get the app running as-is: follow **[docs/SETUP.md](./SETUP.md)**. Then work through these. Sarvam API docs: <https://docs.sarvam.ai/api-reference-docs/getting-started/welcome> — get a key at <https://dashboard.sarvam.ai/> (there's a free tier with credits).

### 3.1 Swap STT → Sarvam Saaras — `backend/src/services/sttService.ts`

Replace the OpenAI Whisper call in `transcribeAudio()` with Sarvam's speech-to-text endpoint (`POST https://api.sarvam.ai/speech-to-text`, multipart upload, `api-subscription-key` header). Saaras auto-detects language and handles code-mixed speech — surface the detected `language_code` in your response; it's a great thing to show in the demo. The function already receives the audio buffer, filename, and a language hint, so the swap is contained to this one file.

### 3.2 Swap TTS → Sarvam Bulbul — `backend/src/services/ttsService.ts`

Replace the `openai.audio.speech.create` call in `synthesizeSpeech()` with Sarvam's text-to-speech endpoint (`POST https://api.sarvam.ai/text-to-speech`). Note the response shape differs: Sarvam returns base64-encoded audio in JSON rather than a binary stream, so decode it and wrap it with `Readable.from(...)` — the fallback branch at the bottom of the current file shows the pattern. Extend the `VOICES` map to pick a Bulbul speaker per language (e.g. different voices for `hi`, `ta`, `en`). Check the docs for per-request character limits and chunk long tutor replies if needed.

### 3.3 Swap the LLM → Sarvam chat completions — `backend/src/services/llmService.ts`

Sarvam's chat completions API is **OpenAI-compatible**, so this can be the smallest change in the project: point the existing `OpenAI` client at Sarvam's base URL with your Sarvam key and switch the model name (e.g. `sarvam-m`). Two things to verify carefully, because this file does the heavy lifting:

- **Structured output**: the tutor reply is strict JSON (reply lines with translations, corrections, feedback — see the `TutorResponse` interface). Test that the Sarvam model reliably produces it; the existing code already strips markdown fences and retries on parse failures, and there's recovery logic for dropped streamed-JSON tails.
- **Streaming**: `streamTutorResponse` powers the SSE endpoint in `backend/src/routes/sessions.ts` (`POST /sessions/:id/messages/stream`). Confirm streamed chunks flow through unchanged.

Then rewrite the **system prompt** for your use case: target languages, code-mixing behaviour ("reply in the student's language mix"), CEFR-style levelling, and your enterprise framing.

### 3.4 Add Sarvam Translate (meaningful API #4)

Voxly's UI has a two-step translation reveal in immersion mode, currently fed by LLM-generated translations. Routing translations through Sarvam's dedicated **Translate** endpoint (`POST https://api.sarvam.ai/translate`) gives you a fourth Sarvam API used *meaningfully*, and a talking point about using the right tool per task (dedicated translation model vs. burning LLM tokens).

### 3.5 Configuration and language plumbing

- `backend/src/env.ts` + `backend/.env.example`: add `SARVAM_API_KEY` (Zod-validated). Remove `OPENAI_API_KEY` once nothing uses it.
- The language code `"es"` is threaded through services, routes, and the frontend (language selector, `UserLanguageProfile` in `backend/prisma/schema.prisma` — the schema itself is language-agnostic). Grep for `"es"` and `es:` across `backend/src` and `apps/web/src` and replace with your target set, e.g. `hi`, `ta`, `en-mixed`. This satisfies the **2+ Indian languages** requirement — make switching languages visible in the UI so it shows up in your demo video.
- Update UI copy/branding in `apps/web` to match your enterprise story.

### 3.6 Optional stretch goals (only if the core is solid)

- **Agentic workflow (the "A+B" tier)**: add one end-to-end triggered sequence, e.g. session ends → agent evaluates the student's struggle areas → updates a mock teacher dashboard / sends a WhatsApp-style parent summary via an n8n webhook or a small LangGraph graph. The assignment only asks for *one* working flow; mock data is explicitly fine. A natural hook point is right after session completion in `backend/src/routes/sessions.ts`.
- **Post-call analytics**: batch-analyse stored session transcripts (they're all in Postgres already) following Sarvam's Call Analytics cookbook.
- **Telephony**: skip unless days 1–4 went perfectly; it's optional and a time sink.

## 4. Suggested 7-day plan

| Day | Goal |
| --- | --- |
| 1 | Read the PDF twice. Run Voxly as-is (SETUP.md). Get a Sarvam API key; hit STT/TTS/chat/translate from `curl` or a scratch script to learn the request/response shapes. Lock your use case + customer context. |
| 2 | Swap STT and TTS (§3.1–3.2). Voice loop works end-to-end on Sarvam in one language. |
| 3 | Swap the LLM + rewrite the system prompt (§3.3). Verify structured output and streaming. Wire Translate (§3.4). |
| 4 | Languages 2 (+3) and code-mixing (§3.5). UI copy/branding. This is the "minimum requirements met" checkpoint. |
| 5 | Stretch goal (agentic flow) **or** polish + bug-fixing. Draft the architecture diagram. |
| 6 | Business write-up. Rewrite the README (setup, architecture, *which Sarvam APIs and why*). Add `.env.example`. Test a clean clone-and-run on a fresh directory. |
| 7 | Record the demo video (script it first: problem → live multilingual conversation → code-mix moment → analytics/agentic flow → close with business value). Final repo tidy-up, submit. |

## 5. Deliverables checklist

- [ ] Voice bot runs end-to-end on Sarvam APIs (STT + TTS + LLM used as *core* components, Translate as a bonus)
- [ ] Conversation works in **≥2 Indian languages**; code-mixing demonstrated
- [ ] Specific enterprise context, named and quantified — not a generic demo
- [ ] `README.md`: setup instructions, architecture overview, demo video link, which Sarvam APIs are used and why
- [ ] `.env.example` present; no real keys anywhere in git history
- [ ] Architecture diagram (Mermaid in the README or an exported image in `/docs`)
- [ ] Business write-up in `/docs` — all six sections: Problem (with real numbers), Why AI, Why Sarvam, Architecture summary, ROI with stated assumptions, Limitations + 90-day rollout
- [ ] Demo video, 3–5 minutes, linked from the README (Loom/YouTube/Drive)
- [ ] Email sent: `[Pre-Sales Assignment] Your Name — Use Case`

## 6. Pre-sales tips (how this gets scored)

- **The video is the product.** Reviewers watch it before reading code. Show a real conversation with visible language switching and a code-mixed exchange; keep energy up; end on the business value, not a feature list.
- **"Why Sarvam" needs substance.** You have first-hand material after this build: Indic STT quality on code-mixed speech, 37+ Indian voices, data-residency/on-prem options for Indian enterprises, price per call vs. human agents. Compare honestly against generic stacks (Whisper + ElevenLabs + GPT) — you literally migrated from one, which makes a great before/after narrative.
- **ROI with visible assumptions.** The PDF gives you the template: "automating X% of calls at ₹Y/call vs ₹Z/human". State every assumption; a defensible rough number beats a precise fabricated one.
- **Limitations show seniority.** Say plainly what a production rollout needs that the PoC lacks (telephony, barge-in/latency tuning, guardrails and evals, load testing, human-escalation paths, data-retention policy) and sketch the 90-day plan.
- **Keep the repo clean.** Fresh-clone test the setup instructions on day 6 — a reviewer who can't run your demo in 10 minutes stops trying.

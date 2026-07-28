# How to Do the Sarvam Assignment with Voxly (For a Presales Consultant)

This guide is for you if you're doing the **Sarvam AI Pre-Sales Engineer assignment** and you're *not* an engineer. Good news: this assignment is designed for exactly your profile. Half the marks are for things you already do for a living — framing a customer problem, telling a business story, and giving a great demo. The code half is where this repo plus an AI coding assistant carry you.

**The strategy in one line:** Voxly is already a working voice bot; you'll use an AI assistant to swap its AI brain to Sarvam's and change its language, then spend most of your week on the demo video and business write-up — the parts that actually win.

> **One honest note first.** Submit this only if you genuinely understand and can explain what you built — the interview afterwards will test that. Working with an AI assistant to modify an existing app is fine (that's how a lot of real presales demos get built), but read what it does, ask it to explain things, and credit this repo as your starting point in your README. You should be able to walk someone through your demo's architecture diagram without notes by day 7.

---

## Part 1 — What the assignment actually asks for

Strip away the PDF's length and it's five deliverables:

1. **A working demo** — a voice bot (or automated workflow) for one *specific* enterprise use case, that meaningfully uses **Sarvam's AI services** (their speech-to-text, text-to-speech, language model, or translation). If it's a voice bot, it must work in **at least 2 Indian languages** — and handling mixed language like Hinglish is a big plus.
2. **A 3–5 minute demo video** showing it working, including a multilingual conversation.
3. **An architecture diagram** — a simple boxes-and-arrows picture of the pieces.
4. **A business write-up** (1–2 pages or up to 8 slides) written for a CTO or VP of Operations: the problem, why AI, why Sarvam specifically, the architecture in plain terms, an ROI estimate, and limitations + next steps.
5. **One GitHub repo** containing all of it, emailed to the recruiter with subject `[Pre-Sales Assignment] Your Name — Use Case`.

Two lines in the PDF tell you how it's scored, so take them literally:

- *"Depth and specificity matter far more than covering all the examples"* — one well-told use case beats a feature tour.
- *"Generic demos without a clear customer context will not score well"* — invent a named, concrete customer and build everything around them.

Notice what this is: **a sales asset, not a coding test.** The video and write-up are the product. The code just has to work.

---

## Part 2 — Your use case (already decided for you, basically)

Voxly is a **voice language tutor**: a student speaks, the AI listens, corrects their mistakes, replies out loud, and tracks the words they're learning over time with progress charts. That is, almost word for word, one of the assignment's own suggested use cases: **"Student Tutoring Bot (EdTech)"**.

So frame it as something like:

> **"Bolo" — a spoken-English practice coach for Hindi-medium school students.** India has ~250M school students; most Hindi/regional-medium students never get 1-on-1 spoken English practice, and English fluency is the #1 employability skill parents pay for. A student talks to the tutor in whatever mix of Hindi and English they have; it gently corrects them, replies in a friendly Indian voice, and shows teachers/parents which words the student is mastering. Pitch it to a specific (invented) customer: e.g. an affordable private school chain in UP with 40,000 students, or an ed-tech company adding a speaking feature.

Why this framing works hard for you:

- Voxly's existing extras — **vocabulary tracking, spaced repetition, progress dashboards** — instantly become product features in your story, for free.
- Mixed Hindi-English ("Hinglish") isn't just supported, it's *the whole point* of the use case — and it's the exact capability Sarvam brags about vs. Western AI companies. Your "Why Sarvam" section writes itself.
- You can speak Hindi + English in the demo video yourself.

(If you'd rather do a different use case — collections calls, a government scheme helpline — the same app can be repurposed by changing its instructions and text, but you'd waste the tutor features. Only deviate if you have a strong personal angle, e.g. you've sold into that industry.)

---

## Part 3 — Getting the code changed (without being able to code)

### Step 0 — Fork the repo and get the app running as-is

Follow **[SETUP.md](./SETUP.md)** in this folder — it's written for non-engineers and takes under an hour. It has you **fork** this repo first (create your own copy under your GitHub account) and then run that copy. The fork matters for the assignment: the submission is *a GitHub repo of yours*, and your fork is exactly that — every change you make gets saved ("pushed") to it, and its link is what you'll email the recruiter. SETUP.md's "Saving your changes back to GitHub" section covers the pushing part.

Don't touch anything else until the original app works and you've had a conversation with it.

### Step 1 — Get an AI coding assistant

You need a tool that can read this project and change the code when you ask in plain English. Best options:

- **Claude Code** (<https://claude.com/claude-code>) — works right in the project; you type instructions, it edits the files and tells you what it did. Recommended.
- **Cursor** (<https://cursor.com>) — a code editor with a built-in AI chat; similar idea.

Install one, open it inside the `voxly` folder, and treat it like a very capable junior engineer: give it one task at a time, ask it to explain what it changed in plain English, and test the app after every task.

### Step 2 — Get a Sarvam API key

Sign up at <https://dashboard.sarvam.ai/> and create an API key (they give free credits to start). This is the key that lets the app use Sarvam's AI instead of OpenAI's.

### Step 3 — Give the assistant these tasks, one at a time

These are ready-to-paste prompts. After each one: run the app (`npm run dev`), test by having a conversation, and if something broke, paste the error back into the assistant and say "this broke, please fix it."

**Task 1 — swap speech recognition to Sarvam:**

> This project is a voice tutor app. Replace the OpenAI Whisper speech-to-text call in `backend/src/services/sttService.ts` with Sarvam AI's Speech-to-Text API (their Saaras model, docs at docs.sarvam.ai). Add a `SARVAM_API_KEY` setting to `backend/src/env.ts` and `backend/.env.example`, and I'll put my key in `backend/.env`. Keep the function's inputs and outputs the same so nothing else in the app breaks. Explain what you changed in plain English.

**Task 2 — swap the voice it speaks with to Sarvam:**

> Now replace the OpenAI text-to-speech call in `backend/src/services/ttsService.ts` with Sarvam AI's Text-to-Speech API (their Bulbul model), using an Indian voice. Note Sarvam returns audio as base64 inside JSON, not a binary stream — handle that. Keep the function signature the same. Explain what you changed.

**Task 3 — swap the tutor's brain to Sarvam:**

> Now switch the language model in `backend/src/services/llmService.ts` from OpenAI to Sarvam AI's chat completions API, which is OpenAI-compatible (model `sarvam-m`). Important: this file expects strictly formatted JSON replies and also streams responses — make sure both still work, and test carefully. Explain what you changed.

**Task 4 — change the language from Spanish to Hindi/English:**

> This app currently teaches Spanish (language code "es"). Change it to teach spoken English to Hindi-speaking students: the student speaks in mixed Hindi and English, the tutor understands both, replies mostly in simple English with Hindi explanations where helpful, and corrects mistakes gently. Update the tutor's system prompt in `llmService.ts` accordingly, and update the language codes threaded through the backend and the web app (search for "es"). Also add Hindi as a fully supported conversation language so I can demo a conversation in Hindi too.

**Task 5 — rebrand the app:**

> Rename the app in the user interface from "Voxly" to "Bolo" (or your chosen name) and update the on-screen text to fit a spoken-English tutor for school students. Don't change any logic, just labels and copy.

**Task 6 (optional, only if days 1–4 went smoothly) — one "agentic" flourish:**

> After a tutoring session ends, add a step where the AI generates a short progress summary for the student's parent (in Hindi) — what was practised, what improved, what to work on — and show it on the session history page. Keep it simple.

That's the whole build. Tasks 1–3 make Sarvam the core of the product (satisfying "uses Sarvam APIs meaningfully"), Task 4 satisfies "2+ Indian languages + code-mixing", and Task 6 gives you an "agentic workflow" talking point if you want the bonus tier.

### Step 4 — Understand what you built (non-negotiable)

Spend an hour with your AI assistant asking questions like: *"Explain the journey of my voice from when I press record to when I hear the reply, step by step, naming which Sarvam service does what."* Then draw that as your architecture diagram. If you can draw it and narrate it, you can survive the interview. The flow, for reference:

**Student's voice → app records it → Sarvam Speech-to-Text (Saaras) turns it into text → Sarvam's language model (sarvam-m) acts as the tutor: understands, corrects, replies → Sarvam Text-to-Speech (Bulbul) turns the reply into an Indian voice → student hears it. Everything is saved to a database for the progress dashboards.**

---

## Part 4 — The presales half (your home turf — spend most of your time here)

### The business write-up (1–2 pages or ≤8 slides)

The PDF gives you the exact section list. Guidance per section:

1. **The Problem** — real numbers. E.g. size of Indian K-12, cost of a human spoken-English trainer per student per month vs. what an affordable school can pay, teacher-to-student ratios. Cite sources roughly; state assumptions.
2. **Why AI (and why voice)** — the end user is a 10–16 year old on a shared family phone; typing English is exactly the skill they lack, so voice-first is the only interface that works. Infinite patience, zero judgement, practice at 10pm.
3. **Why Sarvam** — this is the section they care most about, and you now have first-hand ammunition: you (via your assistant) *migrated this app off OpenAI*. Say what that showed: Sarvam handles Hindi and Hinglish natively where Whisper/GPT are weakest; 30+ Indian voices that sound local; India data residency / on-premise options (a real objection-handler for schools and government buyers); India-appropriate pricing. Compare honestly with the generic stack you replaced.
4. **Architecture summary** — the one-paragraph flow from Step 4 above, plus your diagram. No jargon.
5. **ROI** — presales bread and butter. E.g.: human trainer ₹X/student/month at 1:30 attention vs. AI tutor at ₹Y of API cost per student for unlimited 1:1 practice; or price it as a ₹Z/month parent-paid add-on for the school. Show the arithmetic and label every assumption.
6. **Limitations & 90-day rollout** — being upfront reads as senior. PoC gaps: no teacher admin panel, latency not tuned, no content-safety guardrails or evals, no offline mode. 90-day plan: pilot with 2 schools / 200 students → measure speaking-confidence and retention → teacher dashboard → scale.

### The demo video (3–5 min) — this is what gets watched first

Script it before recording. A structure that works:

1. **0:00–0:40 — the problem**, told as a story about one student ("Meet Priya, class 8, Kanpur…").
2. **0:40–2:45 — live demo.** Have a real conversation: speak Hinglish, make a deliberate grammar mistake and show the correction, then **switch to Hindi mid-conversation** — that moment is the money shot for the multilingual requirement. Show the vocabulary/progress screens: "and every session feeds this."
3. **2:45–3:45 — how it works**: your architecture diagram, 30 seconds, naming the three Sarvam services.
4. **3:45–4:30 — the business close**: the ROI number, why Sarvam's India-first stack made this possible, and the 90-day pilot ask — end like you're closing a customer meeting, because you are.

Record with Loom or Zoom (screen + your face), do 2–3 takes, energy up.

### Packaging the repo

Ask your AI assistant to help with the final tidy-up:

> Prepare this repo for submission: rewrite README.md for my project "Bolo" — what it is, the customer problem, setup instructions, which Sarvam APIs are used and why, a link placeholder for my demo video, and an architecture diagram in Mermaid. Make sure `.env.example` files list every needed key and that no real API keys are committed anywhere. Note that the project was built on the open Voxly codebase.

Put your write-up (PDF or markdown) and diagram in `/docs`, and push everything to your fork (SETUP.md → "Saving your changes back to GitHub"). Check on the GitHub website that your fork actually shows the final version — the README should be your new one. If your fork shows as **Private**, make it public (repo Settings → General → Danger Zone → Change visibility) or the reviewers can't open it. Then email the recruiter: **your fork's link** (`github.com/YOUR-USERNAME/voxly`) + video link, subject `[Pre-Sales Assignment] Your Name — Spoken-English Tutor for Schools`.

---

## Part 5 — Your 7-day plan

| Day | Focus | Outcome |
| --- | --- | --- |
| 1 | Read the PDF twice. Do SETUP.md. Play with the original app. | App runs; you understand what it does as a user |
| 2 | Install the AI assistant, get the Sarvam key, run Tasks 1–2 | App hears and speaks via Sarvam |
| 3 | Tasks 3–4 | Tutor brain on Sarvam; Hindi/Hinglish working end-to-end — **minimum requirements met** |
| 4 | Task 5 (+6 if smooth). Test hard: try to break it, fix with the assistant. Start drafting the write-up. | Stable demo + write-up skeleton |
| 5 | Finish the business write-up + architecture diagram. Practice-run the demo flow out loud. | Customer-ready deck/doc |
| 6 | Repo packaging prompt, README, `.env.example` check. Script the video. | Submission-ready repo |
| 7 | Record the video (2–3 takes), final read-through of everything, submit. | Done, with a day's buffer built in if anything slipped |

## Checklist before you hit send

- [ ] Voice conversation works end-to-end on Sarvam (speech-to-text + tutor + text-to-speech)
- [ ] Demo shows **two languages** and at least one Hinglish exchange
- [ ] Video is 3–5 min, shows the language switch, ends on business value
- [ ] Write-up covers all six sections, with numbered assumptions in the ROI
- [ ] Architecture diagram you can personally explain without notes
- [ ] README: what/why/setup/which Sarvam APIs and why/video link; base repo credited
- [ ] No real API keys anywhere in the repo
- [ ] Email subject: `[Pre-Sales Assignment] Your Name — Use Case`

You've got this — the hard technical part is already built, and the part that decides the outcome is the part you do every day.

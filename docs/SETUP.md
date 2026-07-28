# Voxly — Setup Guide (No Coding Experience Needed)

Voxly is a voice tutor app: you talk to it in the language you're learning, it listens, corrects you, and talks back. This guide gets it running on your computer, step by step, assuming you've never set up a software project before.

**Total time: about 45–60 minutes.** Do the steps in order. Every step tells you what "success" looks like before moving on. If something doesn't match, don't push through — jump to [When something goes wrong](#when-something-goes-wrong) at the bottom.

---

## Words you'll see (30-second glossary)

- **Terminal** — a window where you type commands instead of clicking. On **Mac**: open the "Terminal" app (press Cmd+Space, type "terminal"). On **Windows**: open "PowerShell" (press the Windows key, type "powershell").
- **Command** — a line of text you type into the terminal and press Enter to run. In this guide, commands appear in grey boxes. Copy-paste them exactly, one at a time.
- **Repo (repository)** — a project's folder of code, downloaded from GitHub.
- **Backend / Frontend** — the app has two halves: the *frontend* is the web page you see and click; the *backend* is the engine running behind it. Both run on your own computer.
- **API key** — a password-like code that lets the app use a paid AI service (like OpenAI). You'll create these and paste them into settings files.
- **`.env` file** — a plain text file where those keys and settings live. It stays on your computer and is never shared.

---

## Step 1 — Install the two tools you need

### 1a. Node.js (the engine that runs the app)

1. Go to <https://nodejs.org>
2. Download the **LTS** version (the button on the left) and install it like any normal app, accepting all defaults.

**Check it worked:** open a terminal and type:

```
node --version
```

You should see something like `v22.x.x` (any number 20 or higher is fine).

### 1b. Git (the tool that downloads the project)

- **Mac**: in the terminal, type `git --version`. If it's not installed, a pop-up will offer to install it — click Install and wait.
- **Windows**: download and install from <https://git-scm.com/download/win>, accepting all defaults. Then close and reopen PowerShell.

**Check it worked:** `git --version` shows a version number.

---

## Step 2 — Fork the project, then download your copy

A **fork** is your own personal copy of the project on GitHub, under your account. You want a fork (not just a download) because you'll be changing the app and later submitting *your* version as *your* GitHub repo — the fork is what you'll share and submit.

### 2a. Create your fork (in the browser)

1. If you don't have one yet, create a free account at <https://github.com>.
2. Go to <https://github.com/darshanpania/voxly>.
3. Click the **Fork** button (top-right of the page), then **Create fork** on the next screen, keeping all defaults.
4. After a few seconds you'll land on your copy — the address bar will show `github.com/YOUR-USERNAME/voxly`. That's your repo now.

### 2b. Download your fork to your computer

In your terminal, paste these commands one at a time (press Enter after each), **replacing `YOUR-USERNAME` with your actual GitHub username**:

```
git clone https://github.com/YOUR-USERNAME/voxly.git
cd voxly
npm install
```

What they do: download your fork into a folder called `voxly`, move into that folder, and install everything the project depends on. The last command takes a few minutes and prints a lot of text — that's normal.

**Check it worked:** the install finishes without lines starting with `npm ERR!` at the end. (Yellow "warn" lines are fine — ignore those.)

> **Tip:** every command in the rest of this guide should be run from inside the `voxly` folder. If you close the terminal and come back later, type `cd voxly` first to get back in.

---

## Step 3 — Create the two free accounts the app needs

### 3a. Supabase (handles logins and stores your data) — free

1. Go to <https://supabase.com> and sign up (signing in with GitHub or Google is easiest).
2. Click **New project**. Give it any name (e.g. `voxly`), choose the region closest to you, and set a **database password**. **Write this password down** — you need it in Step 4.
3. Wait 1–2 minutes while the project sets up.
4. While you're here, one setting to relax for local testing: in the left sidebar go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email". (This lets you sign up in the app without clicking email verification links.)

### 3b. OpenAI (the AI that listens, thinks, and speaks) — needs ~$5 of credit

1. Go to <https://platform.openai.com> and sign up.
2. Add a small amount of billing credit ($5 is plenty for testing): **Settings → Billing → Add payment details**.
3. Create an API key: **Settings → API keys → Create new secret key**. Copy the key (it starts with `sk-`) and paste it somewhere safe **immediately** — it's only shown once.

---

## Step 4 — Fill in the settings files

The project needs two small settings files. Templates already exist — you'll copy them and fill in the blanks.

### 4a. Create the files

In the terminal (inside the `voxly` folder):

**Mac:**

```
cp backend/.env.example backend/.env
cp apps/web/.env.example apps/web/.env
```

**Windows (PowerShell):**

```
copy backend\.env.example backend\.env
copy apps\web\.env.example apps\web\.env
```

### 4b. Collect your Supabase values

In your Supabase project's website, find these five things (keep this tab open):

| What | Where to find it in Supabase |
| --- | --- |
| **Project URL** | Project Settings (gear icon) → **API** → "Project URL" — looks like `https://abcdefgh.supabase.co` |
| **anon key** | Same page → "Project API keys" → the one labelled `anon` `public` |
| **service_role key** | Same page → the one labelled `service_role` (click "Reveal") |
| **JWT secret** | Project Settings → API → scroll to "JWT Settings" → "JWT Secret" |
| **Two connection strings** | Click the **"Connect"** button at the top of the dashboard → "Connection String" tab. You need both the **"Transaction"** one (address contains `:6543`) and the **"Session"** one (contains `:5432`). In each, replace `[YOUR-PASSWORD]` with the database password you wrote down in Step 3a. |

### 4c. Fill in the backend file

Open the file `voxly/backend/.env` in any text editor (Notepad on Windows, TextEdit on Mac — or right-click the file → Open With). Fill in each line so it looks like this (with your real values after each `=`, no spaces, no quotes):

```
SUPABASE_URL=https://abcdefgh.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...(the long anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...(the long service_role key)
SUPABASE_JWT_SECRET=(the JWT secret)
DATABASE_URL=(the Transaction connection string — the :6543 one)
DIRECT_URL=(the Session connection string — the :5432 one)
OPENAI_API_KEY=sk-...(your OpenAI key)
PORT=3001
ALLOW_DEV_AUTH=
```

Save and close the file.

### 4d. Fill in the frontend file

Open `voxly/apps/web/.env` the same way and fill in:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...(the same anon key as above)
VITE_API_URL=http://localhost:3001
```

Save and close.

> ⚠️ These files contain secrets. Don't screenshot them, email them, or paste their contents into chat tools.

---

## Step 5 — Set up the database (one-time)

This creates the tables the app stores data in. In the terminal:

```
cd backend
npm run db:generate
npm run db:migrate
cd ..
```

If `db:migrate` asks for a "migration name", just press Enter.

**Check it worked:** you see a message about migrations being applied / "already in sync", with no red error text. If it fails, the usual culprit is a typo in the two connection strings — re-check Step 4b/4c, especially that the password replaced `[YOUR-PASSWORD]` and that `DIRECT_URL` is the `:5432` one.

---

## Step 6 — Start the app 🎉

```
npm run dev
```

Lots of text scrolls by, then it settles down. **Leave this terminal window open** — the app is running inside it. (To stop the app later, click in the terminal and press Ctrl+C.)

Now open your web browser and go to: **http://localhost:5173**

1. You'll see a login page. Click **Sign up** and create an account with any email and password (this is your own private copy — nothing is public).
2. Start a conversation. The first time you record, the browser asks for **microphone permission** — click Allow.
3. Talk! You should hear the tutor reply out loud.

**You're done.** Day-to-day from now on: open a terminal, `cd voxly`, `npm run dev`, open http://localhost:5173.

---

## Saving your changes back to GitHub

As you modify the app, your changes only exist on your computer until you "push" them to your fork on GitHub. Do this at the end of each working day (and definitely before submitting anything). The easiest way without touching the terminal:

1. Install **GitHub Desktop** from <https://desktop.github.com> and sign in with your GitHub account.
2. In GitHub Desktop: **File → Add local repository** → choose your `voxly` folder (one-time setup).
3. Whenever you want to save: GitHub Desktop shows everything that changed. Type a short note in the "Summary" box (e.g. "switched voice to Sarvam"), click **Commit to main**, then click **Push origin** at the top.

That's it — your fork on GitHub now has the latest version. (If you're using an AI coding assistant like Claude Code, you can also just ask it: *"save and push my changes to GitHub with a sensible message"*.)

> ⚠️ One check before your first push: your secret keys live in files named `.env`, which this project is already set up to keep **out** of GitHub. In GitHub Desktop's changed-files list, you should never see a file called `.env` — if you ever do, don't push; ask your AI assistant to fix it first.

---

## When something goes wrong

First rule: **copy the exact error message and paste it into an AI assistant** (ChatGPT or Claude) with the sentence *"I'm setting up a Node.js project called Voxly and got this error at the step where I ran `<command>` — what should I do?"*. That resolves 90% of issues. Common ones:

| What you see | What it means | Fix |
| --- | --- | --- |
| `command not found` / `not recognized` after typing `node` or `git` | The tool from Step 1 isn't installed, or the terminal was open during install | Redo Step 1; close and reopen the terminal |
| Red error mentioning a name like `SUPABASE_URL` or `OPENAI_API_KEY` right after starting | A line in `backend/.env` is empty or mistyped | Re-open the file and compare with Step 4c — the error names exactly which line is wrong |
| `db:migrate` fails or hangs | Connection strings mixed up | `DATABASE_URL` = the `:6543` one, `DIRECT_URL` = the `:5432` one, password filled in on both |
| Login/signup fails in the browser | Email confirmation is still on, or frontend `.env` has a typo | Redo Step 3a point 4; re-check Step 4d |
| You speak but get an AI error back | OpenAI key wrong or out of credit | Check billing at platform.openai.com; regenerate the key if needed |
| Mic button does nothing | Browser blocked the microphone | Click the icon near the browser address bar and allow the microphone for localhost |
| Page won't load at localhost:5173 | The app isn't running | Is the `npm run dev` terminal still open and running? If not, start it again |

---

## What's actually in this project? (optional reading)

You don't need this to run the app, but it helps when talking about it:

- **`apps/web`** — the frontend: the pages you see (Chat, Progress, Vocabulary, History). Built with React.
- **`backend`** — the engine: receives your voice recording, sends it to the AI for transcription (speech-to-text), asks the AI tutor for a reply, converts the reply to speech (text-to-speech), and saves everything to the database.
- **`backend/prisma`** — the database blueprint: what gets stored (users, conversations, vocabulary words, progress).
- The AI heavy lifting happens in three small files, one per job: `backend/src/services/sttService.ts` (speech→text), `ttsService.ts` (text→speech), `llmService.ts` (the tutor's brain). This matters for the assignment — see the [assignment guide](./SARVAM_ASSIGNMENT_GUIDE.md).

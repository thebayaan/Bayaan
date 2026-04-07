# Contributing to Bayaan

Thank you for contributing! This guide covers how to get the app running locally.

---

## Running the app locally

### 1. Clone and install

```bash
git clone https://github.com/thebayaan/Bayaan.git
cd Bayaan
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

### 3. API key for development

Bayaan uses a backend API to serve reciter data. For local development and
testing, you can use the **community API key**:

```
BAYAAN_API_URL=https://api.bayaan.app
BAYAAN_API_KEY=<community key — see pinned issue or README>
```

The community key has a lower rate limit than the official app key, but is
more than enough for building and testing.

> **No key at all?** That works too. If `BAYAAN_API_KEY` is not set, the app
> falls back to the bundled `data/reciters.json` automatically. You can build,
> run, and test every feature — you just won't get live reciter updates from
> the API.

### 4. Run

```bash
npx expo start
```

---

## What the API key is for

The Bayaan backend (`api.bayaan.app`) serves:

- Reciter and rewayat metadata (242+ reciters)
- Audio URL resolution
- Ayah timestamps for follow-along

The official app ships with a private key. The community key is a separate key
with its own rate limit, issued specifically for contributors.

If you're building a fork and want your own backend, see the
[Backend--bayaan](https://github.com/thebayaan/Backend--bayaan) repo for
self-hosting instructions.

---

## Pull requests

- Branch off `develop`, not `main`
- Keep PRs focused — one feature or fix per PR
- Run the app on both iOS and Android before submitting


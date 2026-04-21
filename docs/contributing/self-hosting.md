# Self-Hosting Bayaan

This guide is for contributors who want to run Bayaan against their own backend instead of the community API, or for teams who want to fork and deploy the app independently.

---

## Overview

Bayaan has two backend dependencies:

1. **Bayaan REST API** — serves reciter metadata, audio URL resolution, and ayah timestamps. The hosted version is at `api.thebayaan.com`. The backend source is at [thebayaan/Backend--bayaan](https://github.com/thebayaan/Backend--bayaan).
2. **Supabase** — used for audio file storage (reciters' MP3s) and as the source of truth for reciter/rewayat data. The Supabase client in the app is legacy for most features; the REST API is the primary data source.

For most contributors, the **community API key** is all you need. Self-hosting is only necessary if you want to add reciters, modify the data model, or run a fully independent deployment.

---

## Option 1: Use the community API key (recommended for contributors)

This is the path of least resistance:

```bash
cp .env.example .env
```

Set in `.env`:

```
EXPO_PUBLIC_BAYAAN_API_URL=https://api.thebayaan.com
EXPO_PUBLIC_BAYAAN_API_KEY=<community key>
```

Get the community key from the pinned issue on GitHub. The community key has a lower rate limit than the production key but is sufficient for all development and testing work.

---

## Option 2: Run your own Supabase project

Use this if you want to add reciters, test storage uploads, or work on Supabase-dependent features.

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) and create a new project.

### 2. Set up the database schema

Run the following in the Supabase SQL editor:

```sql
-- Reciters table
create table reciters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date text,
  image_url text
);

-- Rewayat table
create table rewayat (
  id uuid primary key default gen_random_uuid(),
  reciter_id uuid references reciters(id) on delete cascade,
  name text not null,
  style text,
  server text not null,
  surah_total integer,
  surah_list text,
  source_type text default 'supabase'
);
```

### 3. Create the storage bucket

In the Supabase dashboard, go to **Storage** and create a bucket named `quran-audio` with public read access.

The expected folder structure inside the bucket is:

```
quran-audio/
└── reciters/
    └── {reciter-folder-name}/
        ├── 001.mp3
        ├── 002.mp3
        └── 114.mp3
```

File naming convention: 3-digit zero-padded surah numbers (`001.mp3`, `002.mp3`, ..., `114.mp3`). Folder names should be lowercase with hyphens (e.g. `ahmed-al-ajmy`).

### 4. Set environment variables

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Note: the Supabase variables use the `SUPABASE_` prefix (not `EXPO_PUBLIC_`), which means they are not exposed to the client bundle. They are only used in Node scripts (e.g. `npm run fetch-reciters`).

---

## Option 3: Full self-hosted deployment (fork)

Use this if you are building an independent fork of Bayaan.

### Step 1: Fork and clone

```bash
git clone https://github.com/your-org/Bayaan.git
cd Bayaan
npm install
```

### Step 2: Replace app identifiers

Open `app.config.js` and update the following values:


| Key                                  | Location        | Replace with                 |
| ------------------------------------ | --------------- | ---------------------------- |
| `ios.bundleIdentifier`               | `app.config.js` | `com.yourorg.yourapp`        |
| `android.package`                    | `app.config.js` | `com.yourorg.yourapp`        |
| `ios.teamId`                         | `app.config.js` | Your Apple Developer Team ID |
| `ios.associatedDomains`              | `app.config.js` | Your domain for deep links   |
| `android.intentFilters[0].data.host` | `app.config.js` | Your domain                  |
| `extra.eas.projectId`                | `app.config.js` | Your EAS project ID          |
| `updates.url`                        | `app.config.js` | Your EAS Updates URL         |


### Step 3: Set up EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
```

This will create a new EAS project and update `eas.json`. Replace the `projectId` in `app.config.js` with the one EAS assigns.

### Step 4: Set up your own backend

Either:

- Deploy the [Backend--bayaan](https://github.com/thebayaan/Backend--bayaan) to your own infrastructure and point `EXPO_PUBLIC_BAYAAN_API_URL` at it, or
- Populate your Supabase project with reciter data and use `npm run fetch-reciters` to generate `data/reciters.json` for use as a bundled fallback.

### Step 5: iOS signing

The project uses a custom `withIOSTeam.js` plugin to inject the Apple Team ID. If you have replaced `ios.teamId` in `app.config.js`, this will work automatically during `expo prebuild`.

For manual archive/distribution, see [docs/deployment/deployment.md](../deployment/deployment.md).

---

## Adding reciters

See the detailed guide in [CLAUDE.md](../../CLAUDE.md#addingupdating-reciters-in-supabase) for the complete process including:

- Downloading audio from SoundCloud or MP3Quran.net
- Uploading to Supabase storage with the correct naming convention
- Inserting reciter and rewayat records
- Running `npm run fetch-reciters` to sync data to the app

---

## Audio sources

The app supports multiple audio source types defined in the `rewayat.source_type` column:


| Source type | URL pattern                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `supabase`  | `https://your-project.supabase.co/storage/v1/object/public/quran-audio/reciters/{folder}/{surah}.mp3` |
| `mp3quran`  | `https://server{N}.mp3quran.net/{reciter}/{surah}.mp3`                                                |


The server URL is stored in `rewayat.server` and the app constructs individual surah URLs by appending the zero-padded surah number and `.mp3`.
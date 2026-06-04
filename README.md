# Budget Tracker Quest Portal

A React, Vite, and Firebase-ready portal for a 100-level Python budget tracker class project.

Students join, choose their group, save progress with a progress code, follow a 7-level learning path, download the scattered Python starter kit, then unlock their group-specific feature pack.

## What Is Inside

- Neo-brutalist quest interface based on the Forge `neoBrutalism` design profile.
- Firebase anonymous-auth progress adapter, with localStorage fallback for local preview.
- 14 unique group feature packs in Markdown and PDF.
- A Python CLI starter kit ZIP with scattered snippets, a nudge guide, sample data, and a reference solution.
- Firestore security rules for progress records.

## Local Commands

```powershell
npm install
npm run generate:materials
npm run dev -- --port 64406 --strictPort
```

Open `http://127.0.0.1:64406/`.

## Verification

```powershell
npm test
npm run build
```

Generated student downloads are written to `public/downloads`.

## Firebase

For live hosting with saved cross-device progress, follow [FIREBASE_DEPLOY.md](./FIREBASE_DEPLOY.md).

## Vercel Frontend

The app can also be deployed on Vercel while Firebase handles Auth and Firestore.

Use the same `VITE_FIREBASE_*` values from `.env.local`, then deploy the Vite build:

```powershell
npm test
npm run build
npx -y vercel@latest deploy --prebuilt --prod
```

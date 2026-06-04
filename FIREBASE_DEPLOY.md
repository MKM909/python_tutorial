# Firebase Deploy Checklist

Use this when you are ready to make the portal live for the class.

Official docs:

- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [Anonymous Authentication](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Cloud Firestore security rules](https://firebase.google.com/docs/firestore/security/get-started)

## 1. Create Or Choose A Firebase Project

Do not reuse unrelated projects like a music app or another class app. Keep the class portal separate.

```powershell
npx -y firebase-tools@latest login
npx -y firebase-tools@latest projects:create your-budget-quest-id --display-name "Budget Tracker Quest"
npx -y firebase-tools@latest use --add your-budget-quest-id
```

If you already created the project from the Firebase Console, only run:

```powershell
npx -y firebase-tools@latest use --add your-project-id
```

## 2. Add A Web App And Get Config

```powershell
npx -y firebase-tools@latest apps:create WEB "Budget Tracker Quest Web" --project your-project-id
npx -y firebase-tools@latest apps:list --project your-project-id
npx -y firebase-tools@latest apps:sdkconfig WEB your-web-app-id --project your-project-id
```

Create `.env.local` from the returned config:

```powershell
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 3. Enable Anonymous Auth

In Firebase Console:

1. Open the project.
2. Go to Authentication.
3. Open Sign-in method.
4. Enable Anonymous.

This is required because the portal saves progress using anonymous users plus progress codes.

## 4. Create Firestore

If Firestore is not created yet:

```powershell
npx -y firebase-tools@latest firestore:databases:create "(default)" --location=eur3 --project your-project-id
```

Use a different location only if your school has a specific hosting/data requirement.

## 5. Build And Deploy

```powershell
npm run generate:materials
npm run build
npx -y firebase-tools@latest deploy --only hosting,firestore --project your-project-id
```

After deploy, open the Hosting URL and test this flow:

- Start a quest.
- Copy the progress code.
- Open the site in another browser or phone.
- Continue with the progress code.
- Mark one level complete.


import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
// Plot objects only include `color`/`groups` when set (see usePlotMapEngine's
// persist logic) - ignoreUndefinedProperties lets setDoc take those objects
// as-is instead of throwing on the `undefined` fields TypeScript's optional
// properties would otherwise leave behind.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });

const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

// VITE_USE_EMULATOR is independent of Vite's own DEV/PROD mode so a
// developer can point `npm run dev` at the real prod project (to debug a
// prod-only issue) without that being tangled to the build mode.
if (useEmulator) {
  connectFirestoreEmulator(db, 'localhost', 8080);
}

// True only for `npm run dev` pointed at a real (non-emulator) project -
// e.g. reading prod to debug an issue, per the comment above. Reads are
// still allowed in that case; plotsRepo.ts uses this to block writes, so a
// local dev session can never mutate real data no matter how .env.local is
// configured - only a built/deployed app (import.meta.env.DEV is false) or
// a dev session correctly pointed at the emulator can write. To edit
// locally, pull a copy of prod into the emulator first (`npm run
// sync:pull`), then edit that copy - never prod directly.
export const isReadOnlyRemote = import.meta.env.DEV && !useEmulator;

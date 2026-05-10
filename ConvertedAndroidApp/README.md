# ConvertedAndroidApp

Native Android Studio conversion of the React B.Nook app.

## What Was Converted

- React `useState` / app-level state became Java fields in `MainActivity`.
- React `useEffect` data loading became `AsyncRunner` background calls with main-thread callbacks.
- `localStorage` keys became `SharedPreferences` in `SessionStore`.
- `services/db.ts` became `BookNookRepository`, preserving the same local API endpoints.
- Tailwind/CSS module design tokens became `Design.java`, XML values, rounded drawable backgrounds, and native Android views.
- Lazy React pages became native render methods: Dashboard, Library/Reader, Feed, The Grid, Oracle, Profile, Auth.

## API Configuration

The app points to `http://10.0.2.2:8787/api` by default so an Android emulator can reach the existing local API running on the host machine.

To change it, edit:

`app/src/main/res/values/strings.xml`

## Build

Open this folder in Android Studio or run:

```bash
./gradlew :app:assembleDebug
```

The debug build was verified successfully on this machine.

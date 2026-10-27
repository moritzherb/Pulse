# Try Pulse on your phone

A simple, step-by-step guide. Part 1 shows the app with simulated Vienna data and no
backend. Part 2 (optional) connects a real Supabase backend.

## What you need

- A computer (Mac, Windows or Linux) with [Node.js 22 LTS](https://nodejs.org) and
  [Git](https://git-scm.com).
- A free [Expo account](https://expo.dev/signup). The app is built in Expo's cloud, so
  you don't need a Mac for an iPhone build.
- To install on **your iPhone**: an [Apple Developer Program](https://developer.apple.com/programs/)
  membership ($99 / year). Without one, use an **Android phone** (free) or the **iOS
  Simulator** on a Mac with Xcode (free).

Expo Go does **not** work for Pulse (it uses a native map). You install your own test
build once, then it loads the latest code from your computer.

## Part 1: run it with simulated data

1. **Get the code**
   ```sh
   git clone https://github.com/moritzherb/Pulse.git
   cd Pulse
   npm install
   ```
2. **Log in to Expo and link the project** (once)
   ```sh
   npm install -g eas-cli
   eas login
   eas init
   ```
   Answer yes to creating the project. It saves the project ID in `app.json`.
3. **Build the test app** (once, about 15 to 20 minutes in the cloud)
   - **iPhone**
     ```sh
     eas device:create
     eas build --profile development --platform ios
     ```
     `eas device:create` gives you a link: open it on the iPhone and install the profile.
     During the build, sign in with your Apple account and let EAS create the
     certificates. When it is done, open the build link on the iPhone and install.
     Then turn on _Settings → Privacy & Security → Developer Mode_ and restart the phone.
   - **Android phone**
     ```sh
     eas build --profile development --platform android
     ```
     Open the build link on the phone and install the app (allow installing from your
     browser when asked).
   - **iOS Simulator (Mac with Xcode)**
     ```sh
     eas build --profile development-simulator --platform ios
     ```
     Download the build and drag it onto the open simulator.
4. **Start the app server**
   ```sh
   npm start
   ```
   Scan the QR code with the iPhone camera (Android: from inside the Pulse app). Phone
   and computer must be on the same Wi-Fi. If it doesn't connect, run
   `npx expo start --dev-client --tunnel` instead.
5. **Try it**
   - Tap **Just browse**: the map of Vienna with simulated crowds appears.
   - The simulation follows the real time in Vienna, so at night the map is quiet. That
     is expected.
   - Zoom in until hexagons appear, tap one, swipe the sheet up to see "Usually".
   - Tap the `{}` button: "What's sent". The **Simulated feed** switch is at the bottom.
   - Settings: switch Appearance to Dark; try "Never share where I am now".

You only repeat step 3 when native settings change. For normal code changes, `npm start`
is enough.

## Part 2 (optional): connect a real backend

Use a test project, not the one you will launch with.

1. **Create a Supabase project** at [supabase.com](https://supabase.com): region
   _Frankfurt_ (EU). Write down the database password.
2. In the dashboard: _Authentication → Sign In / Providers → Anonymous sign-ins_: **on**.
3. **Set up the database and functions**
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   npx supabase functions deploy ping delete-me
   npx supabase secrets set PING_MIN_ACCOUNT_AGE_SECONDS=0
   ```
   `<your-ref>` is the code in your project URL `https://<your-ref>.supabase.co`. The
   last line lets your first ping count immediately (for testing only).
4. **Add the keys**
   ```sh
   cp .env.example .env
   ```
   Fill in `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL`: _Project Settings → API_: Project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: _Project Settings → API Keys_: anon / publishable key
   - `DATABASE_URL`: _Connect_ button → _Session pooler_; replace `[YOUR-PASSWORD]`
5. **Add data**
   ```sh
   npm run import:osm -- --yes
   npm run seed -- --yes
   npm run seed -- --live --yes
   ```
   Real Vienna venues, 28 days of simulated history, then simulated phones every
   minute. Keep the last one running in its own terminal window. (`--yes` is needed
   because the scripts refuse non-local databases by default.)
6. **Restart the app server**: `npx expo start --dev-client --clear`, then reopen the app.
   The map now shows live data that updates every minute.
7. **Test sharing**: Settings → **Share my area** on. After a few minutes, "What's sent"
   shows a last update and Settings shows your rotating ID.
8. **Clean up later**: `npm run seed -- --reset --yes` removes all simulated data.

## If something doesn't work

| Problem                                       | Fix                                                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| Scanning the QR code opens Expo Go or nothing | Install your own test build first (step 3)                                        |
| The app can't reach your computer             | Same Wi-Fi, or `npx expo start --dev-client --tunnel`                             |
| The map is empty                              | Night in Vienna (simulation), or you are looking at another city: search "Vienna" |
| Changes to `.env` don't show                  | Restart with `npx expo start --dev-client --clear`                                |
| `supabase db push` asks for a password        | The database password from Part 2, step 1                                         |

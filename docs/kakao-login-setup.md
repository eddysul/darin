# Kakao login setup

The app uses Kakao OAuth through Supabase Auth. Kakao credentials must stay in
the Kakao/Supabase dashboards and must not be added to Expo environment files.

## Kakao Developers

1. Create or open the Darin application.
2. In **App > Platform key**, copy the **REST API key**.
3. Open that REST API key, enable Kakao Login, and add this redirect URI:

   `https://efipxojpdirvkeyfdfzl.supabase.co/auth/v1/callback`

4. Create/enable the REST API **Client Secret** and copy it.
5. Configure the consent screen. Nickname is recommended; email may remain
   optional because Kakao accounts do not always provide an email address.

## Supabase

1. Open project `efipxojpdirvkeyfdfzl`.
2. Go to **Authentication > Sign In / Providers > Kakao**.
3. Enable Kakao and enter the REST API key as Client ID and the Kakao Client
   Secret as Client Secret.
4. In **Authentication > URL Configuration**, ensure the redirect allow list
   contains `knanny://auth/callback`.
5. For anonymous-user identity linking, enable **Allow manual linking**.

## Expo / EAS

Set these non-secret public feature flags in the `production` EAS environment:

```text
EXPO_PUBLIC_SHOW_KAKAO_LOGIN=true
EXPO_PUBLIC_ENABLE_KAKAO_LOGIN=true
```

Local development uses the same values from `.env`. A new binary is not
required when only the Supabase/Kakao dashboard configuration changes, but an
EAS build must include the flags before the button is enabled in that binary.

## Device smoke test

1. Start from a signed-out account and complete Kakao login.
2. Confirm the app returns through `knanny://auth/callback` and opens onboarding
   or the existing baby workspace.
3. Repeat from an anonymous account that already owns records and confirm the
   user ID and records are preserved.
4. Cancel the Kakao consent screen and confirm the app returns without creating
   a session or showing a false success state.

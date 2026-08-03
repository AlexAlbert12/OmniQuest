# Maestro mobile smoke tests

The flow `public-login-smoke.yaml` verifies the public entry point, navigation to login and client-side validation on an Android/iOS build.

Run it against an installed development or preview build:

```bash
maestro test .maestro/public-login-smoke.yaml
```

The application identifier is read from `app.json`: `com.alexalbert.omniquest`.

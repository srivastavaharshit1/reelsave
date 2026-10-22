# ReelSave

ReelSave is a responsive web application starter for entering Instagram Reel URLs. It validates Reel links and defines a provider boundary for future authorized media resolution. The current media provider is unavailable and the application does not download media.

## Architecture

- `frontend/`: React, TypeScript, Vite, Tailwind CSS, and ESLint.
- `backend/`: Java 21 target, Spring Boot REST API, Maven, Spring Web, Validation, and Actuator.
- The frontend's API client reads `VITE_API_BASE_URL` and centralizes backend requests.
- Backend packages are organized under `com.reelsave` by controller, service, DTO, configuration, and exception concerns.

## Requirements

- Node.js 20 or later and npm
- JDK 21 for production; local builds need a JDK capable of targeting Java 21
- Maven 3.9 or later

Maven uses the JDK selected by `JAVA_HOME` (or the `java` executable on `PATH`). Production builds and runtime deployments should use JDK 21. Confirm the selected versions with `java -version` and `mvn -version` before building.

### Local Java environment

The development machine used for the foundation verification has JDK 23.0.1 installed. JDK 21 was not found under the standard Java installation locations or on the active Java path. Maven tests and packaging ran on JDK 23. The project remains configured to compile for Java 21: both `java.version` and the Maven compiler `release` are set to `21` in `backend/pom.xml`. No system-wide Java installation was attempted.

## Run the frontend

```sh
cd frontend
npm install
npm run dev
```

The frontend runs at [http://localhost:5173](http://localhost:5173). Copy `.env.example` to `.env` to override the API base URL. The default is `http://localhost:8080`.

Run the frontend checks from `frontend/`:

```sh
npm test -- --run
npm run lint
npm run build
```

The download workflow only shows a preview or download action for a complete `READY` response whose HTTPS media host is explicitly allowed. Set `VITE_MEDIA_ALLOWED_HOSTS` to a comma-separated list of trusted hostnames when configuring a future provider; it is empty by default.

## Run the backend

```sh
cd backend
mvn spring-boot:run
```

The backend runs at [http://localhost:8080](http://localhost:8080). Configuration can be overridden with Spring environment variables, including `SERVER_PORT` and `REELSAVE_CORS_ALLOWED_ORIGINS`.

### Starting a clean backend instance

Before starting ReelSave, check whether another process already owns port 8080. In PowerShell:

```powershell
$listener = Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object -First 1
if ($listener) {
  Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" |
    Select-Object ProcessId, Name, CommandLine
}
```

Confirm the process command line belongs to ReelSave before stopping an old development instance. If another application owns port 8080, leave it running and use a free port. For example, start the backend on 8081 and allow the Vite origin:

```powershell
$env:SERVER_PORT = "8081"
$env:REELSAVE_CORS_ALLOWED_ORIGINS = "http://localhost:5173"
cd backend
mvn spring-boot:run
```

Set `VITE_API_BASE_URL=http://localhost:8081` in `frontend/.env.local` for that session, then start Vite from `frontend/`. Verify the server before testing the UI with `Invoke-RestMethod http://localhost:8081/api/v1/health`.

## Build and deploy the backend

Use JDK 21 for production packaging and runtime:

```sh
cd backend
mvn clean package
java -jar target/reelsave-api-0.1.0-SNAPSHOT.jar
```

The API is served at [http://localhost:8080](http://localhost:8080) by default.

Run the backend checks from `backend/`:

```sh
mvn clean test
mvn clean package
```

The backend test suite also runs during `mvn clean package`.

## Health endpoint

`GET http://localhost:8080/api/v1/health` returns:

```json
{"status":"UP","service":"reelsave-api"}
```

The frontend calls this through `frontend/src/api/client.ts`; the home page shows whether the API is reachable. Development CORS allows the local Vite origin by default.

`POST http://localhost:8080/api/v1/reels/validate` accepts `{"url":"https://www.instagram.com/reel/ABC123/"}`. Valid Reel URLs return HTTP 200 with `valid: true`; invalid URLs return HTTP 400 with `valid: false`.

## Media Provider Architecture

Media resolution is abstracted behind the `MediaProvider` interface so the application service and API contract do not depend on how an authorized source supplies media. A future authorized provider can be added behind this interface without rewriting the controller or frontend API client.

The current provider is `unavailable`, selected with `media.provider=unavailable` (or `MEDIA_PROVIDER=unavailable`). It returns `UNAVAILABLE`; it does not contact Instagram, scrape pages, call unofficial endpoints, or download media. No real media URL is generated. The application does not currently download media.

`POST http://localhost:8080/api/v1/reels/resolve` accepts a JSON body such as:

```json
{"url":"https://www.instagram.com/reel/ABC123/"}
```

Valid Reel URLs return HTTP 503 with:

```json
{"status":"UNAVAILABLE","message":"Media download is not currently available."}
```

Invalid URLs are rejected with HTTP 400. The provider receives only a validated `ReelUrl`, and the unavailable implementation makes no outbound HTTP requests.

## Frontend dependency audit

The registry-backed audit on 2026-10-22 reported **12 advisories: 4 moderate, 6 high, and 2 critical** in development tooling. `npm audit --omit=dev` reported **0 vulnerabilities** in the production dependency tree. The direct development dependencies implicated are `vitest` (critical), `tailwindcss` (high), and `vite` (high); vulnerable transitive packages include `@vitest/mocker`, `tinypool`, `braces`, `chokidar`, `fast-glob`, `micromatch`, `esbuild`, `postcss-nested`, and `postcss-selector-parser`.

`npm audit fix --dry-run` found no semver-safe fix. The available `--force` plan would make major upgrades to Vitest 5, Tailwind CSS 4, and Vite 8, so no dependency versions were changed. Re-run the audits when updating the frontend toolchain.

## Current limitations

- Reel URLs are validated by the backend. Resolve requests currently report that the media provider is unavailable.
- No media is fetched and no download URL or preview is generated.
- No database, Redis, authentication, advertising, or payment functionality is included.
- Privacy, terms, and copyright policy links are placeholders.

## Future development

1. Select and configure a compliant media provider for content the user is authorized to download.
2. Add strict validation for any provider-supplied media locations and metadata.
3. Add persistence or other infrastructure only when the product requirements call for it.
4. Add privacy, terms, and copyright policy content before public launch.

ReelSave must not scrape private accounts or bypass authentication, CAPTCHAs, access controls, rate limits, or other technical restrictions.

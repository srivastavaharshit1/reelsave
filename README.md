# ReelSave

ReelSave validates public Instagram Reel links, previews provider-resolved MP4 media, and downloads a bounded temporary copy through its backend. It does not access private content or use login credentials, cookies, browser sessions, CAPTCHA bypass, proxy rotation, or undocumented Instagram APIs.

## Architecture

- `frontend/`: React, TypeScript, Vite, Tailwind CSS, Vitest, and ESLint.
- `backend/`: Spring Boot REST API targeting Java 21, built with Maven.
- `MediaProvider` contains the metadata-resolution boundary. A provider with download capability also implements `MediaDownloadProvider`.
- The frontend calls backend APIs through the centralized client in `frontend/src/api/client.ts`.
- The default provider is unavailable. `YtDlpMediaProvider` is opt-in with `MEDIA_PROVIDER=ytdlp`.

## Requirements

- Node.js 20 or later and npm 10 or later
- JDK 21 for production; local development can use a newer JDK that supports `--release 21`
- Maven 3.9 or later
- The official yt-dlp executable, installed separately, to enable media resolution/download

Production packaging and runtime must use Java 21. Confirm the selected toolchain with `java -version`, `mvn -version`, `node --version`, and `npm --version`.

The backend uses Spring Boot 4.1.2, the current stable supported 4.1.x release as of October 23, 2026 ([release](https://github.com/spring-projects/spring-boot/releases/tag/v4.1.2), [supported versions](https://github.com/spring-projects/spring-boot/wiki/Supported-Versions)). The migration keeps Java 21 and Maven, uses the modular MVC and MVC-test starters, and updates JSON tree/mapper APIs to Jackson 3. Spring Boot 4.1 requires Java 17 or newer and Spring Framework 7.0.10 or newer; Java 21 remains the project target and production runtime ([system requirements](https://docs.spring.io/spring-boot/4.1/system-requirements.html), [Boot 4 migration guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)). The REST routes, response contracts, validation, provider boundary, CORS policy, and rate limiter are unchanged.

### Current development environment

The current machine has JDK 23.0.1 and Maven 3.9.12; no JDK 21 installation was found in the standard Java installation locations checked. The project compiler remains configured with `<release>21</release>`, and the Boot 4.1.2 Maven test/build ran on JDK 23.0.1 while compiling for Java 21. Set `JAVA_HOME` to the installed JDK directory for Maven when needed. Production build and runtime must use JDK 21.

The installed Node.js is 24.11.0 and npm is 11.6.1. The installed yt-dlp is 2026.10.21. ffmpeg and ffprobe are not available on `PATH`; no ffmpeg merge path is used.

## Run the frontend

```sh
cd frontend
npm install
npm run dev
```

Vite serves the app at [http://localhost:5173](http://localhost:5173). During local development it proxies `/api` requests to `http://localhost:8080` by default. Set `VITE_DEV_API_PROXY_TARGET` if the backend uses another local port. The production bundle has no localhost API default: when `VITE_API_BASE_URL` is blank, API requests use same-origin `/api` paths. Either route those paths to the backend at the production reverse proxy, or set `VITE_API_BASE_URL` to the backend's HTTPS base URL at build time.

Run frontend checks from `frontend/`:

```sh
npm test -- --run
npm run lint
npm run build
```

The frontend only previews a complete `READY` response whose media URL is HTTPS on a subdomain of `cdninstagram.com` and whose declared type is `video/mp4`. Preview URLs are temporary and remain in page memory only. The download action calls the backend with the Reel URL; it does not rely on a cross-origin `<a download>` attribute.

The Privacy, Terms, Copyright & takedown, and Abuse & contact pages are available at `/privacy`, `/terms`, `/copyright`, and `/contact`. Configure `VITE_CONTACT_EMAIL` to publish a monitored contact address before public launch. Set `VITE_PUBLIC_SITE_URL` to the canonical HTTPS site origin at build time to emit canonical and Open Graph URL metadata; these are omitted when no public domain is configured. `robots.txt` allows indexing. A sitemap is omitted until the production domain and routes are finalized.

## Run the backend

```sh
cd backend
mvn spring-boot:run
```

By default, Spring Boot serves the API at [http://localhost:8080](http://localhost:8080). CORS is disabled by default, which is suitable for same-origin production deployments behind a reverse proxy and for the Vite development proxy. If another local app owns the backend port or the frontend calls the backend directly from a different origin, configure the local values in the current shell:

```powershell
$env:SERVER_PORT = "8081"
$env:REELSAVE_CORS_ALLOWED_ORIGINS = "http://localhost:5173"
cd backend
mvn spring-boot:run
```

Set `VITE_API_BASE_URL=http://localhost:8081` in `frontend/.env.local` for that session. Do not stop another process that owns a development port unless it is confirmed to be ReelSave.

## API

- `GET /api/v1/health` returns `{"status":"UP","service":"reelsave-api"}`.
- `POST /api/v1/reels/validate` accepts JSON `{"url":"https://www.instagram.com/reel/ABC123/"}`. Valid URLs return HTTP 200; invalid URLs return HTTP 400.
- `POST /api/v1/reels/resolve` accepts the same JSON request. It returns `READY` only when the provider returns a usable HTTPS MP4 URL on `*.cdninstagram.com`; otherwise it returns `UNAVAILABLE` or a safe `ERROR` response.
- `POST /api/v1/reels/download` accepts `application/x-www-form-urlencoded` with a single `url` field containing a Reel URL. It revalidates the URL, invokes the configured download-capable provider, then returns an MP4 attachment such as `reelsave-ABC123.mp4`.

The download endpoint is dedicated to validated Reel URLs. It does not accept media URLs and is not a general-purpose proxy. Invalid input returns HTTP 400, no enabled download provider returns HTTP 503, and provider failures return safe HTTP 502 responses. Raw yt-dlp stderr and signed CDN URLs are not included in error messages.

## Configure yt-dlp

Install the official yt-dlp executable separately from ReelSave. Put it on `PATH` or set `YTDLP_EXECUTABLE` to its local executable path. Then opt in to the provider:

```powershell
$env:MEDIA_PROVIDER = "ytdlp"
$env:YTDLP_EXECUTABLE = "yt-dlp.exe"
$env:YTDLP_TIMEOUT_SECONDS = "30"
$env:YTDLP_DOWNLOAD_TIMEOUT_SECONDS = "120"
cd backend
mvn spring-boot:run
```

Configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MEDIA_PROVIDER` | `unavailable` | Selects the provider. Use `ytdlp` to enable it. |
| `YTDLP_EXECUTABLE` | `yt-dlp` | Executable name on `PATH` or a configured local path. |
| `YTDLP_TIMEOUT_SECONDS` | `30` | Metadata resolution timeout. |
| `YTDLP_DOWNLOAD_TIMEOUT_SECONDS` | `120` | Download process timeout. |
| `YTDLP_MAX_DOWNLOAD_BYTES` | `52428800` | Maximum media file size in bytes (1–52,428,800). |
| `SERVER_PORT` | `8080` | Backend HTTP port. |
| `REELSAVE_CORS_ALLOWED_ORIGINS` | unset (no cross-origin browser origins allowed) | Exact comma-separated browser origins. Set the frontend HTTPS origin for direct cross-origin deployments; leave unset for same-origin proxy routing. |
| `REELSAVE_RATE_LIMIT_ENABLED` | `true` | Enables the bounded process-local client limiter on Reel validate/resolve/download routes. |
| `REELSAVE_RATE_LIMIT_REQUESTS_PER_WINDOW` | `30` | Maximum Reel operations per remote address per window (1–100,000). |
| `REELSAVE_RATE_LIMIT_WINDOW_SECONDS` | `60` | Fixed-window duration (1–3600 seconds). |
| `REELSAVE_RATE_LIMIT_MAX_CLIENTS` | `10000` | Maximum tracked remote addresses (1–100,000); new addresses receive HTTP 429 while the map is full. |
| `REELSAVE_LOGGING_LEVEL_ROOT` | `INFO` | Root logging level. Keep production at INFO; ReelSave does not log submitted URLs or raw yt-dlp output. |
| `VITE_API_BASE_URL` | same-origin | Frontend backend base URL. Leave blank when the production host routes `/api` to the backend. |
| `VITE_DEV_API_PROXY_TARGET` | `http://localhost:8080` | Local Vite development proxy target; not included in the production bundle. |
| `VITE_PUBLIC_SITE_URL` | unset | Public site origin used for canonical and Open Graph URL metadata. |
| `VITE_CONTACT_EMAIL` | unset | Public contact address shown on policy pages. |
| `VITE_DOWNLOAD_MAX_BYTES` | `52428800` | Frontend response-size cap; match `YTDLP_MAX_DOWNLOAD_BYTES` and keep at or below 52,428,800. |

`backend/.env.example` is a reference only; Spring Boot does not load `.env` files automatically. Export the variables in the process environment before starting the backend. Do not put secrets in the example file.

Both yt-dlp timeouts are limited to 300 seconds. Metadata extraction uses fixed arguments, no shell, no cookies, no browser state, and no user-supplied process options. The Reel URL is parsed and validated before being passed as one process argument.

Resolution asks yt-dlp for `best[ext=mp4][height<=1080]/best[ext=mp4]`: it prefers a progressive MP4 at or below 1080p and falls back to a progressive MP4 when Instagram omits dimensions. The resolver rejects an explicit video-only format, a combined separate-stream selection, non-MP4 output, and media URLs outside HTTPS `*.cdninstagram.com`. The download uses the same format selection, sets yt-dlp retry counts to zero, limits file size through `YTDLP_MAX_DOWNLOAD_BYTES` (default 50 MiB, hard maximum 50 MiB), limits each backend process to four concurrent metadata lookups and two concurrent downloads, and writes only to a unique OS temporary directory. Set the frontend build variable `VITE_DOWNLOAD_MAX_BYTES` to the same value so the browser and backend enforce a matching limit. Before returning it, the backend checks the MP4 container's `ftyp` and requires both video and audio track headers. The temporary media file is deleted when the response completes. No ffmpeg merge is used: a Reel without a usable progressive MP4 is reported as unavailable instead of being silently stripped of audio.

## Production deployment

Recommended request and media flow:

```text
Internet
  |
HTTPS reverse proxy / CDN / WAF
  |
same-origin /api
  |
Java 21 ReelSave backend
  |
official yt-dlp executable
  |
restricted outbound Internet (DNS + HTTPS to permitted public Instagram/CDN destinations)
```

Serve the frontend as static HTTPS content. Route same-origin `/api` requests through the reverse proxy to the Java backend. Keep the backend off the public network and run it with a non-root identity and only its temporary download directory writable. Do not configure a localhost API URL in the production frontend; leave `VITE_API_BASE_URL` blank for same-origin routing. Set `VITE_PUBLIC_SITE_URL` to the real HTTPS origin and `VITE_CONTACT_EMAIL` to a monitored address before launch. Do not invent either value.

### Production environment

Vite embeds frontend build values in public static assets. Configure `VITE_API_BASE_URL`, `VITE_PUBLIC_SITE_URL`, `VITE_CONTACT_EMAIL`, and `VITE_DOWNLOAD_MAX_BYTES`; the download limit must match `YTDLP_MAX_DOWNLOAD_BYTES` and remain at or below 52,428,800 bytes.

Configure the backend process with `SERVER_PORT`, `MEDIA_PROVIDER=ytdlp`, `YTDLP_EXECUTABLE`, `YTDLP_TIMEOUT_SECONDS`, `YTDLP_DOWNLOAD_TIMEOUT_SECONDS`, and `YTDLP_MAX_DOWNLOAD_BYTES`. Use `REELSAVE_CORS_ALLOWED_ORIGINS` only for exact cross-origin frontend origins; leave it unset for same-origin proxy routing. The bounded rate limiter and logging level are configurable with `REELSAVE_RATE_LIMIT_ENABLED`, `REELSAVE_RATE_LIMIT_REQUESTS_PER_WINDOW`, `REELSAVE_RATE_LIMIT_WINDOW_SECONDS`, `REELSAVE_RATE_LIMIT_MAX_CLIENTS`, and `REELSAVE_LOGGING_LEVEL_ROOT`. Spring Boot does not load `.env` files automatically. Do not place secrets in frontend build variables or commit real environment files.

Production should provide HTTPS, edge/WAF per-client rate limiting, request-size and request-timeout limits, download-size limits, restricted outbound egress, CPU/memory/process limits, monitoring and alerting, and log retention appropriate to privacy needs. The application limiter and semaphores are bounded but process-local, and they do not replace edge controls. Configure egress to deny loopback, private, link-local, and cloud metadata address ranges after DNS resolution; ReelSave does not implement DNS pinning. Install a pinned, verified official yt-dlp binary as a separately maintained artifact. Docker files were not added because a Docker build could not be verified in this environment.

## Build and deploy

Use JDK 21 for production build and runtime:

```sh
cd backend
mvn clean package
java -jar target/reelsave-api-0.1.0-SNAPSHOT.jar
```

The backend defaults to port 8080. Install yt-dlp separately on the deployment host and configure `YTDLP_EXECUTABLE` and `MEDIA_PROVIDER=ytdlp` only where outbound access to public Instagram and its media CDN is permitted. ReelSave does not bundle yt-dlp. Do not add credentials, cookies, or browser sessions.

Build the frontend from `frontend/` with `npm ci` and `npm run build`, then publish `frontend/dist/` on the chosen static host. Configure `VITE_API_BASE_URL`, `VITE_PUBLIC_SITE_URL`, and a monitored `VITE_CONTACT_EMAIL` in the build environment; Vite embeds these values in the generated assets. For a cross-origin frontend/API deployment, set `REELSAVE_CORS_ALLOWED_ORIGINS` to the exact HTTPS frontend origin; leave it empty for same-origin reverse-proxy routing. Configure `SERVER_PORT` and the provider executable in the backend runtime. The static host must serve `index.html` as the fallback for the `/privacy`, `/terms`, `/copyright`, and `/contact` routes.

No Docker images or compose file are included. The current backend expects an independently provisioned yt-dlp executable; a container release should pin and verify the official binary and be built/tested with an available Docker engine before it is added.

The Maven Surefire configuration preloads the project-managed Mockito agent and the JDK URL classpath workaround used for this Windows/JDK test environment. Run the ordinary Maven commands:

```sh
mvn clean test
mvn clean package
```

## Security, limitations, and product policies

- Input URLs must be HTTPS Reel URLs on `instagram.com` or `www.instagram.com`; profile and post URLs are rejected.
- Provider media URLs must be HTTPS URLs on a subdomain of `cdninstagram.com`. The backend does not fetch client-supplied media URLs or follow arbitrary redirects.
- URL validation limits requests to Instagram Reel hostnames, but it does not pin DNS answers or control every upstream redirect used inside yt-dlp. Apply hosting egress controls for Instagram and its media CDN where supported; do not expose the service from a network that grants the process unrestricted access to sensitive internal services.
- The API applies a bounded fixed-window limit of 30 Reel operations per remote socket address per 60 seconds by default. It stores at most 10,000 addresses and returns HTTP 429 with `Retry-After` when a limit or capacity is reached. This limiter is per process, uses the servlet remote address, and deliberately does not trust `X-Forwarded-For`; behind a reverse proxy, it may see the proxy address for every client. Keep an edge/WAF or trusted reverse-proxy per-client limit in production. The in-memory limiter is an extra local guard, not a distributed abuse-control system.
- yt-dlp runs as a subprocess with separate process arguments, bounded captured output, a timeout, process-tree termination, and no configuration/cookie loading. Public API errors never include raw process output.
- Downloads use a temporary file with a 50 MiB cap and a two-job process-local concurrency limit; metadata lookups are limited to four concurrent jobs per backend process. A process crash may leave OS temporary data for ordinary host cleanup; no media is written into the repository or persistent storage.
- Before public exposure, put the API behind HTTPS ingress with request-size and timeout limits, per-client rate limits, and access logging that excludes request bodies. The backend semaphores and IP limiter are process-local; CORS is a browser policy, not an API abuse-control boundary. Configure appropriate HTTPS and security headers at the frontend host.
- There is no database, Redis, authentication, advertising, or payment functionality. Before public launch, configure a monitored contact address, review policy wording for the operating jurisdiction and actual hosting/log retention, add operational abuse controls, and confirm the correct copyright-agent process for the operator. These pages describe the current application design but do not replace legal advice or establish a statutory safe harbor.
- Users must have the rights or permission needed to save content and follow applicable platform terms and copyright law. ReelSave is independent and not affiliated with Instagram or Meta.
- Stop when Instagram refuses, rate-limits, or otherwise restricts access. Do not add retries that circumvent restrictions, private-account access, CAPTCHA bypass, credential/cookie support, or proxy rotation.

The backend needs outbound DNS and HTTPS on port 443 to Instagram and public media CDN hosts returned for a Reel. CDN hostnames vary, so a rigid IP allowlist can break legitimate requests. Use an egress gateway/network policy that permits required public destinations while denying loopback, private, link-local, and cloud metadata address ranges after DNS resolution; yt-dlp performs its own network requests and the application cannot pin every DNS answer or constrain all redirects internally. yt-dlp needs no inbound network access.

### Production hosting recommendation

Publish the built frontend to a static HTTPS host and route same-origin `/api` requests through an HTTPS reverse proxy to a dedicated Java 21 backend service. Run the backend as a non-root service with only its temporary directory writable, configure edge request-size/time limits and per-client rate limiting, and allow outbound DNS/HTTPS only through the hosting egress policy described above. Install a pinned, verified official yt-dlp executable as an independently managed deployment artifact. Docker was not added: no Docker engine is available here to build and verify images, and yt-dlp needs a separately maintained official-binary pinning and update process.

## Verification record

On 2026-10-23, Instagram and npm DNS/HTTPS checks succeeded with the available outbound network permission; DNS calls made inside the restricted command sandbox returned access denied. yt-dlp 2026.10.21 retrieved metadata for the public Reel `Dey-qwUojgL` without cookies or browser state. Instagram reported a progressive MP4 with incomplete codec/dimension fields alongside separate DASH streams. The Spring Boot provider resolved that Reel and the browser preview rendered it. Clicking Download sent the ReelSave download request and Chrome saved `reel-Dey-qwUojgL.mp4` (1,276,424 bytes). The downloaded file had an MP4 `ftyp` box and the application's MP4 inspector found both `vide` and `soun` tracks. This verifies an audio track is present; browser audio was not independently listened to. The provider verifies both tracks before serving a download. No credentials or cookies were used. The homepage was visually checked at 320, 375, 768, 1024, and 1280 pixel viewport widths without horizontal overflow. A missing favicon that produced browser 404s was corrected with a first-party SVG icon.

After the release-candidate review changes, the packaged backend and updated frontend were tested again with the same public Reel. The UI validation and single resolve flow returned `READY`; the browser loaded the 720×1280 preview with no media error. One download completed as a non-empty 1,276,424-byte MP4, and `Mp4Inspector` confirmed the MP4 container plus video and audio tracks. The browser console had no warnings or errors. The test file was saved outside the repository and is not tracked.

After the release security/configuration changes, the same browser journey was run once through Vite and the packaged Spring Boot backend. Validation succeeded, the provider returned `READY`, the 720×1280 preview reached `readyState=4`, and one 1,276,424-byte MP4 was downloaded. `Mp4Inspector` confirmed an MP4 with video and audio tracks; the downloaded file and temporary inspection helper were deleted after verification. The bounded in-memory rate limiter is covered by unit and MVC tests and returns HTTP 429 with `Retry-After` when the configured limit is exceeded.

The registry-backed audit on 2026-10-23 reported 12 development-tooling advisories: 4 moderate, 6 high, and 2 critical. The affected direct development dependencies are Vite, Tailwind CSS, and Vitest; affected transitive packages include esbuild, `@vitest/mocker`, tinypool, chokidar, braces, micromatch, fast-glob, postcss-nested, and postcss-selector-parser. `npm audit --omit=dev` reported 0 production advisories. `npm audit fix --dry-run` found no semver-safe fix; the available fix plan requires major upgrades to Vite 8, Tailwind CSS 4, and Vitest 5. No dependency updates were made. Keep the Vite development server private and re-run the audit when planning those toolchain migrations.

Before the Boot 4 migration on 2026-10-23, backend `mvn clean test` and `mvn package` both passed (49 tests, 0 failures/errors); frontend `npm test -- --reporter=dot` passed (54 tests), and `npm run lint` and `npm run build` passed. `/api/v1/health` and `/actuator/health` both returned healthy responses. A fresh browser end-to-end test using the public Reel `Dey-qwUojgL` reached `READY`, loaded the 720×1280 preview, and downloaded a 1,276,424-byte MP4. Its MP4 container had `ftyp` and `moov` boxes plus video (`vide`) and audio (`soun`) tracks. No credentials, cookies, browser sessions, or private content were used. Unmapped API resources now return a sanitized HTTP 404. At that point the release gate was **NOT READY FOR PRODUCTION** because Boot 3.5.16 was the final OSS release of its minor line.

After migration to Spring Boot 4.1.2 on 2026-10-23, backend `mvn clean test` and `mvn package` passed (49 tests, 0 failures/errors); the Java compiler used `--release 21`. Frontend `npm test -- --reporter=dot` passed (54 tests), `npm run lint` passed, and `npm run build` passed. The packaged Spring Boot app returned HTTP 200 with `UP` from both `/api/v1/health` and `/actuator/health`. The public Reel `Dey-qwUojgL` completed the UI validation, returned `READY`, loaded a 720×1280 preview (`readyState=4`), and downloaded a 1,276,424-byte MP4 through ReelSave. `Mp4Inspector` confirmed the MP4 container and both video and audio tracks. The downloaded verification file was moved to the Recycle Bin after inspection. The browser reported no console warnings or errors; all policy routes, favicon, and `robots.txt` returned/loaded successfully; the homepage had no horizontal overflow at the 1280-pixel test viewport. No browser credentials, cookies, sessions, or private content were used.

The registry-backed npm audits on 2026-10-23 reported 12 development-tooling advisories (4 moderate, 6 high, 2 critical) and 0 production dependency advisories. The affected direct development dependencies are Vite, Tailwind CSS, and Vitest; the available fixes require major upgrades to Vite 8, Tailwind CSS 4, and Vitest 5. No frontend dependencies were changed. The app was built locally without setting a public domain or contact email, so canonical/Open Graph URL metadata is intentionally omitted in this local build. Before public launch, set the real HTTPS `VITE_PUBLIC_SITE_URL`, a monitored `VITE_CONTACT_EMAIL`, production API/CORS values, and the documented ingress, egress, and edge rate-limit controls. The release gate is **NOT READY FOR PRODUCTION** until those operator-owned production values and controls are configured and verified; this run verified the application locally, not a production deployment.

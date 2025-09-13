# Redirect Service Requirements

## Goal
Single `/redirect` endpoint (static page + JS) that reads query parameters and opens the appropriate native app deep link if available, otherwise gracefully falls back to the canonical web URL. Must be extremely fast (no heavy frameworks) and safe (no arbitrary open redirects).

## Supported Platforms & Content Types
| Platform  | Query Key(s) | Content Types Supported | Examples of Inputs Accepted |
|-----------|--------------|-------------------------|-----------------------------|
| YouTube   | `youtube`, `yt` | video, shorts, channel (id/name/handle), playlist, search, post, live | `dQw4w9WgXcQ`, `https://youtu.be/dQw4w9WgXcQ?t=43`, `@linusTechTips`, `UC_x5XG1OV2P6uZZ5FSM9Ttw`, `list=PL123..`, `shorts/dQw4w9WgXcQ`, search text |
| Instagram | `instagram`, `ig` | user profile, reel, post, story highlight (id), thread? (future) | `https://www.instagram.com/p/XXXX/`, `@username`, `reel/XXXX`, raw shortcode |
| LinkedIn  | `linkedin`, `li` | profile (person/company), post, article, job | full URL, `in/username`, `company/microsoft`, job id |
| X (Twitter)| `x`, `twitter`, `tw` | user profile, tweet, search, list | `@username`, `status/123`, raw tweet URL |
| Facebook  | `facebook`, `fb` | profile/page, post, photo, video, group | full URL, `permalink.php?story_fbid=...`, numeric id |
| TikTok    | `tiktok`, `tt` | user profile, video, search | full URL, `@username`, video id, search text |

## Query Parameter Structure
Only one platform param should be provided per request. (If multiple are present, precedence is deterministic: youtube > instagram > linkedin > x > facebook > tiktok). Optional meta params:
- `q` (generic) fallback if no platform-specific parameter given.
- `fallback` explicit URL to use ONLY if validated as same-origin whitelist (we may initially disallow to avoid open redirects).
- `intent=web` force skip app deep link (debug/testing).
- `delay` override ms delay before fallback (bounded 200-2000ms).

## High-Level Flow
1. Parse query params.
2. Identify target platform + raw input string.
3. Normalize / trim input.
4. Detect content type via ordered heuristics + regex.
5. Build structured descriptor: `{ platform, type, id/handle/... , canonicalWebUrl, appUrlCandidates: [] }`.
6. Attempt deep link (platform-specific scheme or intent URL) by assigning `window.location`.
7. Set timeout to fallback to canonical web URL if app not foregrounded.
8. Provide minimal UI status + manual link.

## Security & Safety Constraints
- No arbitrary redirect: only constructed known-good hostnames per platform.
- Strip dangerous characters; reject javascript: or data: inputs early.
- Length limits (e.g., max 512 chars input) to avoid abuse.
- Encode all dynamic segments with `encodeURIComponent`.
- Do not reflect raw input into DOM except inside `textContent`.
- Provide Content-Security-Policy meta (script self only, no inline except our small bootstrap— may later externalize JS to allow strict CSP nonce).

## Device / Platform Handling
- iOS: custom schemes (e.g., `youtube://`, `instagram://user?username=`) may work; if not, fallback.
- Android: try `vnd.youtube://` etc.; optionally craft `intent://` form for reliability.
- Desktop: often schemes open app if installed; still fallback to web.
- We cannot perfectly detect success; rely on visibility change or short timeout.

## Deep Link Patterns (Initial Set)
### YouTube
- App Schemes: `vnd.youtube://watch?v=VIDEO_ID`, `vnd.youtube://channel/CHANNEL_ID`, `vnd.youtube://playlist?list=PLAYLIST_ID`, `youtube://www.youtube.com/results?search_query=...`
- Web Canonical: `https://www.youtube.com/...`

### Instagram
- App Schemes: `instagram://user?username=HANDLE`, `instagram://media?id=MEDIA_ID`, `instagram://reel?id=REEL_ID` (some are unofficial / may change)
- Web: `https://www.instagram.com/<handle>/`, `https://www.instagram.com/p/SHORTCODE/`, `https://www.instagram.com/reel/SHORTCODE/`

### LinkedIn
- Limited reliable deep link scheme; attempt `linkedin://in/username` or `linkedin://profile/USER_ID`; fallback quickly to web: `https://www.linkedin.com/in/username/`

### X (Twitter)
- Schemes: `twitter://user?screen_name=HANDLE`, `twitter://status?id=TWEET_ID`, `twitter://search?query=...`
- Web: `https://x.com/HANDLE/status/TWEET_ID` or `https://x.com/HANDLE`

### Facebook
- Schemes: `fb://profile/ID`, `fb://page/ID`, `fb://group/ID`, `fb://photo/ID`, `fb://post/ID`
- Web: `https://www.facebook.com/<pageOrProfile>/` or specific permalink forms

### TikTok
- Scheme (less consistent): try `snssdk1128://user/profile/@HANDLE` or `snssdk1128://aweme/detail/VIDEO_ID`
- Web: `https://www.tiktok.com/@HANDLE/video/VIDEO_ID`

## Input Detection Heuristics (Per Platform Examples)
YouTube video id: `/^[a-zA-Z0-9_-]{11}$/`
YouTube playlist: `list=` param or `PL|UU|LL|OL` prefixed IDs.
YouTube shorts: path `/shorts/ID` or explicit keyword `shorts:` prefix.
Instagram reel vs post: path segment `reel/` vs `p/`.
X tweet: `/status/(\d{5,25})`.
Facebook numeric ID vs vanity; posts may have `story_fbid` or `posts/ID`.
TikTok video: path `@handle/video/(\d+)` or share URL with `video/`.

## Error Handling
- If input cannot be parsed reliably, treat as search (if platform supports) else show message and provide generic home URL.
- Expose `?debug=1` to show parsed JSON object on page for troubleshooting (no redirect until user clicks continue).

## Performance
- Single small JS (<10KB minified) inline or external.
- Avoid blocking external resources.
- Use fast regex, no dependencies.

## Accessibility / UX
- Provide clear text while redirecting.
- Manual link always present.
- `meta refresh` optional fallback after some seconds.

## Logging (Future)
- Could append `#r=platform-code` fragment for anonymized attribution if needed.

## Open Questions / Future Enhancements
- Add more platforms (Reddit, Pinterest, Threads) later via config.
- Consider bundling build pipeline if size grows.
- Service worker pre-cache? Probably unnecessary.

---
This document will guide the implementation in `src/config/platforms.js` and `src/redirect.js`.

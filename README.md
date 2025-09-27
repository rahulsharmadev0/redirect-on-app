# Universal Redirect (/redirect)

Production-ready static redirect utility to deep link into native apps (YouTube, Instagram, LinkedIn, X, Facebook, TikTok) and gracefully fallback to web URLs.

## Quick Start
Host the repository (any static host). Access:
```
/redirect.html?youtube=dQw4w9WgXcQ
/redirect.html?yt=https://youtu.be/dQw4w9WgXcQ?t=30
/redirect.html?instagram=@natgeo
/redirect.html?x=@github
/redirect.html?x=twitter.com/jack/status/20
/redirect.html?facebook=facebook.com/zuck/posts/10102577175875681
/redirect.html?tiktok=@scout2015
```
Rename or serve as `/redirect` path via a rewrite rule:
- Netlify: `/* /redirect.html 200` (if dedicated) or specific rule `/redirect /redirect.html 200`.
- Vercel: `"src": "/redirect", "dest": "/redirect.html"` in `vercel.json`.

## Supported Query Parameters
| Param (primary) | Aliases | Platform | Notes |
|-----------------|---------|----------|-------|
| `youtube` | `yt` | YouTube | Video ID, full URL, @handle, shorts, playlist, search text |
| `instagram` | `ig` | Instagram | @handle, post shortcode, reel URL |
| `linkedin` | `li` | LinkedIn | profile, company, post/activity, article, job |
| `x` | `twitter`,`tw` | X / Twitter | @handle, tweet id/url, list id, search: prefix |
| `facebook` | `fb` | Facebook | page vanity/id, post, video, photo, group |
| `tiktok` | `tt` | TikTok | @handle, video URL/id, search: prefix |

Additional parameters:
- `q` Generic search term (defaults to YouTube search if no platform param is given).
- `debug=1` Shows parsed descriptor JSON and halts redirect.
- `intent=web` Forces skip of app deep link (open web directly).
- `delay=<ms>` Override fallback delay (200–2000ms, default 800ms).

## Behavior
1. Determine platform from the first matching parameter (priority order: youtube > instagram > linkedin > x > facebook > tiktok).
2. Parse and classify content type using regex heuristics per platform.
3. Construct deep link scheme(s) and canonical web URL.
4. Attempt app open. If page not hidden after `delay`, redirect to web URL.
5. Provide manual link immediately for accessibility.

## Security Considerations
- No arbitrary host redirection: only whitelisted domains produced.
- Input length capped at 512 characters.
- Potentially dangerous schemes (javascript:, data:) are ignored by parsing logic.
- CSP restricts external resources and inline scripts.

## Debugging & Testing
Use `debug=1` to inspect classification:
```
/redirect.html?yt=https://youtu.be/dQw4w9WgXcQ?t=42&debug=1
```
You will see a JSON descriptor like:
```
{
  "platform": "youtube",
  "raw": "https://youtu.be/dQw4w9WgXcQ?t=42",
  "type": "video",
  "meta": { "videoId": "dQw4w9WgXcQ", "timestamp": "42" },
  "canonicalWebUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42",
  "appUrlCandidates": [ "vnd.youtube://watch?v=dQw4w9WgXcQ&t=42", "youtube://www.youtube.com/watch?v=dQw4w9WgXcQ" ],
  "errors": []
}
```

## Adding New Platforms
1. Add new object to `src/config/platforms.js` with `keys` and `parse(raw)`.
2. Append to exported `platforms` array.
3. Ensure canonical web URL uses official domain.
4. Provide `appUrlCandidates` best-first.

## Limitations / Notes
- Some deep link schemes are unofficial and may change (LinkedIn, TikTok variations). Fallback ensures functionality.
- Detecting successful app open is heuristic; not 100% reliable across all browsers (especially iOS Safari private mode).
- Intent URLs (Android) not yet implemented; can be appended as additional candidate format: `intent://<path>#Intent;package=<pkg>;scheme=https;end`.

## Performance
- Zero dependencies.
- Single network request (the page itself + module JS ~ few KB pre-minification).

## Roadmap Ideas
- Add analytics beacon (without PII) before redirect.
- Add more platforms (Reddit, Threads, Pinterest, Spotify, App Store).
- Implement Android `intent://` fallback pattern.
- Provide service worker precache (likely unnecessary).

## Local Development
Simply open `redirect.html` with query params. Because deep link schemes may be blocked by desktop environment if app not installed, testing on real devices is recommended (use remote debugging / QR code).

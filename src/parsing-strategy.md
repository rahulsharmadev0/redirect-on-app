# Parsing Strategy

A unified parsing pipeline will produce a normalized descriptor object:

```
Descriptor = {
  platform: 'youtube'|'instagram'|'linkedin'|'x'|'facebook'|'tiktok',
  raw: <original trimmed input>,
  type: <content type string>,
  meta: { ... platform specific extracted ids },
  canonicalWebUrl: <string>,
  appUrlCandidates: [ <deep link attempts best->worst> ],
  fallbackSearchUrl?: <string>,
  errors: string[]
}
```

## Pipeline Steps
1. Raw Input Sanitization
2. Attempt Full URL Parse (if contains '://' or starts with known host fragment)
3. Platform-Specific Detectors (ordered list of predicate + extractor)
4. If none match -> search (if supported) else error
5. Build canonical + app candidates

## Shared Helpers
- `isLikelyUrl(str)`
- `safeUrlParse(str)` returning URL or null
- `stripAt(handle)`
- `limitLength(str, max=512)`
- `encodeSeg(str)` wrapper for `encodeURIComponent`

## YouTube Detectors (in order)
1. Shorts URL: `/shorts/([a-zA-Z0-9_-]{11})` -> type: `shorts`
2. Standard Video watch: query `v` 11 chars -> type: `video`
3. youtu.be short URL path 11 chars -> type: `video`
4. Playlist: `list=` (ID pattern: `^(PL|UU|LL|OL)?[a-zA-Z0-9_-]+$`) -> type: `playlist`
5. Channel by ID: `/channel/([A-Za-z0-9_-]+)` -> type: `channel`
6. Handle: `/@([A-Za-z0-9._-]{3,30})` or raw `@...` -> type: `channel`
7. Custom channel: `/c/([^/]+)` or `/user/([^/]+)` -> type: `channel`
8. Post: `/post/([A-Za-z0-9_-]+)` -> type: `post`
9. Timestamp in query `t=` captured to meta.timestamp
10. Video ID raw token of length 11 -> type: `video`
11. Fallback: search

## Instagram Detectors
1. Reel: `/reel/([A-Za-z0-9_-]+)` -> type: `reel`
2. Post: `/p/([A-Za-z0-9_-]+)` -> type: `post`
3. Shortcode raw (~11 chars alnum/ _ -) treat as post
4. Profile: `/([A-Za-z0-9._]+)` (when base host path single segment) or raw `@handle` -> type: `profile`
5. Story highlight (future) heuristic `stories/highlights/(\d+)` -> type: `highlight`
6. Fallback: profile search? Instagram search poor; just error -> home

## LinkedIn Detectors
1. Person profile: `/in/([A-Za-z0-9-_%]+)` -> type: `profile`
2. Company: `/company/([A-Za-z0-9-_%]+)` -> type: `company`
3. Post (feed update): `/posts/([A-Za-z0-9-_%]+)` or `/feed/update/urn:li:activity:(\d+)` -> type: `post`
4. Article: `/pulse/([^/]+)-(\d+)` -> type: `article`
5. Job: `/jobs/view/(\d+)` -> type: `job`
6. Raw `in/username` token -> profile
7. Fallback: profile search unsupported -> home

## X (Twitter) Detectors
1. Tweet: `/status/(\d{5,25})` -> type: `tweet`
2. Status URL query variant (rare) -> treat as tweet
3. Profile: `/([A-Za-z0-9_]{1,15})$` or raw `@handle` -> type: `profile`
4. List: `/i/lists/(\d+)` -> type: `list`
5. Search: `q=` param or prefix `search:` -> type: `search`
6. Fallback: search

## Facebook Detectors
1. Direct post with story_fbid: `story_fbid=(\d+)` and `id=(\d+)` -> type: `post`
2. Post path: `/(?:posts|videos|photos)/(\d+)` -> determine type by segment
3. Page ID: `/page/(\d+)` or numeric id only -> type: `page`
4. Vanity page/profile: first path segment letters -> type: `page`
5. Group: `/groups/(\d+)` -> type: `group`
6. Fallback: page

## TikTok Detectors
1. Video: `/@([A-Za-z0-9._]+)/video/(\d+)` -> type: `video` + handle
2. Video share short: `video/(\d+)` alone -> type: `video`
3. Profile: `/@([A-Za-z0-9._]+)` or raw `@handle` -> type: `profile`
4. Raw numeric ID maybe video -> treat as video
5. Search prefix `search:` -> type: `search`
6. Fallback: profile search (unsupported) -> home

## Building Canonical Web URL (Examples)
YouTube video: `https://www.youtube.com/watch?v=ID` (+ `&t=` + `&list=`) 
Instagram post: `https://www.instagram.com/p/SHORTCODE/`
X tweet: `https://x.com/HANDLE/status/ID`
Facebook post: `https://www.facebook.com/<pageOrId>/posts/ID` (heuristic) or use original path if safe
TikTok video: `https://www.tiktok.com/@HANDLE/video/ID`

## Deep Link Candidate Ordering Strategy
1. Primary custom scheme (fast open)
2. Alternate scheme (`vnd.*` if exists)
3. Intent URL (Android) e.g., `intent://...#Intent;package=com.google.android.youtube;scheme=https;end` (future optional)

## Error Collection
Push human-readable messages to `errors[]` for debug mode; not shown otherwise.

## Output Example (YouTube video)
```
{
  platform: 'youtube',
  raw: 'https://youtu.be/dQw4w9WgXcQ?t=43',
  type: 'video',
  meta: { videoId: 'dQw4w9WgXcQ', timestamp: '43' },
  canonicalWebUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43',
  appUrlCandidates: [
    'vnd.youtube://watch?v=dQw4w9WgXcQ&t=43',
    'youtube://www.youtube.com/watch?v=dQw4w9WgXcQ&t=43'
  ],
  errors: []
}
```

This spec will drive implementation in `platforms.js`.

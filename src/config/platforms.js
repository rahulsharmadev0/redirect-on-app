// Platform configuration and parsing utilities
// Each platform exports a parse(input) that returns a descriptor or null

function sanitizeRaw(input) {
  if (!input) return '';
  let v = input.trim();
  if (v.length > 512) v = v.slice(0, 512);
  return v;
}

function safeUrlParse(str) {
  try {
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(str)) {
      // add https if looks like domain
      if (/^[\w.-]+\.[a-zA-Z]{2,}/.test(str)) {
        str = 'https://' + str;
      }
    }
    return new URL(str);
  } catch (e) {
    return null;
  }
}

function encodeSeg(str) { return encodeURIComponent(str); }

// YouTube
const youtube = {
  keys: ['youtube','yt'],
  parse(raw) {
    const input = sanitizeRaw(raw);
    const errors = [];
    const descriptor = { platform: 'youtube', raw: input, type: 'unknown', meta: {}, errors, appUrlCandidates: [] };
    if (!input) { errors.push('empty'); return descriptor; }
    let url = null;
    if (/youtu(\.be|be\.com|be)/i.test(input) || /youtube\.com|youtu\.be/.test(input) || /\//.test(input)) {
      url = safeUrlParse(input);
    }

    const mVideoIdRaw = /^[a-zA-Z0-9_-]{11}$/;

    if (url) {
      const host = url.hostname;
      const path = url.pathname;
      const qs = url.searchParams;
      // shorts
      let m;
      if ((m = path.match(/\/shorts\/([a-zA-Z0-9_-]{11})/))) {
        descriptor.type = 'shorts';
        descriptor.meta.videoId = m[1];
      } else if (host.includes('youtu.be')) {
        const vid = path.slice(1);
        if (mVideoIdRaw.test(vid)) {
          descriptor.type = 'video';
          descriptor.meta.videoId = vid;
        }
      } else if (path === '/watch' && mVideoIdRaw.test(qs.get('v')||'')) {
        descriptor.type = 'video';
        descriptor.meta.videoId = qs.get('v');
      } else if (path === '/playlist' && qs.get('list')) {
        descriptor.type = 'playlist';
        descriptor.meta.playlistId = qs.get('list');
      } else if (/^\/channel\//.test(path)) {
        descriptor.type = 'channel';
        descriptor.meta.channelId = path.split('/')[2];
      } else if (/^\/@/.test(path)) {
        descriptor.type = 'channel';
        descriptor.meta.handle = path.slice(2);
      } else if (/^\/(c|user)\//.test(path)) {
        descriptor.type = 'channel';
        descriptor.meta.channelName = path.split('/')[2];
      } else if (/^\/post\//.test(path)) {
        descriptor.type = 'post';
        descriptor.meta.postId = path.split('/')[2];
      }
      if (descriptor.type === 'video' || descriptor.type === 'shorts') {
        if (qs.get('t')) descriptor.meta.timestamp = qs.get('t');
        if (qs.get('list')) descriptor.meta.playlist = qs.get('list');
      }
    }

    if (descriptor.type === 'unknown') {
      if (mVideoIdRaw.test(input)) {
        descriptor.type = 'video';
        descriptor.meta.videoId = input;
      } else if (/^@?[a-zA-Z0-9_-]+$/.test(input)) {
        descriptor.type = 'channel';
        descriptor.meta.handle = input.replace(/^@/, '');
      } else if (/shorts:([a-zA-Z0-9_-]{11})/.test(input)) {
        descriptor.type = 'shorts';
        descriptor.meta.videoId = RegExp.$1;
      } else {
        descriptor.type = 'search';
        descriptor.meta.query = input;
      }
    }

    // Build URLs
    const meta = descriptor.meta;
    const base = 'https://www.youtube.com';
    switch (descriptor.type) {
      case 'video': {
        let web = base + '/watch?v=' + encodeSeg(meta.videoId);
        if (meta.timestamp) web += '&t=' + encodeSeg(meta.timestamp);
        if (meta.playlist) web += '&list=' + encodeSeg(meta.playlist);
        descriptor.canonicalWebUrl = web;
        let app = 'vnd.youtube://watch?v=' + encodeSeg(meta.videoId);
        if (meta.timestamp) app += '&t=' + encodeSeg(meta.timestamp);
        if (meta.playlist) app += '&list=' + encodeSeg(meta.playlist);
        descriptor.appUrlCandidates.push(app, 'youtube://www.youtube.com/watch?v=' + encodeSeg(meta.videoId));
        break;
      }
      case 'shorts': {
        const web = base + '/shorts/' + encodeSeg(meta.videoId);
        descriptor.canonicalWebUrl = web;
        descriptor.appUrlCandidates.push('vnd.youtube://shorts/' + encodeSeg(meta.videoId));
        break;
      }
      case 'playlist': {
        const web = base + '/playlist?list=' + encodeSeg(meta.playlistId);
        descriptor.canonicalWebUrl = web;
        descriptor.appUrlCandidates.push('vnd.youtube://playlist?list=' + encodeSeg(meta.playlistId));
        break;
      }
      case 'channel': {
        let web;
        if (meta.channelId) web = base + '/channel/' + encodeSeg(meta.channelId);
        else if (meta.handle) web = base + '/@' + encodeSeg(meta.handle);
        else if (meta.channelName) web = base + '/c/' + encodeSeg(meta.channelName);
        else web = base;
        descriptor.canonicalWebUrl = web;
        descriptor.appUrlCandidates.push('vnd.youtube://channel/' + encodeSeg(meta.channelId || meta.handle || meta.channelName || ''));
        break;
      }
      case 'post': {
        const web = base + '/post/' + encodeSeg(meta.postId);
        descriptor.canonicalWebUrl = web;
        descriptor.appUrlCandidates.push('vnd.youtube://post/' + encodeSeg(meta.postId));
        break;
      }
      case 'search': {
        const q = encodeSeg(meta.query||'');
        descriptor.canonicalWebUrl = base + '/results?search_query=' + q;
        descriptor.appUrlCandidates.push('vnd.youtube://search?q=' + q);
        break;
      }
      default: {
        descriptor.canonicalWebUrl = base;
      }
    }
    return descriptor;
  }
};

// Instagram
const instagram = {
  keys: ['instagram','ig'],
  parse(raw) {
    const input = sanitizeRaw(raw);
    const errors = [];
    const descriptor = { platform: 'instagram', raw: input, type: 'unknown', meta: {}, errors, appUrlCandidates: [] };
    if (!input) { errors.push('empty'); return descriptor; }
    let url = null; if (/instagram\.com|\//i.test(input)) url = safeUrlParse(input);
    let path = url ? url.pathname.replace(/\/+$/,'') : '';
    const segs = path.split('/').filter(Boolean);

    let handleRegex = /^[A-Za-z0-9._]{1,30}$/;

    if (segs[0]==='reel' && segs[1]) { descriptor.type='reel'; descriptor.meta.reelId=segs[1]; }
    else if (segs[0]==='p' && segs[1]) { descriptor.type='post'; descriptor.meta.shortcode=segs[1]; }
    else if (segs[0]==='stories' && segs[1]==='highlights' && segs[2]) { descriptor.type='highlight'; descriptor.meta.highlightId=segs[2]; }
    else if (segs.length===1 && handleRegex.test(segs[0])) { descriptor.type='profile'; descriptor.meta.handle=segs[0]; }

    if (descriptor.type==='unknown') {
      if (/@/.test(input) && handleRegex.test(input.replace('@',''))) { descriptor.type='profile'; descriptor.meta.handle=input.replace('@',''); }
      else if (/^[A-Za-z0-9_-]{5,15}$/.test(input)) { descriptor.type='post'; descriptor.meta.shortcode=input; }
      else if (handleRegex.test(input)) { descriptor.type='profile'; descriptor.meta.handle=input; }
    }

    const base='https://www.instagram.com';
    switch (descriptor.type) {
      case 'profile': {
        const h=encodeSeg(descriptor.meta.handle||'');
        descriptor.canonicalWebUrl= base + '/' + h + '/';
        descriptor.appUrlCandidates.push('instagram://user?username=' + h);
        break; }
      case 'post': {
        const sc=encodeSeg(descriptor.meta.shortcode||'');
        descriptor.canonicalWebUrl= base + '/p/' + sc + '/';
        descriptor.appUrlCandidates.push('instagram://media?id=' + sc);
        break; }
      case 'reel': {
        const id=encodeSeg(descriptor.meta.reelId||'');
        descriptor.canonicalWebUrl= base + '/reel/' + id + '/';
        descriptor.appUrlCandidates.push('instagram://reel?id=' + id);
        break; }
      case 'highlight': {
        const id=encodeSeg(descriptor.meta.highlightId||'');
        descriptor.canonicalWebUrl= base + '/stories/highlights/' + id + '/';
        break; }
      default: descriptor.canonicalWebUrl=base;
    }
    return descriptor;
  }
};

// LinkedIn
const linkedin = {
  keys: ['linkedin','li'],
  parse(raw) {
    const input=sanitizeRaw(raw); const errors=[];
    const descriptor={ platform:'linkedin', raw:input, type:'unknown', meta:{}, errors, appUrlCandidates:[] };
    if (!input) { errors.push('empty'); return descriptor; }
    const url = /linkedin\.com|\//i.test(input)? safeUrlParse(input): null;
    const path = url? url.pathname: '';
    // patterns
    let m;
    if ((m=path.match(/\/in\/([A-Za-z0-9-_%]+)/))) { descriptor.type='profile'; descriptor.meta.handle=m[1]; }
    else if ((m=path.match(/\/company\/([A-Za-z0-9-_%]+)/))) { descriptor.type='company'; descriptor.meta.company=m[1]; }
    else if ((m=path.match(/\/feed\/update\/urn:li:activity:(\d+)/))) { descriptor.type='post'; descriptor.meta.activityId=m[1]; }
    else if ((m=path.match(/\/posts\/([A-Za-z0-9-_%]+)/))) { descriptor.type='post'; descriptor.meta.postId=m[1]; }
    else if ((m=path.match(/\/pulse\/([^/]+)-(\d+)/))) { descriptor.type='article'; descriptor.meta.slug=m[1]; descriptor.meta.articleId=m[2]; }
    else if ((m=path.match(/\/jobs\/view\/(\d+)/))) { descriptor.type='job'; descriptor.meta.jobId=m[1]; }

    if (descriptor.type==='unknown') {
      if (/^in\//.test(input)) { descriptor.type='profile'; descriptor.meta.handle=input.split('/')[1]; }
      else if (/^company\//.test(input)) { descriptor.type='company'; descriptor.meta.company=input.split('/')[1]; }
    }

    const base='https://www.linkedin.com';
    switch (descriptor.type) {
      case 'profile': {
        const h=encodeSeg(descriptor.meta.handle||'');
        descriptor.canonicalWebUrl= base + '/in/' + h + '/';
        descriptor.appUrlCandidates.push('linkedin://in/' + h);
        break; }
      case 'company': {
        const c=encodeSeg(descriptor.meta.company||'');
        descriptor.canonicalWebUrl= base + '/company/' + c + '/';
        descriptor.appUrlCandidates.push('linkedin://company/' + c);
        break; }
      case 'post': {
        const id=encodeSeg(descriptor.meta.activityId || descriptor.meta.postId || '');
        descriptor.canonicalWebUrl= id? base + '/feed/update/urn:li:activity:' + id : base;
        break; }
      case 'article': {
        const slug=encodeSeg(descriptor.meta.slug||''); const id=encodeSeg(descriptor.meta.articleId||'');
        descriptor.canonicalWebUrl= base + '/pulse/' + slug + '-' + id;
        break; }
      case 'job': {
        const id=encodeSeg(descriptor.meta.jobId||'');
        descriptor.canonicalWebUrl= base + '/jobs/view/' + id;
        break; }
      default: descriptor.canonicalWebUrl=base;
    }
    return descriptor;
  }
};

// X (Twitter)
const x = {
  keys: ['x','twitter','tw'],
  parse(raw) {
    const input=sanitizeRaw(raw); const errors=[];
    const descriptor={ platform:'x', raw:input, type:'unknown', meta:{}, errors, appUrlCandidates:[] };
    if (!input) { errors.push('empty'); return descriptor; }
    const url = /(twitter|x)\.com|\//i.test(input)? safeUrlParse(input): null;
    const path = url? url.pathname.replace(/\/+$/,''):'';
    let m;
    if ((m=path.match(/\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})/))) { descriptor.type='tweet'; descriptor.meta.handle=m[1]; descriptor.meta.tweetId=m[2]; }
    else if ((m=path.match(/\/i\/lists\/(\d+)/))) { descriptor.type='list'; descriptor.meta.listId=m[1]; }
    else if ((m=path.match(/^\/([A-Za-z0-9_]{1,15})$/))) { descriptor.type='profile'; descriptor.meta.handle=m[1]; }

    if (descriptor.type==='unknown') {
      if (/^@([A-Za-z0-9_]{1,15})$/.test(input)) { descriptor.type='profile'; descriptor.meta.handle=input.slice(1); }
      else if (/^search:/.test(input)) { descriptor.type='search'; descriptor.meta.query=input.slice(7); }
      else if (/^[0-9]{5,25}$/.test(input)) { descriptor.type='tweet'; descriptor.meta.tweetId=input; }
      else if (/^[A-Za-z0-9_]{1,15}$/.test(input)) { descriptor.type='profile'; descriptor.meta.handle=input; }
      else { descriptor.type='search'; descriptor.meta.query=input; }
    }

    const base='https://x.com';
    switch (descriptor.type) {
      case 'profile': {
        const h=encodeSeg(descriptor.meta.handle||'');
        descriptor.canonicalWebUrl= base + '/' + h;
        descriptor.appUrlCandidates.push('twitter://user?screen_name=' + h);
        break; }
      case 'tweet': {
        const id=encodeSeg(descriptor.meta.tweetId||'');
        const h=encodeSeg(descriptor.meta.handle||'');
        descriptor.canonicalWebUrl= h? base + '/' + h + '/status/' + id : base + '/i/status/' + id;
        descriptor.appUrlCandidates.push('twitter://status?id=' + id);
        break; }
      case 'list': {
        const id=encodeSeg(descriptor.meta.listId||'');
        descriptor.canonicalWebUrl= base + '/i/lists/' + id;
        break; }
      case 'search': {
        const q=encodeSeg(descriptor.meta.query||'');
        descriptor.canonicalWebUrl= base + '/search?q=' + q;
        descriptor.appUrlCandidates.push('twitter://search?query=' + q);
        break; }
      default: descriptor.canonicalWebUrl=base;
    }
    return descriptor;
  }
};

// Facebook
const facebook = {
  keys: ['facebook','fb'],
  parse(raw) {
    const input=sanitizeRaw(raw); const errors=[];
    const descriptor={ platform:'facebook', raw:input, type:'unknown', meta:{}, errors, appUrlCandidates:[] };
    if (!input) { errors.push('empty'); return descriptor; }
    const url = /facebook\.com|\//i.test(input)? safeUrlParse(input): null;
    const path = url? url.pathname: '';
    const qs = url? url.searchParams: null;
    let m;
    if (qs && qs.get('story_fbid') && qs.get('id')) { descriptor.type='post'; descriptor.meta.storyId=qs.get('story_fbid'); descriptor.meta.ownerId=qs.get('id'); }
    else if ((m=path.match(/\/(posts|videos|photos)\/(\d+)/))) { descriptor.type=m[1]==='videos'?'video':(m[1]==='photos'?'photo':'post'); descriptor.meta.contentId=m[2]; }
    else if ((m=path.match(/\/groups\/(\d+)/))) { descriptor.type='group'; descriptor.meta.groupId=m[1]; }
    else if ((m=path.match(/\/page\/(\d+)/))) { descriptor.type='page'; descriptor.meta.pageId=m[1]; }
    else if ((m=path.match(/^\/([A-Za-z0-9_.-]{3,})$/))) { descriptor.type='page'; descriptor.meta.vanity=m[1]; }

    if (descriptor.type==='unknown') {
      if (/^\d+$/.test(input)) { descriptor.type='page'; descriptor.meta.pageId=input; }
      else if (/^[A-Za-z0-9_.-]{3,}$/.test(input)) { descriptor.type='page'; descriptor.meta.vanity=input; }
    }

    const base='https://www.facebook.com';
    switch (descriptor.type) {
      case 'post': {
        const owner=encodeSeg(descriptor.meta.ownerId||descriptor.meta.vanity||'');
        const story=encodeSeg(descriptor.meta.storyId||descriptor.meta.contentId||'');
        descriptor.canonicalWebUrl= owner && story ? `${base}/${owner}/posts/${story}` : base;
        descriptor.appUrlCandidates.push('fb://post/' + story);
        break; }
      case 'video': {
        const id=encodeSeg(descriptor.meta.contentId||'');
        descriptor.canonicalWebUrl= base + '/video.php?v=' + id;
        descriptor.appUrlCandidates.push('fb://video/' + id);
        break; }
      case 'photo': {
        const id=encodeSeg(descriptor.meta.contentId||'');
        descriptor.canonicalWebUrl= base + '/photo?fbid=' + id;
        descriptor.appUrlCandidates.push('fb://photo/' + id);
        break; }
      case 'group': {
        const id=encodeSeg(descriptor.meta.groupId||'');
        descriptor.canonicalWebUrl= base + '/groups/' + id;
        descriptor.appUrlCandidates.push('fb://group/' + id);
        break; }
      case 'page': {
        const id = descriptor.meta.pageId ? encodeSeg(descriptor.meta.pageId) : encodeSeg(descriptor.meta.vanity||'');
        descriptor.canonicalWebUrl= base + '/' + id;
        descriptor.appUrlCandidates.push('fb://page/' + id);
        break; }
      default: descriptor.canonicalWebUrl=base;
    }
    return descriptor;
  }
};

// TikTok
const tiktok = {
  keys: ['tiktok','tt'],
  parse(raw) {
    const input=sanitizeRaw(raw); const errors=[];
    const descriptor={ platform:'tiktok', raw:input, type:'unknown', meta:{}, errors, appUrlCandidates:[] };
    if (!input) { errors.push('empty'); return descriptor; }
    const url = /tiktok\.com|\//i.test(input)? safeUrlParse(input): null;
    const path = url? url.pathname: '';
    let m;
    if ((m=path.match(/\/@([A-Za-z0-9._]+)\/video\/(\d+)/))) { descriptor.type='video'; descriptor.meta.handle=m[1]; descriptor.meta.videoId=m[2]; }
    else if ((m=path.match(/\/video\/(\d+)/))) { descriptor.type='video'; descriptor.meta.videoId=m[1]; }
    else if ((m=path.match(/\/@([A-Za-z0-9._]+)/))) { descriptor.type='profile'; descriptor.meta.handle=m[1]; }

    if (descriptor.type==='unknown') {
      if (/^@([A-Za-z0-9._]+)$/.test(input)) { descriptor.type='profile'; descriptor.meta.handle=input.slice(1); }
      else if (/^search:/.test(input)) { descriptor.type='search'; descriptor.meta.query=input.slice(7); }
      else if (/^\d{5,}$/.test(input)) { descriptor.type='video'; descriptor.meta.videoId=input; }
      else if (/^[A-Za-z0-9._]{2,}$/ .test(input)) { descriptor.type='profile'; descriptor.meta.handle=input; }
    }

    const base='https://www.tiktok.com';
    switch (descriptor.type) {
      case 'video': {
        const id=encodeSeg(descriptor.meta.videoId||'');
        const h=descriptor.meta.handle? encodeSeg(descriptor.meta.handle):'';
        descriptor.canonicalWebUrl= h? `${base}/@${h}/video/${id}` : base + '/video/' + id;
        if (h) descriptor.appUrlCandidates.push(`snssdk1128://aweme/detail/${id}`);
        else descriptor.appUrlCandidates.push(`snssdk1128://aweme/detail/${id}`);
        break; }
      case 'profile': {
        const h=encodeSeg(descriptor.meta.handle||'');
        descriptor.canonicalWebUrl= base + '/@' + h;
        descriptor.appUrlCandidates.push('snssdk1128://user/profile/@' + h);
        break; }
      case 'search': {
        const q=encodeSeg(descriptor.meta.query||'');
        descriptor.canonicalWebUrl= base + '/search?q=' + q;
        break; }
      default: descriptor.canonicalWebUrl=base;
    }
    return descriptor;
  }
};

export const platforms = [youtube, instagram, linkedin, x, facebook, tiktok];

export function detectPlatformParam(params) {
  const order = ['youtube','instagram','linkedin','x','facebook','tiktok'];
  for (const name of order) {
    const plat = platforms.find(p=>p.platform===name || p.keys.includes(name));
    if (!plat) continue;
    for (const key of plat.keys) {
      if (params.has(key)) return { platform: plat, value: params.get(key) };
    }
  }
  // generic q as search (default youtube search?) choose youtube
  if (params.get('q')) {
    return { platform: youtube, value: params.get('q') };
  }
  return null;
}

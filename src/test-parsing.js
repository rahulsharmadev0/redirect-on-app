// Simple manual test harness: open in module-supporting browser console
import { platforms } from './config/platforms.js';

const samples = {
  youtube: [
    'dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?t=42',
    '@SomeChannel',
    'shorts:dQw4w9WgXcQ',
    'https://www.youtube.com/playlist?list=PL12345'
  ],
  instagram: [ '@natgeo', 'https://www.instagram.com/p/ABC123xyz_/', 'reel/ABC123xyz_', 'stories/highlights/1234567890' ],
  linkedin: [ 'in/some-user', 'https://www.linkedin.com/in/some-user/', 'https://www.linkedin.com/feed/update/urn:li:activity:1234567890' ],
  x: [ '@jack', 'twitter.com/jack/status/20', 'search:openai', '123456789012345' ],
  facebook: [ 'zuck', 'facebook.com/zuck/posts/10102577175875681', '1234567890', 'groups/1234567' ],
  tiktok: [ '@scout2015', 'https://www.tiktok.com/@scout2015/video/1234567890123456789', '1234567890123456789' ]
};

function findPlatform(name) {
  return platforms.find(p=>p.platform===name || p.keys.includes(name));
}

for (const [plat, list] of Object.entries(samples)) {
  const p = findPlatform(plat);
  console.group('Platform: ' + plat);
  list.forEach(sample => {
    const d = p.parse(sample);
    console.log(sample, '=>', { type: d.type, canonical: d.canonicalWebUrl, apps: d.appUrlCandidates });
  });
  console.groupEnd();
}

console.log('Done.');

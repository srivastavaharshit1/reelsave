const { execSync } = require('child_process');
const output = execSync('gh issue list --repo yt-dlp/yt-dlp --search "instagram" --limit 50 --json body', { maxBuffer: 10 * 1024 * 1024 }).toString();
const matches = [...output.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels)\/([A-Za-z0-9_-]{8,30})/g)].map(m => 'https://www.instagram.com/reel/' + m[1] + '/');
console.log('Unique reel URLs:', [...new Set(matches)]);

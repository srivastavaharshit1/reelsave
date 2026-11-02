// Script to verify frontend pages and UI functionality
const https = require('https');

const pages = [
  '/',
  '/privacy',
  '/terms',
  '/copyright',
  '/contact'
];

const BASE_URL = 'https://reelsave-five.vercel.app';

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    https.get(BASE_URL + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          contentLength: data.length,
          containsRoot: data.includes('id="root"'),
          title: data.match(/<title>(.*?)<\/title>/)?.[1] || 'No title'
        });
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Testing frontend static routes on ' + BASE_URL);
  for (const page of pages) {
    const res = await fetchPage(page);
    console.log(`Route [${page}]: Status=${res.statusCode}, Title="${res.title}", HTML Size=${res.contentLength} bytes, hasRoot=${res.containsRoot}`);
  }
}

run().catch(console.error);


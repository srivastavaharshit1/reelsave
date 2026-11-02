const https = require('https');

const candidateReels = [
  { id: 'Reel 1 (Dey-qwUojgL)', url: 'https://www.instagram.com/reel/Dey-qwUojgL/' },
  { id: 'Reel 2 (CDUMkliABpa)', url: 'https://www.instagram.com/reel/CDUMkliABpa/' },
  { id: 'Reel 3 (CmOhE_YtI-I)', url: 'https://www.instagram.com/reel/CmOhE_YtI-I/' },
  { id: 'Reel 4 (DVn-vNTCIfX)', url: 'https://www.instagram.com/reel/DVn-vNTCIfX/' },
  { id: 'Reel 5 (DW1_S6Agq1E)', url: 'https://www.instagram.com/reel/DW1_S6Agq1E/' }
];

const BASE_URL = 'https://reelsave-backend-5zko.onrender.com';

function postJson(endpoint, data) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(data);
    const start = Date.now();
    const req = https.request(BASE_URL + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'X-Correlation-ID': 'bench-' + Date.now().toString(36)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(body); } catch {}
        resolve({
          statusCode: res.statusCode,
          elapsed,
          headers: res.headers,
          body: parsed
        });
      });
    });
    req.on('error', err => resolve({ statusCode: 0, elapsed: Date.now() - start, headers: {}, error: err.message }));
    req.write(postData);
    req.end();
  });
}

async function runBenchmark() {
  console.log('========================================================================');
  console.log('POST-OPTIMIZATION PRODUCTION BENCHMARK');
  console.log('========================================================================\n');

  const results = [];

  for (const item of candidateReels) {
    console.log(`Testing ${item.id}: ${item.url}`);
    
    // 1. Separate validate call
    const valRes = await postJson('/api/v1/reels/validate', { url: item.url });
    
    // 2. Initial Resolve (Cache MISS or Cold)
    const resRes1 = await postJson('/api/v1/reels/resolve', { url: item.url });
    
    // 3. Cached / Warm Resolve for the exact same Reel (Cache HIT expected)
    const resRes2 = await postJson('/api/v1/reels/resolve', { url: item.url });

    const row = {
      id: item.id,
      url: item.url,
      validateMs: valRes.elapsed,
      initialResolveMs: resRes1.elapsed,
      initialCacheHeader: resRes1.headers['x-cache'] || 'NONE',
      initialColdStart: resRes1.headers['x-cold-start'] || 'NONE',
      cachedResolveMs: resRes2.elapsed,
      cachedCacheHeader: resRes2.headers['x-cache'] || 'NONE',
      status: resRes1.body?.status || 'ERROR',
      validFormat: resRes1.body?.contentType === 'video/mp4' && !!resRes1.body?.mediaUrl,
      mediaUrl: resRes1.body?.mediaUrl ? resRes1.body.mediaUrl.substring(0, 60) + '...' : null
    };

    console.log(`  -> Validate HTTP: ${row.validateMs} ms`);
    console.log(`  -> Initial Resolve: ${row.initialResolveMs} ms (X-Cache: ${row.initialCacheHeader}, X-Cold-Start: ${row.initialColdStart})`);
    console.log(`  -> Cached Resolve: ${row.cachedResolveMs} ms (X-Cache: ${row.cachedCacheHeader})`);
    console.log(`  -> Status: ${row.status}, Valid MP4: ${row.validFormat}\n`);

    results.push(row);
  }

  console.log('\nSUMMARY TABLE (POST-OPTIMIZATION):');
  console.table(results.map(r => ({
    Reel: r.id,
    'Validate (ms)': r.validateMs,
    'Initial Resolve (ms)': r.initialResolveMs,
    'Initial Cache': r.initialCacheHeader,
    'Cached Resolve (ms)': r.cachedResolveMs,
    'Cached Cache': r.cachedCacheHeader,
    Status: r.status,
    'Valid MP4': r.validFormat
  })));
}

runBenchmark().catch(console.error);

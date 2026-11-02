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
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const elapsed = Date.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ statusCode: res.statusCode, elapsed, body: parsed });
      });
    });
    req.on('error', err => resolve({ statusCode: 0, elapsed: Date.now() - start, error: err.message }));
    req.write(postData);
    req.end();
  });
}

async function runBenchmark() {
  console.log('========================================================================');
  console.log('BASELINE PRODUCTION BENCHMARK (BEFORE SPEED OPTIMIZATION)');
  console.log('========================================================================\n');

  const results = [];

  for (const item of candidateReels) {
    console.log(`Testing ${item.id}: ${item.url}`);
    
    // 1. Separate validate call (current frontend behavior)
    const valRes = await postJson('/api/v1/reels/validate', { url: item.url });
    
    // 2. Cold / Initial Resolve
    const resRes1 = await postJson('/api/v1/reels/resolve', { url: item.url });
    
    // 3. Warm / Second Resolve for same Reel (without cache)
    const resRes2 = await postJson('/api/v1/reels/resolve', { url: item.url });

    const totalWorkflow1 = valRes.elapsed + resRes1.elapsed;

    const row = {
      id: item.id,
      url: item.url,
      validateMs: valRes.elapsed,
      resolveInitialMs: resRes1.elapsed,
      totalInitialWorkflowMs: totalWorkflow1,
      resolveWarmMs: resRes2.elapsed,
      status: resRes1.body?.status || 'ERROR',
      validFormat: resRes1.body?.contentType === 'video/mp4' && !!resRes1.body?.mediaUrl
    };

    console.log(`  -> Validate HTTP: ${row.validateMs} ms`);
    console.log(`  -> Initial Resolve HTTP: ${row.resolveInitialMs} ms`);
    console.log(`  -> Total Current Frontend Workflow: ${row.totalInitialWorkflowMs} ms`);
    console.log(`  -> Warm (Uncached) Resolve HTTP: ${row.resolveWarmMs} ms`);
    console.log(`  -> Status: ${row.status}, Valid MP4: ${row.validFormat}\n`);

    results.push(row);
  }

  console.log('\nSUMMARY TABLE (BASELINE):');
  console.table(results.map(r => ({
    Reel: r.id,
    'Validate (ms)': r.validateMs,
    'Resolve Initial (ms)': r.resolveInitialMs,
    'Total Workflow (ms)': r.totalInitialWorkflowMs,
    'Warm Resolve (ms)': r.resolveWarmMs,
    Status: r.status,
    'Valid MP4': r.validFormat
  })));
}

runBenchmark().catch(console.error);


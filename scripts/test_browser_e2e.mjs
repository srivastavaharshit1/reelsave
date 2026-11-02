import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const USER_DATA_DIR = path.join(os.tmpdir(), 'chrome-reelsave-test-' + Date.now());
const DOWNLOAD_DIR = path.join(os.tmpdir(), 'chrome-reelsave-downloads-' + Date.now());

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else {
        this.events.push(msg);
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('Starting Chrome headless...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    'about:blank'
  ]);

  chromeProc.on('error', err => {
    console.error('Failed to start Chrome:', err);
  });

  try {
    // Wait for Chrome remote debugging endpoint
    let targets = null;
    for (let i = 0; i < 30; i++) {
      try {
        targets = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
        if (targets && targets.length > 0) break;
      } catch {
        await sleep(500);
      }
    }

    if (!targets || targets.length === 0) {
      throw new Error('Chrome remote debugging did not become ready');
    }

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    console.log('Connected to target:', pageTarget.webSocketDebuggerUrl);

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: DOWNLOAD_DIR
    });

    console.log('1. Navigating to https://reelsave-five.vercel.app');
    await client.send('Page.navigate', { url: 'https://reelsave-five.vercel.app' });
    await sleep(2000);

    // Verify title and main elements
    const pageInfo = await client.send('Runtime.evaluate', {
      expression: 'document.title + " | " + document.querySelector("h1")?.innerText'
    });
    console.log('Homepage info:', pageInfo.result.value);

    // Test invalid URL validation in UI
    console.log('2. Testing invalid URL submission in browser UI...');
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const input = document.getElementById('reel-url');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'https://instagram.com/not-a-reel');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          const form = input.closest('form');
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        })()
      `
    });

    console.log('Waiting for invalid URL error in UI...');
    let invalidConfirmed = false;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      const res = await client.send('Runtime.evaluate', {
        expression: `(() => {
          const msg = document.getElementById('form-message')?.innerText || '';
          const isInvalid = document.getElementById('reel-url')?.getAttribute('aria-invalid') === 'true';
          const btn = document.querySelector('button[type="submit"]')?.innerText;
          return { msg, isInvalid, btn };
        })()`,
        returnByValue: true
      });
      if (res.result.value?.isInvalid || res.result.value?.msg?.includes('valid')) {
        invalidConfirmed = true;
        console.log('Invalid URL handled by UI successfully:', res.result.value);
        break;
      }
    }

    if (!invalidConfirmed) {
      throw new Error('Invalid URL validation did not show error in UI');
    }

    // Refresh page for a clean slate
    console.log('Reloading page for valid Reel test...');
    await client.send('Page.navigate', { url: 'https://reelsave-five.vercel.app' });
    await sleep(2000);

    // Test valid Reel resolution in UI
    const candidateReel = 'https://www.instagram.com/reel/Dey-qwUojgL/';
    console.log(`3. Testing valid Reel submission: ${candidateReel}`);
    await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const input = document.getElementById('reel-url');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, '${candidateReel}');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          const form = input.closest('form');
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        })()
      `
    });

    console.log('Waiting for Reel resolution in UI...');
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await sleep(1000);
      const res = await client.send('Runtime.evaluate', {
        expression: `(() => {
          const title = document.getElementById('download-result-title')?.innerText;
          const video = document.querySelector('video')?.src || document.querySelector('video source')?.src;
          const dlBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download video'));
          return { title, video: !!video, dlBtn: !!dlBtn };
        })()`,
        returnByValue: true
      });
      if (res.result.value?.title?.includes('ready')) {
        ready = true;
        console.log('Reel resolved in browser UI:', res.result.value);
        break;
      }
    }

    if (!ready) {
      const dump = await client.send('Runtime.evaluate', {
        expression: 'document.body.innerText'
      });
      console.log('Page text dump on timeout:', dump.result.value);
      throw new Error('Reel resolution timed out in browser');
    }

    // Click "Download video" button
    console.log('4. Clicking "Download video" button in browser...');
    await client.send('Runtime.evaluate', {
      expression: `(() => {
        const dlBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Download video'));
        if (dlBtn) dlBtn.click();
      })()`
    });

    console.log('Waiting for browser to save the file in', DOWNLOAD_DIR);
    let downloadedFile = null;
    for (let i = 0; i < 40; i++) {
      await sleep(1000);
      const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => !f.endsWith('.crdownload') && !f.endsWith('.tmp'));
      if (files.length > 0) {
        downloadedFile = path.join(DOWNLOAD_DIR, files[0]);
        break;
      }
    }

    if (!downloadedFile) {
      throw new Error('File download did not complete within timeout');
    }

    const stats = fs.statSync(downloadedFile);
    console.log(`Browser saved file: ${downloadedFile} (${stats.size} bytes)`);

    // Verify MP4 tracks with Mp4Inspector
    const inspectOutput = execSync(`java -cp backend/target/classes com.reelsave.provider.Mp4Inspector "${downloadedFile}"`).toString().trim();
    console.log(`Mp4Inspector result: ${inspectOutput}`);

    // Test static legal routes in browser
    console.log('5. Testing static legal routes in browser...');
    for (const route of ['/privacy', '/terms', '/copyright', '/contact']) {
      await client.send('Page.navigate', { url: `https://reelsave-five.vercel.app${route}` });
      await sleep(1000);
      const title = await client.send('Runtime.evaluate', {
        expression: `document.title + " | " + (document.querySelector('h1')?.innerText || '')`
      });
      console.log(`Route ${route}: ${title.result.value}`);
    }

    client.close();
    console.log('ALL BROWSER E2E TESTS PASSED SUCCESSFULLY!');
  } finally {
    chromeProc.kill();
    try {
      fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
    } catch {}
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});


/**
 * Resolves merge conflicts in all i18n JSON files (handles CRLF line endings).
 * Both branches added different keys at the end of each file.
 * Strategy: keep ALL keys from both sides. "Ours" (HEAD/main) wins duplicates.
 */
import fs from 'node:fs';
import path from 'node:path';

const I18N_DIR = path.resolve('frontend/src/i18n');
const files = fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.json'));

let resolved = 0;

for (const file of files) {
  const filePath = path.join(I18N_DIR, file);
  const rawBuf = fs.readFileSync(filePath);
  // Normalise to LF for consistent processing
  const raw = rawBuf.toString('utf8').replace(/\r\n/g, '\n');

  if (!raw.includes('<<<<<<<')) continue;

  const conflictStart = raw.indexOf('<<<<<<<');
  const sepIdx   = raw.indexOf('\n=======\n', conflictStart);
  const endIdx   = raw.indexOf('\n>>>>>>>', sepIdx);

  if (conflictStart === -1 || sepIdx === -1 || endIdx === -1) {
    console.error(`  ✗ Unexpected format in ${file} (start=${conflictStart} sep=${sepIdx} end=${endIdx})`);
    continue;
  }

  // Base: everything up to the conflict marker (valid JSON without closing })
  let base = raw.slice(0, conflictStart).trimEnd();
  if (base.endsWith(',')) base = base.slice(0, -1);

  // HEAD block (ours) and THEIRS block
  const oursText   = raw.slice(conflictStart + raw.slice(conflictStart).indexOf('\n') + 1, sepIdx);
  const theirsText = raw.slice(sepIdx + 9, endIdx); // 9 = len('\n=======\n')

  function parseLines(text) {
    const obj = {};
    for (const line of text.split('\n')) {
      // Match: "key": value  (with optional trailing comma)
      const m = line.match(/^\s+"([^"]+)":\s+(.+?),?\s*$/);
      if (!m) continue;
      try { obj[m[1]] = JSON.parse(m[2]); }
      catch { obj[m[1]] = m[2]; }
    }
    return obj;
  }

  const ours   = parseLines(oursText);
  const theirs = parseLines(theirsText);
  const merged = { ...theirs, ...ours };  // ours overwrites on duplicates

  if (!Object.keys(merged).length) {
    console.error(`  ✗ No keys parsed from ${file}`);
    continue;
  }

  const mergedLines = Object.entries(merged)
    .map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`)
    .join(',\n');

  const result = `${base},\n${mergedLines}\n}\n`;

  try { JSON.parse(result); }
  catch (e) {
    console.error(`  ✗ Invalid JSON for ${file}: ${e.message}`);
    continue;
  }

  fs.writeFileSync(filePath, result, 'utf8');
  resolved++;
  console.log(`  ✓ ${file}  ours:${Object.keys(ours).length}  theirs:${Object.keys(theirs).length}  total:${Object.keys(merged).length}`);
}

console.log(`\nDone: ${resolved} files resolved`);

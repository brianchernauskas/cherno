#!/usr/bin/env node
/* ==========================================================================
   Tests a passphrase against vault.js and reports what the shell actually
   handed over. Run it locally; it prints nothing that identifies you.

     node tools/check.js "your passphrase here"

   Nothing is sent anywhere. This is the same key derivation the page uses.
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { subtle } = webcrypto;

const b64 = (s) => Buffer.from(s, 'base64');

async function main() {
  const pass = process.argv[2];
  const extra = process.argv.slice(3);

  if (pass === undefined) {
    console.error('\n  Usage: node tools/check.js "your passphrase"\n');
    process.exit(1);
  }

  console.log('\n  What the shell delivered');
  console.log('  ------------------------');
  console.log(`  characters      : ${pass.length}`);
  console.log(`  bytes (UTF-8)   : ${Buffer.byteLength(pass, 'utf8')}`);
  console.log(`  spaces inside   : ${(pass.match(/ /g) || []).length}`);
  console.log(`  word count      : ${pass.trim().split(/\s+/).filter(Boolean).length}`);
  console.log(`  masked shape    : ${pass.replace(/\S/g, '*')}`);

  const warn = [];
  if (extra.length) {
    warn.push(`the shell split your input into ${extra.length + 1} arguments — only the FIRST was used`);
    warn.push('  this happens without quotes. Re-run with the whole phrase in "double quotes"');
  }
  if (pass !== pass.trim()) warn.push('there is leading or trailing whitespace');
  if (/[‘’“”]/.test(pass)) warn.push('contains a curly quote — a straight one was probably intended');
  if (/[ ]/.test(pass)) warn.push('contains a non-breaking space');
  if (!/^[\x20-\x7E]*$/.test(pass)) warn.push('contains non-ASCII characters');
  if (/\$|`/.test(pass)) {
    warn.push('contains $ or a backtick');
    warn.push('  PowerShell EXPANDS these inside "double quotes". Use \'single quotes\' there,');
    warn.push('  and check whether the passphrase you encrypted with was silently altered.');
  }

  if (warn.length) {
    console.log('\n  Warnings');
    console.log('  --------');
    warn.forEach((w) => console.log(`  ${w.startsWith('  ') ? '' : '! '}${w}`));
  }

  const vaultSrc = fs.readFileSync(path.join(__dirname, '..', 'vault.js'), 'utf8');
  const VAULT = JSON.parse(vaultSrc.slice(vaultSrc.indexOf('{'), vaultSrc.lastIndexOf('}') + 1));

  const baseKey = await subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt: b64(VAULT.salt), iterations: VAULT.kdf.iterations, hash: VAULT.kdf.hash },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  );

  console.log('\n  Result');
  console.log('  ------');
  try {
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: b64(VAULT.iv) }, key, b64(VAULT.ct));
    const data = JSON.parse(new TextDecoder().decode(plain));
    console.log(`  UNLOCKS. ${Object.keys(data.items).length} records inside.`);
    console.log('  Type exactly this into the page, spaces and all.\n');
  } catch {
    console.log('  Does not unlock this vault.');
    console.log('  Either the phrase differs, or vault.js was rebuilt with a different one.');
    console.log('  If you cannot recall it: edit secrets.json if needed, then re-run');
    console.log('  tools/encrypt.js with a phrase you will remember, and push vault.js.\n');
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

const luaparse = require('luaparse');
const {Compiler} = require('./vm-engine/compiler');
const {generate} = require('./vm-engine/generator');

const code = `local x = "hello world"\nprint(x)\nfor i=1,3 do print(i) end`;
const ast = luaparse.parse(code);
const compiled = new Compiler().compile(ast);

let allPassed = true;
for (const strength of ['Light', 'Medium', 'Heavy']) {
  const out = generate(compiled, strength);
  const checks = {
    'LCG constant embedded':        /1664525/.test(out),
    'PlaceId referenced':            /PlaceId/.test(out),
    'No kfrag (old fragments)':     !/kfrag/.test(out),
    'No reassemble (old LFSR)':     !/reassemble/.test(out),
    'No LFSR state':                !/lfsrState/.test(out),
    'No plaintext "hello world"':   !out.includes('hello world'),
    'Offset array present':         /31337/.test(out),
    'deriveKey wipes itself':        /=nil/.test(out),
    'Anti-tamper present':           /integrityCheck|integrity/.test(out) || /math\.floor\(3\.7\)/.test(out),
  };
  console.log(`\n=== ${strength.toUpperCase()} (output: ${out.length} chars) ===`);
  for (const [name, result] of Object.entries(checks)) {
    const mark = result ? '✓' : '✗';
    if (!result) allPassed = false;
    console.log(`  ${mark} ${name}`);
  }
}

// Verify the math: LCG(seed=0) XOR offset == pad, and that
// LCG(PlaceId=0 => seed=0) XOR offset == pad (self-consistency check in JS)
const { lcgStream, computeOffset } = (() => {
  try { return require('./vm-engine/generator'); } catch(e) { return {}; }
})();

if (lcgStream && computeOffset) {
  const pad = [42, 171, 7, 200];
  const off = computeOffset(pad);
  const base = lcgStream(0, 4);
  const recovered = base.map((b, i) => b ^ off[i]);
  const match = recovered.every((b, i) => b === pad[i]);
  console.log('\n=== MATH SELF-CHECK ===');
  console.log('  ' + (match ? '✓' : '✗') + ' Offset XOR LCG(0) == pad');
  if (!match) allPassed = false;
} else {
  console.log('\n(Skipping math self-check: helpers not exported)');
}

console.log('\n' + (allPassed ? '=== ALL CHECKS PASSED ===' : '=== SOME CHECKS FAILED ==='));
process.exit(allPassed ? 0 : 1);

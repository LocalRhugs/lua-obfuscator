// Astra VM Engine — Generator (LuaJIT Bytecode Version)
// Takes raw LuaJIT bytecode -> XOR encrypted Lua wrapper

function randName(len = 8) {
  const c = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = c + '0123456789';
  let n = c[Math.floor(Math.random() * c.length)];
  for (let i = 1; i < len; i++) n += a[Math.floor(Math.random() * a.length)];
  return n;
}

function generateXorKey(len) {
  const key = [];
  for (let i = 0; i < len; i++) key.push(Math.floor(Math.random() * 256));
  return key;
}

function xorEncrypt(data, key) {
  const encrypted = [];
  for (let i = 0; i < data.length; i++) {
    encrypted.push(data[i] ^ key[i % key.length]);
  }
  return encrypted;
}

/**
 * Generates the obfuscated Lua script.
 * @param {Buffer} bytecode - The raw LuaJIT bytecode.
 * @param {string} strength - Obfuscation strength (Light, Medium, Heavy).
 * @returns {string} - The obfuscated Lua code.
 */
function generate(bytecode, strength = 'Medium') {
  const keyLen = strength === 'Light' ? 16 : strength === 'Medium' ? 32 : 64;
  const key = generateXorKey(keyLen);
  const encrypted = xorEncrypt(bytecode, key);

  // Randomized variable names
  const V = {
    bc: randName(10),
    key: randName(10),
    dec: randName(10),
    idx: randName(10),
    val: randName(10),
    load: randName(10),
    bit: randName(10),
    bxor: randName(10),
    str: randName(10),
    concat: randName(10),
    char: randName(10),
    res: randName(10)
  };

  // Build the Lua script
  const lines = [];
  lines.push(`-- Astra VM | Protected with LuaJIT Bytecode Encryption`);
  lines.push(`-- Strength: ${strength} | Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Encrypted bytecode as a table of numbers (more stealthy than a long string)
  lines.push(`local ${V.bc} = {${encrypted.join(',')}}`);
  lines.push(`local ${V.key} = {${key.join(',')}}`);
  lines.push('');

  // Decryption and execution logic
  // We use a local reference to bit.bxor if available, otherwise a fallback math XOR
  lines.push(`local ${V.bxor} = (bit and bit.bxor) or (function(a, b)`);
  lines.push(`  local r, p = 0, 1`);
  lines.push(`  for i = 0, 31 do`);
  lines.push(`    if math.floor(a/p)%2 ~= math.floor(b/p)%2 then r = r + p end`);
  lines.push(`    p = p * 2`);
  lines.push(`  end`);
  lines.push(`  return r`);
  lines.push(`end)`);
  lines.push('');

  lines.push(`local ${V.dec} = {}`);
  lines.push(`local ${V.char} = string.char`);
  lines.push(`for ${V.idx} = 1, #${V.bc} do`);
  lines.push(`  ${V.dec}[${V.idx}] = ${V.char}(${V.bxor}(${V.bc}[${V.idx}], ${V.key}[(${V.idx}-1) % #${V.key} + 1]))`);
  lines.push(`end`);
  lines.push('');

  lines.push(`local ${V.load} = loadstring or load`);
  lines.push(`local ${V.res}, ${V.str} = pcall(${V.load}(table.concat(${V.dec})))`);
  lines.push(`if not ${V.res} then error(${V.str}) end`);

  return lines.join('\n');
}

module.exports = { generate };

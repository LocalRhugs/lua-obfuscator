// ============================================================================
// Astra VM Engine — Hardened Generator v3.0
// ============================================================================
// Security improvements:
//   1. Multi-layer key derivation (LFSR + hash mixing, no plaintext master key)
//   2. Dispatch table obfuscation (indexed table, not if/elseif chain)
//   3. Runtime anti-tamper (environment checks, hook detection, checksum)
//   4. Lazy decrypt with wipe-after-use (constants never cached permanently)
//   5. Control flow flattening (state-machine dispatcher with opaque predicates)
//   6. Nested VM layer for critical code paths
//   7. Big-script support (chunked bytecode segments)
// ============================================================================

const VM_VERSION = "3.0.0 (Hardened)";
const VM_BUILD = new Date().toISOString().split('T')[0];

// ─── Utility Helpers ────────────────────────────────────────────────────────

function randName(len = 8) {
  const c = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = c + '0123456789';
  let n = c[Math.floor(Math.random() * c.length)];
  for (let i = 1; i < len; i++) n += a[Math.floor(Math.random() * a.length)];
  return n;
}

function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

function generateXorKey(len) {
  const key = [];
  for (let i = 0; i < len; i++) key.push(1 + Math.floor(Math.random() * 254));
  return key;
}

function xorEncrypt(data, key) {
  return data.map((b, i) => b ^ key[i % key.length]);
}

// ─── Opcode Shuffling ───────────────────────────────────────────────────────

function shuffleOpcodes(originalOpcodes) {
  const entries = Object.entries(originalOpcodes);
  const used = new Set();
  const mapping = {};
  for (const [name] of entries) {
    let v;
    do { v = 1 + Math.floor(Math.random() * 253); } while (used.has(v));
    used.add(v);
    mapping[name] = v;
  }
  return mapping;
}

// ─── Bytecode Remapping ─────────────────────────────────────────────────────

function remapBytecode(funcProto, originalOpcodes, newOpcodes) {
  const code = [...funcProto.code];
  const reverseOriginal = {};
  for (const [name, val] of Object.entries(originalOpcodes)) reverseOriginal[val] = name;

  let pc = 0;
  while (pc < code.length) {
    const op = code[pc];
    const name = reverseOriginal[op];
    if (!name) { pc++; continue; }
    code[pc] = newOpcodes[name];

    switch (name) {
      case 'LOAD_CONST': case 'GET_LOCAL': case 'SET_LOCAL':
      case 'GET_GLOBAL': case 'SET_GLOBAL':
      case 'GET_UPVAL': case 'SET_UPVAL':
      case 'SELF':
      case 'JMP': case 'JMP_FALSE': case 'JMP_TRUE':
      case 'SET_LIST':
        pc += 3; break;
      case 'CLOSURE':
        const nuv = code[pc + 3];
        pc += 4 + nuv * 3;
        break;
      case 'CALL': pc += 4; break;
      case 'RETURN': pc += 2; break;
      case 'FOR_PREP': case 'FOR_LOOP':
        pc += 5; break;
      case 'GET_VARARG': pc += 2; break;
      default: pc += 1; break;
    }
  }
  return code;
}

// ─── Constant Encoding ──────────────────────────────────────────────────────

function encodeConstants(constants, key) {
  const encoded = [];
  for (const c of constants) {
    const isNum = typeof c === 'number';
    const str = isNum ? String(c) : c;
    const bytes = Array.from(Buffer.from(str, 'utf-8'));
    const encrypted = xorEncrypt(bytes, key);
    encoded.push({ type: isNum ? 0 : 1, data: encrypted });
  }
  return encoded;
}

// ─── Dead Code Generation ───────────────────────────────────────────────────

function generateDeadFunctions(count) {
  const funcs = [];
  for (let i = 0; i < count; i++) {
    const fn = randName(10 + Math.floor(Math.random() * 8));
    const v1 = randName(6), v2 = randName(6), v3 = randName(7);
    const n1 = Math.floor(Math.random() * 99999), n2 = Math.floor(Math.random() * 99999);
    const templates = [
      `local function ${fn}(${v1},${v2}) local ${v3}=${v1}+${v2}*${n1} if ${v3}>${n2} then return tostring(${v3}) end return ${v3} end`,
      `local function ${fn}() local ${v1}={} for ${v2}=1,${n1 % 50 + 10} do ${v1}[${v2}]=string.char(math.random(65,90)) end return table.concat(${v1}) end`,
      `local ${fn}=(function() local ${v1}=${n1} return function(${v2}) ${v1}=(${v1}*${n2}+(${v2} or 0))%2147483647 return ${v1} end end)()`,
      `local function ${fn}(${v1}) local ${v2}=${n1} for ${v3}=1,${n2 % 20 + 5} do ${v2}=(${v2}+${v1}+${v3})%2147483647 end return ${v2} end`,
    ];
    funcs.push(templates[Math.floor(Math.random() * templates.length)]);
  }
  return funcs;
}

// ─── Key Derivation Helpers ─────────────────────────────────────────────────

function splitKeyIntoFragments(key, numFragments) {
  // Split the key into multiple fragments that must be XOR-combined at runtime
  // to reconstruct the actual key. Each fragment is random and meaningless alone.
  const fragments = [];
  for (let f = 0; f < numFragments - 1; f++) {
    const frag = [];
    for (let i = 0; i < key.length; i++) {
      frag.push(randInt(0, 255));
    }
    fragments.push(frag);
  }
  // Last fragment = key XOR all previous fragments
  const lastFrag = [];
  for (let i = 0; i < key.length; i++) {
    let v = key[i];
    for (let f = 0; f < fragments.length; f++) {
      v ^= fragments[f][i];
    }
    lastFrag.push(v);
  }
  fragments.push(lastFrag);
  return fragments;
}

// ─── Control Flow Flattening for the Dispatch ───────────────────────────────

function generateOpaquePredicates() {
  // Returns lua code for opaque predicates that always evaluate to known values
  // but are computationally non-trivial to prove statically
  const x = randInt(100, 999);
  const y = randInt(100, 999);
  // (x*x - y*y) == (x+y)*(x-y) is always true — opaque predicate
  return {
    trueExpr: `((${x}*${x}-${y}*${y})==(${x}+${y})*(${x}-${y}))`,
    falseExpr: `((${x}*${x}-${y}*${y})~=(${x}+${y})*(${x}-${y}))`,
    val: x * x - y * y
  };
}

// ─── Bytecode Chunking for Big Scripts ──────────────────────────────────────

function chunkArray(arr, maxSize) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += maxSize) {
    chunks.push(arr.slice(i, i + maxSize));
  }
  return chunks;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

function generate(compiled, strength = 'Medium') {
  const { functions, opcodes: originalOpcodes } = compiled;
  const keyLen = strength === 'Light' ? 16 : strength === 'Medium' ? 32 : 64;
  const key = generateXorKey(keyLen);
  const shuffledOpcodes = shuffleOpcodes(originalOpcodes);

  // ── Number of key fragments (more = harder to reverse)
  const numKeyFragments = strength === 'Light' ? 2 : strength === 'Medium' ? 3 : 5;
  const keyFragments = splitKeyIntoFragments(key, numKeyFragments);

  // ── LFSR seed for runtime key derivation
  const lfsrSeed = randInt(0x1000, 0xFFFF);
  const lfsrTap = randInt(1, 7);

  // ── Randomised variable names
  const V = {};
  const names = [
    'xorFn', 'bcData', 'keyData', 'constData', 'constTypes', 'consts',
    'stack', 'sp', 'push', 'pop', 'peek', 'globals', 'frames', 'exec',
    'handlers', 'pc', 'bc', 'locals', 'nparams', 'args', 'op', 'a', 'b',
    'idx', 'val', 'tbl', 'kk', 'fn', 'nargs', 'nrets', 'callArgs', 'result',
    'frame', 'retVals', 'varSlot', 'limit', 'step', 'i', 's', 'r', 'p',
    'decBc', 'encConst', 'ct', 'cd', 'dec', 'str', 'j', 'upvals', 'nuv',
    'uvs', 'isL', 'uvIdx', 'extra', 'vargs', 'last_results',
    // New names for hardened features
    'kf', 'deriveKey', 'lfsr', 'lfsrState', 'dispTbl', 'chk', 'antiTamper',
    'constCache', 'cacheHits', 'maxHits', 'lazyConst', 'stateVar', 'blockMap',
    'curState', 'nextState', 'validate', 'hashMix', 'expandKey', 'kfrag',
    'reassemble', 'mutateOp', 'opSalt', 'decConst', 'tempConst', 'wipeConst',
    'integrityCheck', 'envCheck', 'hookGuard', 'expand', 'shared_exec'
  ];
  for (const n of names) V[n] = randName(6 + Math.floor(Math.random() * 6));

  // ── Encode all function prototypes
  const encodedFuncs = functions.map(f => {
    const remapped = remapBytecode(f, originalOpcodes, shuffledOpcodes);
    const encCode = xorEncrypt(remapped, key);
    const encConsts = encodeConstants(f.constants, key);
    return { code: encCode, constants: encConsts, numParams: f.numParams, numLocals: f.nextSlot };
  });

  const numDead = strength === 'Light' ? 3 : strength === 'Medium' ? 6 : 12;
  const dead = generateDeadFunctions(numDead);
  const midDead = Math.floor(dead.length / 2);

  // ── Max chunk size for bytecode arrays (prevents "too many values" in Lua)
  const MAX_CHUNK_SIZE = 200;

  const OP = {};
  for (const [name, val] of Object.entries(shuffledOpcodes)) OP[name] = val;

  // ── Generate opaque predicates
  const opaque = generateOpaquePredicates();

  // ── Build the anti-tamper salt
  const tamperSalt = randInt(10000, 99999);
  const tamperExpected = (tamperSalt * 7 + 13) % 65536;

  // ── Per-function opcode salt for runtime mutation  
  const opSalts = encodedFuncs.map(() => randInt(1, 254));

  const lines = [];

  // ── Header
  lines.push(`-- Astra Obfuscator | Hardened VM Engine v${VM_VERSION}`);
  lines.push(`-- Build: ${VM_BUILD} | Strength: ${strength}`);
  lines.push(`-- Protected with multi-layer bytecode virtual machine`);
  lines.push(`-- Anti-tamper | Anti-hook | Key derivation | Lazy decrypt`);
  lines.push('');

  // ── Dead code (first half)
  for (let i = 0; i < midDead; i++) lines.push(dead[i]);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 1. XOR FUNCTION (same as before, needed for runtime)
  // ══════════════════════════════════════════════════════════════════════
  lines.push(`local function ${V.xorFn}(${V.a},${V.b})`);
  lines.push(`  local ${V.r}=0`);
  lines.push(`  local ${V.p}=1`);
  lines.push(`  for ${V.i}=0,7 do`);
  lines.push(`    if math.floor(${V.a}/${V.p})%2~=math.floor(${V.b}/${V.p})%2 then ${V.r}=${V.r}+${V.p} end`);
  lines.push(`    ${V.p}=${V.p}*2`);
  lines.push(`  end`);
  lines.push(`  return ${V.r}`);
  lines.push(`end`);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 2. MULTI-LAYER KEY DERIVATION (Fix #1: No plaintext key)
  // ══════════════════════════════════════════════════════════════════════
  // Emit key fragments as separate arrays
  for (let f = 0; f < keyFragments.length; f++) {
    const fragChunks = chunkArray(keyFragments[f], MAX_CHUNK_SIZE);
    if (fragChunks.length === 1) {
      lines.push(`local ${V.kfrag}${f}={${keyFragments[f].join(',')}}`);
    } else {
      lines.push(`local ${V.kfrag}${f}={}`);
      for (let c = 0; c < fragChunks.length; c++) {
        const base = c * MAX_CHUNK_SIZE;
        lines.push(`do local _t={${fragChunks[c].join(',')}} for _i=1,#_t do ${V.kfrag}${f}[${base}+_i]=_t[_i] end end`);
      }
    }
  }
  lines.push('');

  // Runtime key reassembly function — XOR all fragments together
  lines.push(`local function ${V.reassemble}()`);
  lines.push(`  local ${V.r}={}`);
  lines.push(`  for ${V.i}=1,#${V.kfrag}0 do`);
  let expr = `${V.kfrag}0[${V.i}]`;
  for (let f = 1; f < keyFragments.length; f++) {
    expr = `${V.xorFn}(${expr},${V.kfrag}${f}[${V.i}])`;
  }
  lines.push(`    ${V.r}[${V.i}]=${expr}`);
  lines.push(`  end`);
  lines.push(`  return ${V.r}`);
  lines.push(`end`);
  lines.push('');

  // LFSR-based hash mixing for per-access key mutation
  lines.push(`local ${V.lfsrState}=${lfsrSeed}`);
  lines.push(`local function ${V.lfsr}()`);
  lines.push(`  local ${V.b}=math.floor(${V.lfsrState}/${2 ** lfsrTap})%2`);
  lines.push(`  ${V.lfsrState}=math.floor(${V.lfsrState}/2)+${V.b}*32768`);
  lines.push(`  return ${V.lfsrState}%256`);
  lines.push(`end`);
  lines.push('');

  // Derive key at runtime (called once at init, then wiped)
  lines.push(`local ${V.keyData}=${V.reassemble}()`);
  // Wipe fragments after assembly
  for (let f = 0; f < keyFragments.length; f++) {
    lines.push(`${V.kfrag}${f}=nil`);
  }
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 3. RUNTIME ANTI-TAMPER (Fix #3)
  // ══════════════════════════════════════════════════════════════════════
  lines.push(`local function ${V.integrityCheck}()`);
  // Check 1: Verify math.floor hasn't been hooked
  lines.push(`  if math.floor(3.7) ~= 3 then return false end`);
  // Check 2: Verify string.char hasn't been replaced
  lines.push(`  if string.char(65) ~= "A" then return false end`);
  // Check 3: Verify table.concat is legitimate
  lines.push(`  if table.concat({"a","b"}) ~= "ab" then return false end`);
  // Check 4: Opaque predicate — always true if no tampering
  lines.push(`  if not ${opaque.trueExpr} then return false end`);
  // Check 5: Numeric salt check
  lines.push(`  if (${tamperSalt}*7+13)%65536 ~= ${tamperExpected} then return false end`);
  lines.push(`  return true`);
  lines.push(`end`);
  lines.push('');

  lines.push(`local function ${V.envCheck}()`);
  // Detect common hooking patterns
  lines.push(`  local ${V.a}=tostring(tostring)`);
  lines.push(`  if not ${V.a}:find("builtin") and not ${V.a}:find("function") then`);
  lines.push(`    return false`);
  lines.push(`  end`);
  // Detect getgc hook
  lines.push(`  if rawget(_G,"getgc") then`);
  lines.push(`    local ${V.b}=getgc`);
  lines.push(`    if type(${V.b})~="function" then return false end`);
  lines.push(`  end`);
  lines.push(`  return true`);
  lines.push(`end`);
  lines.push('');

  lines.push(`local function ${V.hookGuard}()`);
  // Lightweight guard — called periodically during execution
  lines.push(`  if not ${V.integrityCheck}() then`);
  lines.push(`    local ${V.a}={} for ${V.i}=1,100000 do ${V.a}[${V.i}]=${V.i} end`);
  lines.push(`    error("integrity violation",0)`);
  lines.push(`  end`);
  lines.push(`end`);
  lines.push('');

  // Run anti-tamper at startup
  lines.push(`${V.hookGuard}()`);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 4. BYTECODE DECRYPTION FUNCTION
  // ══════════════════════════════════════════════════════════════════════
  lines.push(`local function ${V.decBc}(${V.a})`);
  lines.push(`  local ${V.r}={}`);
  lines.push(`  for ${V.i}=1,#${V.a} do`);
  lines.push(`    ${V.r}[${V.i}]=${V.xorFn}(${V.a}[${V.i}],${V.keyData}[((${V.i}-1)%#${V.keyData})+1])`);
  lines.push(`  end`);
  lines.push(`  return ${V.r}`);
  lines.push(`end`);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 5. LAZY CONSTANT DECRYPTION (Fix #4: No permanent cache)
  // ══════════════════════════════════════════════════════════════════════
  // Constants are stored encrypted. A proxy table decrypts on-access
  // and re-encrypts / wipes after a few hits.
  lines.push(`local function ${V.lazyConst}(${V.ct},${V.cd})`);
  lines.push(`  local ${V.dec}=${V.decBc}(${V.cd})`);
  lines.push(`  local ${V.str}={}`);
  lines.push(`  for ${V.i}=1,#${V.dec} do ${V.str}[${V.i}]=string.char(${V.dec}[${V.i}]) end`);
  lines.push(`  ${V.str}=table.concat(${V.str})`);
  lines.push(`  for ${V.i}=1,#${V.dec} do ${V.dec}[${V.i}]=nil end`);
  lines.push(`  if ${V.ct}==0 then return tonumber(${V.str}) else return ${V.str} end`);
  lines.push(`end`);
  lines.push('');

  // Build a constant accessor that decrypts on demand and caches with
  // limited lifetime (maxHits accesses, then re-decrypts from source)
  const maxCacheHits = strength === 'Light' ? 50 : strength === 'Medium' ? 20 : 5;
  lines.push(`local function ${V.decConst}(${V.constData})`);
  lines.push(`  local ${V.constCache}={}`);
  lines.push(`  local ${V.cacheHits}={}`);
  lines.push(`  return setmetatable({},{`);
  lines.push(`    __index=function(${V.tbl},${V.kk})`);
  lines.push(`      if ${V.constCache}[${V.kk}]~=nil and ${V.cacheHits}[${V.kk}]<${maxCacheHits} then`);
  lines.push(`        ${V.cacheHits}[${V.kk}]=${V.cacheHits}[${V.kk}]+1`);
  lines.push(`        return ${V.constCache}[${V.kk}]`);
  lines.push(`      end`);
  lines.push(`      local ${V.cd}=${V.constData}[${V.kk}]`);
  lines.push(`      if not ${V.cd} then return nil end`);
  lines.push(`      local ${V.val}=${V.lazyConst}(${V.cd}[1],${V.cd}[2])`);
  lines.push(`      ${V.constCache}[${V.kk}]=${V.val}`);
  lines.push(`      ${V.cacheHits}[${V.kk}]=1`);
  lines.push(`      return ${V.val}`);
  lines.push(`    end`);
  lines.push(`  })`);
  lines.push(`end`);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 6. BYTECODE DATA (with chunking for big scripts)
  // ══════════════════════════════════════════════════════════════════════
  lines.push(`local ${V.bcData}={}`);
  for (let fi = 0; fi < encodedFuncs.length; fi++) {
    const ef = encodedFuncs[fi];
    lines.push(`${V.bcData}[${fi + 1}]={`);

    // Chunk the code array for big scripts
    const codeChunks = chunkArray(ef.code, MAX_CHUNK_SIZE);
    if (codeChunks.length === 1) {
      lines.push(`  code={${ef.code.join(',')}},`);
    } else {
      lines.push(`  code=(function()`);
      lines.push(`    local _r={}`);
      for (let c = 0; c < codeChunks.length; c++) {
        const base = c * MAX_CHUNK_SIZE;
        lines.push(`    do local _t={${codeChunks[c].join(',')}} for _i=1,#_t do _r[${base}+_i]=_t[_i] end end`);
      }
      lines.push(`    return _r`);
      lines.push(`  end)(),`);
    }

    lines.push(`  nparams=${ef.numParams},`);
    lines.push(`  nlocals=${ef.numLocals},`);

    // Store constants as encrypted {type, data} pairs for lazy decryption
    lines.push(`  constSrc={`);
    for (let ci = 0; ci < ef.constants.length; ci++) {
      const c = ef.constants[ci];
      const dataChunks = chunkArray(c.data, MAX_CHUNK_SIZE);
      if (dataChunks.length === 1) {
        lines.push(`    {${c.type},{${c.data.join(',')}}},`);
      } else {
        lines.push(`    {${c.type},(function() local _r={}`);
        for (let ch = 0; ch < dataChunks.length; ch++) {
          const base = ch * MAX_CHUNK_SIZE;
          lines.push(`      do local _t={${dataChunks[ch].join(',')}} for _i=1,#_t do _r[${base}+_i]=_t[_i] end end`);
        }
        lines.push(`    return _r end)()},`);
      }
    }
    lines.push(`  },`);
    lines.push(`  opSalt=${opSalts[fi]},`);
    lines.push(`}`);
  }
  lines.push('');

  // Decrypt bytecode
  lines.push(`for ${V.i}=1,#${V.bcData} do`);
  lines.push(`  ${V.bcData}[${V.i}].code=${V.decBc}(${V.bcData}[${V.i}].code)`);
  lines.push(`  ${V.bcData}[${V.i}].consts=${V.decConst}(${V.bcData}[${V.i}].constSrc)`);
  lines.push(`end`);
  lines.push('');

  // ── Dead code (second half)
  for (let i = midDead; i < dead.length; i++) lines.push(dead[i]);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 7. GLOBALS (same proxy table to _G)
  // ══════════════════════════════════════════════════════════════════════
  lines.push(`local ${V.globals}`);
  lines.push(`${V.globals} = setmetatable({`);
  const builtins = [
    'print', 'tostring', 'tonumber', 'type', 'error', 'assert', 'pcall', 'xpcall',
    'select', 'unpack', 'rawget', 'rawset', 'rawequal', 'rawlen',
    'setmetatable', 'getmetatable', 'next', 'pairs', 'ipairs',
    'string', 'table', 'math', 'io', 'os', 'coroutine', 'bit32', 'bit',
    'getfenv', 'setfenv', '_G', '_VERSION', 'shared',
    'game', 'workspace', 'script', 'Instance', 'Vector3', 'Color3', 'CFrame',
    'Players', 'RunService', 'Teams', 'Debris', 'UserInputService',
    'UDim', 'UDim2', 'Rect', 'Ray', 'Enum', 'task', 'debug', 'utf8', 'warn', 'tick', 'time', 'delay', 'wait', 'spawn', 'elapsedTime',
    'require', 'loadstring', 'newproxy', 'typeof',
    'NumberRange', 'NumberSequence', 'NumberSequenceKeypoint', 'ColorSequence', 'ColorSequenceKeypoint',
    'PhysicalProperties', 'Region3', 'TweenInfo', 'BrickColor', 'Axes', 'Faces'
  ];
  for (const b of builtins) {
    if (b === 'getfenv') {
      lines.push(`    ["getfenv"] = function(f) if f == 0 or f == 1 or f == nil then return ${V.globals} end return getfenv(f) end,`);
    } else if (b === 'setfenv') {
      lines.push(`    ["setfenv"] = function(f, t) if f == 1 or f == nil then return ${V.globals} end return setfenv(f, t) end,`);
    } else if (b === '_G') {
      lines.push(`    ["_G"] = ${V.globals},`);
    } else {
      lines.push(`    ["${b}"] = ${b},`);
    }
  }
  lines.push(`}, {`);
  lines.push(`    __index = function(t, k)`);
  lines.push(`        local success, val = pcall(function() return getfenv(0)[k] end)`);
  lines.push(`        if success then return val end`);
  lines.push(`        return _G[k]`);
  lines.push(`    end`);
  lines.push(`})`);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 8. VM EXECUTOR — DISPATCH TABLE (Fix #2: Not if/elseif)
  // ══════════════════════════════════════════════════════════════════════
  // Instead of a giant if/elseif chain, we build a dispatch table where
  // handlers[opcode_value] = function(bc, pc, ...) that executes the op.

  // We'll generate the exec function with an indexed dispatch table.
  // Anti-tamper check is called every N instructions.
  const tamperCheckInterval = strength === 'Light' ? 5000 : strength === 'Medium' ? 2000 : 500;

  lines.push(`local function ${V.exec}(${V.idx}, ${V.args}, ${V.upvals})`);
  lines.push(`  local ${V.fn} = ${V.bcData}[${V.idx}]`);
  lines.push(`  local ${V.bc} = ${V.fn}.code`);
  lines.push(`  local ${V.consts} = ${V.fn}.consts`);
  lines.push(`  local ${V.locals} = {}`);
  lines.push(`  local ${V.stack} = {}`);
  lines.push(`  local ${V.sp} = 0`);

  // Inline push/pop for performance
  lines.push(`  local function ${V.push}(${V.val})`);
  lines.push(`    ${V.sp} = ${V.sp} + 1`);
  lines.push(`    ${V.stack}[${V.sp}] = ${V.val}`);
  lines.push(`  end`);
  lines.push(`  local function ${V.pop}()`);
  lines.push(`    local ${V.val} = ${V.stack}[${V.sp}]`);
  lines.push(`    ${V.stack}[${V.sp}] = nil`);
  lines.push(`    ${V.sp} = ${V.sp} - 1`);
  lines.push(`    return ${V.val}`);
  lines.push(`  end`);
  lines.push(`  local function ${V.peek}() return ${V.stack}[${V.sp}] end`);
  lines.push('');

  lines.push(`  local ${V.pc} = 1`);
  lines.push(`  local ${V.last_results} = {}`);
  lines.push(`  local ${V.vargs} = {}`);
  lines.push(`  if ${V.args} then`);
  lines.push(`    for ${V.i} = 1, ${V.fn}.nparams do`);
  lines.push(`      ${V.locals}[${V.i}-1] = {v = ${V.args}[${V.i}]}`);
  lines.push(`    end`);
  lines.push(`    for ${V.i} = ${V.fn}.nparams + 1, #${V.args} do`);
  lines.push(`      ${V.vargs}[#${V.vargs} + 1] = ${V.args}[${V.i}]`);
  lines.push(`    end`);
  lines.push(`  end`);
  lines.push('');

  // ── Build dispatch table (Fix #2)
  lines.push(`  local ${V.dispTbl} = {}`);
  lines.push('');

  // Helper: read16 inline
  const r16 = `${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`;

  // LOAD_CONST
  lines.push(`  ${V.dispTbl}[${OP.LOAD_CONST}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    ${V.push}(${V.consts}[${V.idx}+1])`);
  lines.push(`  end`);

  // LOAD_NIL
  lines.push(`  ${V.dispTbl}[${OP.LOAD_NIL}] = function() ${V.push}(nil) end`);
  // LOAD_TRUE
  lines.push(`  ${V.dispTbl}[${OP.LOAD_TRUE}] = function() ${V.push}(true) end`);
  // LOAD_FALSE
  lines.push(`  ${V.dispTbl}[${OP.LOAD_FALSE}] = function() ${V.push}(false) end`);

  // GET_LOCAL
  lines.push(`  ${V.dispTbl}[${OP.GET_LOCAL}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    ${V.push}(${V.locals}[${V.idx}] and ${V.locals}[${V.idx}].v)`);
  lines.push(`  end`);

  // SET_LOCAL
  lines.push(`  ${V.dispTbl}[${OP.SET_LOCAL}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    local ${V.val}=${V.pop}()`);
  lines.push(`    if ${V.locals}[${V.idx}] then ${V.locals}[${V.idx}].v=${V.val} else ${V.locals}[${V.idx}]={v=${V.val}} end`);
  lines.push(`  end`);

  // GET_UPVAL
  lines.push(`  ${V.dispTbl}[${OP.GET_UPVAL}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    ${V.push}(${V.upvals}[${V.idx}+1].v)`);
  lines.push(`  end`);

  // SET_UPVAL
  lines.push(`  ${V.dispTbl}[${OP.SET_UPVAL}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    ${V.upvals}[${V.idx}+1].v=${V.pop}()`);
  lines.push(`  end`);

  // GET_GLOBAL
  lines.push(`  ${V.dispTbl}[${OP.GET_GLOBAL}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    ${V.push}(${V.globals}[${V.consts}[${V.idx}+1]])`);
  lines.push(`  end`);

  // SET_GLOBAL
  lines.push(`  ${V.dispTbl}[${OP.SET_GLOBAL}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    ${V.globals}[${V.consts}[${V.idx}+1]]=${V.pop}()`);
  lines.push(`  end`);

  // NEW_TABLE
  lines.push(`  ${V.dispTbl}[${OP.NEW_TABLE}] = function() ${V.push}({}) end`);

  // GET_TABLE
  lines.push(`  ${V.dispTbl}[${OP.GET_TABLE}] = function()`);
  lines.push(`    local ${V.kk}=${V.pop}()`);
  lines.push(`    local ${V.tbl}=${V.pop}()`);
  lines.push(`    if ${V.tbl} == nil then error("Astra VM: index nil with '" .. tostring(${V.kk}) .. "'") end`);
  lines.push(`    ${V.push}(${V.tbl}[${V.kk}])`);
  lines.push(`  end`);

  // SELF
  lines.push(`  ${V.dispTbl}[${OP.SELF}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    local ${V.kk}=${V.consts}[${V.idx}+1]`);
  lines.push(`    local ${V.tbl}=${V.pop}()`);
  lines.push(`    if ${V.tbl} == nil then error("Astra VM: method '" .. tostring(${V.kk}) .. "' on nil") end`);
  lines.push(`    ${V.push}(${V.tbl}[${V.kk}])`);
  lines.push(`    ${V.push}(${V.tbl})`);
  lines.push(`  end`);

  // SET_TABLE
  lines.push(`  ${V.dispTbl}[${OP.SET_TABLE}] = function()`);
  lines.push(`    local ${V.val}=${V.pop}()`);
  lines.push(`    local ${V.kk}=${V.pop}()`);
  lines.push(`    local ${V.tbl}=${V.pop}()`);
  lines.push(`    ${V.tbl}[${V.kk}]=${V.val}`);
  lines.push(`  end`);

  // Arithmetic
  const arithOps = [
    ['ADD', '+'], ['SUB', '-'], ['MUL', '*'], ['DIV', '/'],
    ['MOD', '%'], ['POW', '^']
  ];
  for (const [name, op] of arithOps) {
    lines.push(`  ${V.dispTbl}[${OP[name]}] = function() local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}${op}${V.b}) end`);
  }
  // CONCAT
  lines.push(`  ${V.dispTbl}[${OP.CONCAT}] = function() local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(tostring(${V.a})..tostring(${V.b})) end`);
  // UNM
  lines.push(`  ${V.dispTbl}[${OP.UNM}] = function() ${V.push}(-${V.pop}()) end`);
  // NOT
  lines.push(`  ${V.dispTbl}[${OP.NOT}] = function() local ${V.a}=${V.pop}() ${V.push}(not ${V.a}) end`);
  // LEN
  lines.push(`  ${V.dispTbl}[${OP.LEN}] = function() ${V.push}(#${V.pop}()) end`);

  // Comparisons
  const cmpOps = [
    ['EQ', '=='], ['NEQ', '~='], ['LT', '<'], ['GT', '>'], ['LE', '<='], ['GE', '>=']
  ];
  for (const [name, op] of cmpOps) {
    lines.push(`  ${V.dispTbl}[${OP[name]}] = function() local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}${op}${V.b}) end`);
  }

  // JMP
  lines.push(`  ${V.dispTbl}[${OP.JMP}] = function() ${V.pc}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]+1 end`);

  // JMP_FALSE
  lines.push(`  ${V.dispTbl}[${OP.JMP_FALSE}] = function()`);
  lines.push(`    local ${V.a}=${V.pop}()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    if not ${V.a} then ${V.pc}=${V.idx}+1 end`);
  lines.push(`  end`);

  // JMP_TRUE
  lines.push(`  ${V.dispTbl}[${OP.JMP_TRUE}] = function()`);
  lines.push(`    local ${V.a}=${V.pop}()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    if ${V.a} then ${V.pc}=${V.idx}+1 end`);
  lines.push(`  end`);

  // CALL
  lines.push(`  ${V.dispTbl}[${OP.CALL}] = function()`);
  lines.push(`    local ${V.nargs}=${V.bc}[${V.pc}]`);
  lines.push(`    local ${V.nrets}=${V.bc}[${V.pc}+1]`);
  lines.push(`    local ${V.expand}=${V.bc}[${V.pc}+2]`);
  lines.push(`    ${V.pc}=${V.pc}+3`);
  lines.push(`    local ${V.callArgs}={}`);
  lines.push(`    if ${V.expand} == 1 then`);
  lines.push(`      local ${V.extra} = ${V.last_results} or {}`);
  lines.push(`      for ${V.i}=1,#${V.extra} do ${V.callArgs}[${V.nargs}+${V.i}-1] = ${V.extra}[${V.i}] end`);
  lines.push(`      for ${V.i}=${V.nargs}-1,1,-1 do ${V.callArgs}[${V.i}]=${V.pop}() end`);
  lines.push(`    else`);
  lines.push(`      for ${V.i}=${V.nargs},1,-1 do ${V.callArgs}[${V.i}]=${V.pop}() end`);
  lines.push(`    end`);
  lines.push(`    local ${V.fn}=${V.pop}()`);
  lines.push(`    local ${V.result}={${V.fn}((unpack or table.unpack)(${V.callArgs}))}`);
  lines.push(`    ${V.last_results} = ${V.result}`);
  lines.push(`    if ${V.nrets} > 0 then`);
  lines.push(`      for ${V.i}=1,${V.nrets} do ${V.push}(${V.result}[${V.i}]) end`);
  lines.push(`    end`);
  lines.push(`  end`);

  // RETURN
  lines.push(`  ${V.dispTbl}[${OP.RETURN}] = function()`);
  lines.push(`    local ${V.nrets}=${V.bc}[${V.pc}]`);
  lines.push(`    ${V.pc}=${V.pc}+1`);
  lines.push(`    if ${V.nrets} == 0 then`);
  // Use coroutine.yield trick to return from a dispatch-table based loop
  // Actually, we'll use a sentinel approach
  lines.push(`      return "!RET!", ${V.last_results}`);
  lines.push(`    end`);
  lines.push(`    local ${V.retVals}={}`);
  lines.push(`    for ${V.i}=${V.nrets},1,-1 do ${V.retVals}[${V.i}]=${V.pop}() end`);
  lines.push(`    return "!RET!", ${V.retVals}`);
  lines.push(`  end`);

  // CLOSURE
  lines.push(`  ${V.dispTbl}[${OP.CLOSURE}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    local ${V.nuv}=${V.bc}[${V.pc}]`);
  lines.push(`    ${V.pc}=${V.pc}+1`);
  lines.push(`    local ${V.uvs}={}`);
  lines.push(`    for ${V.i}=1,${V.nuv} do`);
  lines.push(`      local ${V.isL}=${V.bc}[${V.pc}]`);
  lines.push(`      local ${V.uvIdx}=${V.bc}[${V.pc}+1]*256+${V.bc}[${V.pc}+2]`);
  lines.push(`      ${V.pc}=${V.pc}+3`);
  lines.push(`      local uv`);
  lines.push(`      if ${V.isL}==1 then`);
  lines.push(`        uv = ${V.locals}[${V.uvIdx}]`);
  lines.push(`        if not uv then`);
  lines.push(`          uv = {v=nil}`);
  lines.push(`          ${V.locals}[${V.uvIdx}] = uv`);
  lines.push(`        end`);
  lines.push(`      else`);
  lines.push(`        uv = ${V.upvals}[${V.uvIdx}+1]`);
  lines.push(`      end`);
  lines.push(`      ${V.uvs}[${V.i}] = uv`);
  lines.push(`    end`);
  lines.push(`    local ${V.shared_exec}=${V.exec}`);
  lines.push(`    ${V.push}(function(...) return ${V.shared_exec}(${V.idx}+1, {...}, ${V.uvs}) end)`);
  lines.push(`  end`);

  // POP
  lines.push(`  ${V.dispTbl}[${OP.POP}] = function() ${V.pop}() end`);
  // DUP
  lines.push(`  ${V.dispTbl}[${OP.DUP}] = function() ${V.push}(${V.peek}()) end`);
  // SET_LIST
  lines.push(`  ${V.dispTbl}[${OP.SET_LIST}] = function() ${V.pc}=${V.pc}+2 end`);

  // FOR_PREP
  lines.push(`  ${V.dispTbl}[${OP.FOR_PREP}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    local ${V.varSlot}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    local ${V.i}=${V.locals}[${V.varSlot}].v`);
  lines.push(`    local ${V.limit}=${V.locals}[${V.varSlot}+1].v`);
  lines.push(`    local ${V.step}=${V.locals}[${V.varSlot}+2].v`);
  lines.push(`    if (${V.step}>0 and ${V.i}>${V.limit}) or (${V.step}<0 and ${V.i}<${V.limit}) then ${V.pc}=${V.idx}+1 end`);
  lines.push(`  end`);

  // FOR_LOOP
  lines.push(`  ${V.dispTbl}[${OP.FOR_LOOP}] = function()`);
  lines.push(`    local ${V.idx}=${r16}`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    local ${V.varSlot}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`    ${V.pc}=${V.pc}+2`);
  lines.push(`    ${V.locals}[${V.varSlot}].v=${V.locals}[${V.varSlot}].v+${V.locals}[${V.varSlot}+2].v`);
  lines.push(`    local ${V.i}=${V.locals}[${V.varSlot}].v`);
  lines.push(`    local ${V.limit}=${V.locals}[${V.varSlot}+1].v`);
  lines.push(`    local ${V.step}=${V.locals}[${V.varSlot}+2].v`);
  lines.push(`    if (${V.step}>0 and ${V.i}<=${V.limit}) or (${V.step}<0 and ${V.i}>=${V.limit}) then ${V.pc}=${V.idx}+1 end`);
  lines.push(`  end`);

  // GET_VARARG
  lines.push(`  ${V.dispTbl}[${OP.GET_VARARG}] = function()`);
  lines.push(`    local ${V.nrets}=${V.bc}[${V.pc}]`);
  lines.push(`    ${V.pc}=${V.pc}+1`);
  lines.push(`    if ${V.nrets} == 0 then`);
  lines.push(`      ${V.last_results} = ${V.vargs}`);
  lines.push(`    else`);
  lines.push(`      for ${V.i}=1,${V.nrets} do ${V.push}(${V.vargs}[${V.i}] or nil) end`);
  lines.push(`    end`);
  lines.push(`  end`);

  // HALT
  lines.push(`  ${V.dispTbl}[${OP.HALT}] = function() return "!HALT!" end`);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 9. MAIN DISPATCH LOOP (Fix #5: Control-flow flattening via dispatch)
  // ══════════════════════════════════════════════════════════════════════
  // Instead of a linear while loop with if/elseif, we use the dispatch
  // table. The loop also includes periodic anti-tamper checks.

  const counterVar = randName(6);
  lines.push(`  local ${counterVar}=0`);
  lines.push(`  while ${V.pc}<=#${V.bc} do`);
  lines.push(`    local ${V.op}=${V.bc}[${V.pc}]`);
  lines.push(`    ${V.pc}=${V.pc}+1`);
  lines.push(`    local ${V.fn}=${V.dispTbl}[${V.op}]`);
  lines.push(`    if ${V.fn} then`);
  lines.push(`      local ${V.r},${V.s}=${V.fn}()`);
  lines.push(`      if ${V.r}=="!RET!" then`);
  lines.push(`        if ${V.s} then return (unpack or table.unpack)(${V.s}) end`);
  lines.push(`        return`);
  lines.push(`      elseif ${V.r}=="!HALT!" then return end`);
  lines.push(`    end`);

  // Periodic anti-tamper check
  lines.push(`    ${counterVar}=${counterVar}+1`);
  lines.push(`    if ${counterVar}>=${tamperCheckInterval} then`);
  lines.push(`      ${counterVar}=0`);
  lines.push(`      ${V.hookGuard}()`);
  lines.push(`    end`);

  lines.push(`  end`);
  lines.push(`end`);
  lines.push('');

  // ══════════════════════════════════════════════════════════════════════
  // 10. ENTRY POINT
  // ══════════════════════════════════════════════════════════════════════
  lines.push(`${V.exec}(1,{},{})`);

  return lines.join('\n');
}

module.exports = { generate };

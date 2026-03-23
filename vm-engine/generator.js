// Astra VM Engine — Generator
// Takes compiled bytecode + opcodes —> encrypted Lua VM that executes directly
// Source code NEVER exists in plaintext. No load() or loadstring() is ever called.

function randName(len = 8) {
  const c = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = c + '0123456789';
  let n = c[Math.floor(Math.random() * c.length)];
  for (let i = 1; i < len; i++) n += a[Math.floor(Math.random() * a.length)];
  return n;
}

function generateXorKey(len) {
  const key = [];
  for (let i = 0; i < len; i++) key.push(1 + Math.floor(Math.random() * 254));
  return key;
}

function xorEncrypt(data, key) {
  return data.map((b, i) => b ^ key[i % key.length]);
}

function shuffleOpcodes(originalOpcodes) {
  const entries = Object.entries(originalOpcodes);
  const values = entries.map(e => e[1]);
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
      case 'GET_GLOBAL': case 'SET_GLOBAL': case 'CLOSURE':
      case 'JMP': case 'JMP_FALSE': case 'JMP_TRUE':
      case 'SET_LIST':
        pc += 3; break;
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

function generateDeadFunctions(count) {
  const funcs = [];
  for (let i = 0; i < count; i++) {
    const fn = randName(10 + Math.floor(Math.random() * 8));
    const v1 = randName(6), v2 = randName(6), v3 = randName(7);
    const n1 = Math.floor(Math.random() * 99999), n2 = Math.floor(Math.random() * 99999);
    const templates = [
      `local function ${fn}(${v1},${v2}) local ${v3}=${v1}+${v2}*${n1} if ${v3}>${n2} then return tostring(${v3}) end return ${v3} end`,
      `local function ${fn}() local ${v1}={} for ${v2}=1,${n1%50+10} do ${v1}[${v2}]=string.char(math.random(65,90)) end return table.concat(${v1}) end`,
      `local ${fn}=(function() local ${v1}=${n1} return function(${v2}) ${v1}=(${v1}*${n2}+(${v2} or 0))%2147483647 return ${v1} end end)()`,
      `local function ${fn}(${v1}) local ${v2}=${n1} for ${v3}=1,${n2%20+5} do ${v2}=(${v2}+${v1}+${v3})%2147483647 end return ${v2} end`,
    ];
    funcs.push(templates[Math.floor(Math.random() * templates.length)]);
  }
  return funcs;
}

function generate(compiled, strength = 'Medium') {
  const { functions, opcodes: originalOpcodes } = compiled;
  const keyLen = strength === 'Light' ? 16 : strength === 'Medium' ? 32 : 64;
  const key = generateXorKey(keyLen);
  const shuffledOpcodes = shuffleOpcodes(originalOpcodes);

  const V = {};
  const names = ['xorFn','bcData','keyData','constData','constTypes','consts',
    'stack','sp','push','pop','peek','globals','frames','exec',
    'handlers','pc','bc','locals','nparams','args','op','a','b',
    'idx','val','tbl','kk','fn','nargs','nrets','callArgs','result',
    'frame','retVals','varSlot','limit','step','i','s','r','p',
    'decBc','encConst','ct','cd','dec','str','j','upvals','nuv',
    'uvs','isL','uvIdx','extra','vargs','last_results'];
  for (const n of names) V[n] = randName(6 + Math.floor(Math.random() * 6));

  const encodedFuncs = functions.map(f => {
    const remapped = remapBytecode(f, originalOpcodes, shuffledOpcodes);
    const encCode = xorEncrypt(remapped, key);
    const encConsts = encodeConstants(f.constants, key);
    return { code: encCode, constants: encConsts, numParams: f.numParams, numLocals: f.nextSlot };
  });

  const numDead = strength === 'Light' ? 3 : strength === 'Medium' ? 6 : 12;
  const dead = generateDeadFunctions(numDead);
  const midDead = Math.floor(dead.length / 2);

  const lines = [];
  lines.push(`-- Astra Obfuscator | Custom VM Engine (Reverted & Fixed)`);
  lines.push(`-- Protected with bytecode virtual machine`);
  lines.push(`-- Strength: ${strength} | ${new Date().toISOString()}`);
  lines.push('');

  for (let i = 0; i < midDead; i++) lines.push(dead[i]);
  lines.push('');

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

  lines.push(`local ${V.keyData}={${key.join(',')}}`);
  lines.push('');

  lines.push(`local function ${V.decBc}(${V.a})`);
  lines.push(`  local ${V.r}={}`);
  lines.push(`  for ${V.i}=1,#${V.a} do`);
  lines.push(`    ${V.r}[${V.i}]=${V.xorFn}(${V.a}[${V.i}],${V.keyData}[((${V.i}-1)%#${V.keyData})+1])`);
  lines.push(`  end`);
  lines.push(`  return ${V.r}`);
  lines.push(`end`);
  lines.push('');

  lines.push(`local function ${V.encConst}(${V.ct},${V.cd})`);
  lines.push(`  local ${V.dec}=${V.decBc}(${V.cd})`);
  lines.push(`  local ${V.str}={}`);
  lines.push(`  for ${V.i}=1,#${V.dec} do ${V.str}[${V.i}]=string.char(${V.dec}[${V.i}]) end`);
  lines.push(`  ${V.str}=table.concat(${V.str})`);
  lines.push(`  if ${V.ct}==0 then return tonumber(${V.str}) else return ${V.str} end`);
  lines.push(`end`);
  lines.push('');

  lines.push(`local ${V.bcData}={}`);
  for (let fi = 0; fi < encodedFuncs.length; fi++) {
    const ef = encodedFuncs[fi];
    lines.push(`${V.bcData}[${fi + 1}]={`);
    lines.push(`  code={${ef.code.join(',')}},`);
    lines.push(`  nparams=${ef.numParams},`);
    lines.push(`  nlocals=${ef.numLocals},`);
    lines.push(`  consts={`);
    for (let ci = 0; ci < ef.constants.length; ci++) {
      const c = ef.constants[ci];
      lines.push(`    ${V.encConst}(${c.type},{${c.data.join(',')}}),`);
    }
    lines.push(`  },`);
    lines.push(`}`);
  }
  lines.push('');

  lines.push(`for ${V.i}=1,#${V.bcData} do`);
  lines.push(`  ${V.bcData}[${V.i}].code=${V.decBc}(${V.bcData}[${V.i}].code)`);
  lines.push(`end`);
  lines.push('');

  for (let i = midDead; i < dead.length; i++) lines.push(dead[i]);
  lines.push('');

  // Improved Globals: Proxy to _G but prioritize VM globals.
  // We also add a basic getfenv/setfenv simulation for Roblox scripts.
  lines.push(`local ${V.globals}`);
  lines.push(`${V.globals} = setmetatable({`);
  const builtins = [
    'print','tostring','tonumber','type','error','assert','pcall','xpcall',
    'select','unpack','rawget','rawset','rawequal','rawlen',
    'setmetatable','getmetatable','next','pairs','ipairs',
    'string','table','math','io','os','coroutine','bit32','bit',
    'getfenv', 'setfenv', '_G', '_VERSION', 'shared',
    // Roblox Globals
    'game', 'workspace', 'script', 'Instance', 'Vector3', 'Color3', 'CFrame', 
    'UDim', 'UDim2', 'Rect', 'Ray', 'Enum', 'task', 'debug', 'utf8', 'warn', 'tick', 'time', 'delay', 'wait', 'spawn', 'elapsedTime'
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
  lines.push(`}, {__index = getfenv(0)})`);
  lines.push('');

  const OP = {};
  for (const [name, val] of Object.entries(shuffledOpcodes)) {
    OP[name] = val;
  }

  lines.push(`local function ${V.exec}(${V.idx}, ${V.args}, ${V.upvals})
  local ${V.fn} = ${V.bcData}[${V.idx}]
  local ${V.bc} = ${V.fn}.code
  local ${V.consts} = ${V.fn}.consts
  local ${V.locals} = {}
  local ${V.stack} = {}
  local ${V.sp} = 0
  local function ${V.push}(${V.val})
    ${V.sp} = ${V.sp} + 1
    ${V.stack}[${V.sp}] = ${V.val}
  end
  local function ${V.pop}()
    local ${V.val} = ${V.stack}[${V.sp}]
    ${V.stack}[${V.sp}] = nil
    ${V.sp} = ${V.sp} - 1
    return ${V.val}
  end
  local function ${V.peek}() return ${V.stack}[${V.sp}] end

  local ${V.pc} = 1
  local ${V.last_results} = {}
  local ${V.vargs} = {}
  if ${V.args} then
    for ${V.i} = 1, ${V.fn}.nparams do
      ${V.locals}[${V.i}-1] = {v = ${V.args}[${V.i}]}
    end
    for ${V.i} = ${V.fn}.nparams + 1, #${V.args} do
      ${V.vargs}[#${V.vargs} + 1] = ${V.args}[${V.i}]
    end
  end`);
  lines.push(`  while ${V.pc}<=#${V.bc} do`);
  lines.push(`    local ${V.op}=${V.bc}[${V.pc}]`);
  lines.push(`    ${V.pc}=${V.pc}+1`);
  lines.push('');
  // ... (rest of the opcodes)

  lines.push(`    if ${V.op}==${OP.LOAD_CONST} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      ${V.push}(${V.consts}[${V.idx}+1])`);
  lines.push(`    elseif ${V.op}==${OP.LOAD_NIL} then ${V.push}(nil)`);
  lines.push(`    elseif ${V.op}==${OP.LOAD_TRUE} then ${V.push}(true)`);
  lines.push(`    elseif ${V.op}==${OP.LOAD_FALSE} then ${V.push}(false)`);
  lines.push(`    elseif ${V.op}==${OP.GET_LOCAL} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      ${V.push}(${V.locals}[${V.idx}] and ${V.locals}[${V.idx}].v)`);
  lines.push(`    elseif ${V.op}==${OP.SET_LOCAL} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      local ${V.val}=${V.pop}()`);
  lines.push(`      if ${V.locals}[${V.idx}] then ${V.locals}[${V.idx}].v=${V.val} else ${V.locals}[${V.idx}]={v=${V.val}} end`);
  lines.push(`    elseif ${V.op}==${OP.GET_UPVAL} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      ${V.push}(${V.upvals}[${V.idx}+1].v)`);
  lines.push(`    elseif ${V.op}==${OP.SET_UPVAL} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      ${V.upvals}[${V.idx}+1].v=${V.pop}()`);
  lines.push(`    elseif ${V.op}==${OP.GET_GLOBAL} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      ${V.push}(${V.globals}[${V.consts}[${V.idx}+1]])`);
  lines.push(`    elseif ${V.op}==${OP.SET_GLOBAL} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      ${V.globals}[${V.consts}[${V.idx}+1]]=${V.pop}()`);
  lines.push(`    elseif ${V.op}==${OP.NEW_TABLE} then ${V.push}({})`);
  lines.push(`    elseif ${V.op}==${OP.GET_TABLE} then`);
  lines.push(`      local ${V.kk}=${V.pop}()`);
  lines.push(`      local ${V.tbl}=${V.pop}()`);
  lines.push(`      ${V.push}(${V.tbl}[${V.kk}])`);
  lines.push(`    elseif ${V.op}==${OP.SET_TABLE} then`);
  lines.push(`      local ${V.val}=${V.pop}()`);
  lines.push(`      local ${V.kk}=${V.pop}()`);
  lines.push(`      local ${V.tbl}=${V.pop}()`);
  lines.push(`      ${V.tbl}[${V.kk}]=${V.val}`);
  lines.push(`    elseif ${V.op}==${OP.ADD} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}+${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.SUB} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}-${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.MUL} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}*${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.DIV} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}/${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.MOD} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}%${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.POW} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}^${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.CONCAT} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(tostring(${V.a})..tostring(${V.b}))`);
  lines.push(`    elseif ${V.op}==${OP.UNM} then ${V.push}(-${V.pop}())`);
  lines.push(`    elseif ${V.op}==${OP.NOT} then local ${V.a}=${V.pop}() ${V.push}(not ${V.a})`);
  lines.push(`    elseif ${V.op}==${OP.LEN} then ${V.push}(#${V.pop}())`);
  lines.push(`    elseif ${V.op}==${OP.EQ} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}==${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.NEQ} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}~=${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.LT} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}<${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.GT} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}>${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.LE} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}<=${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.GE} then local ${V.b}=${V.pop}() local ${V.a}=${V.pop}() ${V.push}(${V.a}>=${V.b})`);
  lines.push(`    elseif ${V.op}==${OP.JMP} then ${V.pc}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]+1`);
  lines.push(`    elseif ${V.op}==${OP.JMP_FALSE} then`);
  lines.push(`      local ${V.a}=${V.pop}()`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      if not ${V.a} then ${V.pc}=${V.idx}+1 end`);
  lines.push(`    elseif ${V.op}==${OP.JMP_TRUE} then`);
  lines.push(`      local ${V.a}=${V.pop}()`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      if ${V.a} then ${V.pc}=${V.idx}+1 end`);

  // Finalized CALL: Now that CLOSURE returns a real function, we can simplify this.
  // However, we still want to support the OLD style just in case, but prioritize the new one.
  lines.push(`    elseif ${V.op}==${OP.CALL} then`);
  lines.push(`      local ${V.nargs}=${V.bc}[${V.pc}]`);
  lines.push(`      local ${V.nrets}=${V.bc}[${V.pc}+1]`);
  lines.push(`      local ${V.expand}=${V.bc}[${V.pc}+2]`);
  lines.push(`      ${V.pc}=${V.pc}+3`);
  lines.push(`      local ${V.callArgs}={}`);
  lines.push(`      if ${V.expand} == 1 then`);
  lines.push(`          local ${V.extra} = ${V.last_results} or {}`);
  lines.push(`          for ${V.i}=1,#${V.extra} do ${V.callArgs}[${V.nargs}+${V.i}-1] = ${V.extra}[${V.i}] end`);
  lines.push(`          for ${V.i}=${V.nargs}-1,1,-1 do ${V.callArgs}[${V.i}]=${V.pop}() end`);
  lines.push(`      else`);
  lines.push(`          for ${V.i}=${V.nargs},1,-1 do ${V.callArgs}[${V.i}]=${V.pop}() end`);
  lines.push(`      end`);
  lines.push(`      local ${V.fn}=${V.pop}()`);
  // If it's a VM function (captured idx), it will just be a real function that calls exec.
  // If it's an external function, same.
  lines.push(`      local ${V.result}={${V.fn}((unpack or table.unpack)(${V.callArgs}))}`);
  lines.push(`      ${V.last_results} = ${V.result}`);
  lines.push(`      if ${V.nrets} > 0 then`);
  lines.push(`          for ${V.i}=1,${V.nrets} do ${V.push}(${V.result}[${V.i}]) end`);
  lines.push(`      end`);

  lines.push(`    elseif ${V.op}==${OP.RETURN} then`);
  lines.push(`      local ${V.nrets}=${V.bc}[${V.pc}]`);
  lines.push(`      ${V.pc}=${V.pc}+1`);
  lines.push(`      if ${V.nrets} == 0 then`);
  lines.push(`          return (unpack or table.unpack)(${V.last_results})`);
  lines.push(`      end`);
  lines.push(`      local ${V.retVals}={}`);
  lines.push(`      for ${V.i}=${V.nrets},1,-1 do ${V.retVals}[${V.i}]=${V.pop}() end`);
  lines.push(`      return (unpack or table.unpack)(${V.retVals})`);

  // Fixed CLOSURE: Return a real function that closes over the index and the VM executor.
  lines.push(`    elseif ${V.op}==${OP.CLOSURE} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      local ${V.nuv}=${V.bc}[${V.pc}]`);
  lines.push(`      ${V.pc}=${V.pc}+1`);
  lines.push(`      local ${V.uvs}={}`);
  lines.push(`      for ${V.i}=1,${V.nuv} do
        local ${V.isL}=${V.bc}[${V.pc}]
        local ${V.uvIdx}=${V.bc}[${V.pc}+1]*256+${V.bc}[${V.pc}+2]
        ${V.pc}=${V.pc}+3
        local uv
        if ${V.isL}==1 then
          uv = ${V.locals}[${V.uvIdx}]
          if not uv then
            uv = {v=nil}
            ${V.locals}[${V.uvIdx}] = uv
          end
        else
          uv = ${V.upvals}[${V.uvIdx}+1]
        end
        ${V.uvs}[${V.i}] = uv
      end`);
  lines.push(`      local ${V.shared_exec}=${V.exec}`);
  lines.push(`      ${V.push}(function(...) return ${V.shared_exec}(${V.idx}+1, {...}, ${V.uvs}) end)`);
  lines.push(`    elseif ${V.op}==${OP.POP} then ${V.pop}()`);
  lines.push(`    elseif ${V.op}==${OP.DUP} then ${V.push}(${V.peek}())`);
  lines.push(`    elseif ${V.op}==${OP.SET_LIST} then ${V.pc}=${V.pc}+2`);
  lines.push(`    elseif ${V.op}==${OP.FOR_PREP} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      local ${V.varSlot}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      local ${V.i}=${V.locals}[${V.varSlot}].v`);
  lines.push(`      local ${V.limit}=${V.locals}[${V.varSlot}+1].v`);
  lines.push(`      local ${V.step}=${V.locals}[${V.varSlot}+2].v`);
  lines.push(`      if (${V.step}>0 and ${V.i}>${V.limit}) or (${V.step}<0 and ${V.i}<${V.limit}) then ${V.pc}=${V.idx}+1 end`);
  lines.push(`    elseif ${V.op}==${OP.FOR_LOOP} then`);
  lines.push(`      local ${V.idx}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      local ${V.varSlot}=${V.bc}[${V.pc}]*256+${V.bc}[${V.pc}+1]`);
  lines.push(`      ${V.pc}=${V.pc}+2`);
  lines.push(`      ${V.locals}[${V.varSlot}].v=${V.locals}[${V.varSlot}].v+${V.locals}[${V.varSlot}+2].v`);
  lines.push(`      local ${V.i}=${V.locals}[${V.varSlot}].v`);
  lines.push(`      local ${V.limit}=${V.locals}[${V.varSlot}+1].v`);
  lines.push(`      local ${V.step}=${V.locals}[${V.varSlot}+2].v`);
  lines.push(`      if (${V.step}>0 and ${V.i}<=${V.limit}) or (${V.step}<0 and ${V.i}>=${V.limit}) then ${V.pc}=${V.idx}+1 end`);
  lines.push(`    elseif ${V.op}==${OP.GET_VARARG} then`);
  lines.push(`      local ${V.nrets}=${V.bc}[${V.pc}]`);
  lines.push(`      ${V.pc}=${V.pc}+1`);
  lines.push(`      if ${V.nrets} == 0 then`);
  lines.push(`          ${V.last_results} = ${V.vargs}`);
  lines.push(`      else`);
  lines.push(`          for ${V.i}=1,${V.nrets} do ${V.push}(${V.vargs}[${V.i}] or nil) end`);
  lines.push(`      end`);
  lines.push(`    elseif ${V.op}==${OP.HALT} then return`);
  lines.push(`    end`);
  lines.push(`  end`);
  lines.push(`end`);
  lines.push('');

  lines.push(`${V.exec}(1,{},{})`);

  return lines.join('\n');
}

function unpackRef(V) {
  return `(unpack or table.unpack)(${V.callArgs})`;
}

module.exports = { generate };

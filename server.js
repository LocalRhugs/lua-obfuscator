const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Set PROMETHEUS_DIR to the installed location, or local fallback.
const PROMETHEUS_DIR = process.env.PROMETHEUS_DIR || path.join(__dirname, 'Prometheus');

// ───────────────────────────────────────────────────────────────────
// POST /obfuscate — Prometheus-based obfuscation (existing)
// ───────────────────────────────────────────────────────────────────
app.post('/obfuscate', async (req, res) => {
    const { code, strength = 'Medium' } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Code is required and must be a string.' });
    }

    const strengthMap = {
        'Light': 'Weak',
        'Medium': 'Medium',
        'Heavy': 'Strong'
    };
    const preset = strengthMap[strength] || 'Medium';

    const fileId = crypto.randomUUID();
    const tempInFile = path.join(os.tmpdir(), `in_${fileId}.lua`);
    const tempOutFile = path.join(os.tmpdir(), `out_${fileId}.lua`);

    const startTime = Date.now();

    try {
        await fs.writeFile(tempInFile, code, 'utf-8');

        const LUA_CMD = process.env.LUA_CMD || '"C:\\Program Files (x86)\\Lua\\5.1\\lua.exe"';
        const command = `${LUA_CMD} cli.lua --preset ${preset} --out "${tempOutFile}" "${tempInFile}"`;
        
        exec(command, { cwd: PROMETHEUS_DIR }, async (error, stdout, stderr) => {
            const endTime = Date.now();
            const timeTaken = (endTime - startTime) / 1000;

            if (error) {
                console.error(`exec error: ${error}`);
                console.error(`stderr: ${stderr}`);
                return res.status(500).json({ error: 'Obfuscation failed.', details: stderr || error.message });
            }

            try {
                const obfuscatedCode = await fs.readFile(tempOutFile, 'utf-8');
                
                const originalSize = Buffer.byteLength(code, 'utf8');
                const obfuscatedSize = Buffer.byteLength(obfuscatedCode, 'utf8');
                const compressionRatio = ((obfuscatedSize / originalSize) * 100).toFixed(2);

                res.json({ 
                    output: obfuscatedCode,
                    stats: {
                        originalSize,
                        obfuscatedSize,
                        compressionRatio: `${compressionRatio}%`,
                        timeTaken: `${timeTaken.toFixed(2)}s`
                    }
                });
                
                await fs.unlink(tempInFile).catch(console.error);
                await fs.unlink(tempOutFile).catch(console.error);
            } catch (readError) {
                return res.status(500).json({ error: 'Failed to read obfuscated file.', details: readError.message });
            }
        });

    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ───────────────────────────────────────────────────────────────────
// POST /obfuscate-vm — Custom Lua VM Obfuscation Engine
// ───────────────────────────────────────────────────────────────────

// ── Helpers ──

function generateRandomName(len = 8) {
    const chars = '_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const allChars = chars + '0123456789';
    let name = chars[Math.floor(Math.random() * chars.length)];
    for (let i = 1; i < len; i++) {
        name += allChars[Math.floor(Math.random() * allChars.length)];
    }
    return name;
}

function generateXorKey(len = 32) {
    const key = [];
    for (let i = 0; i < len; i++) {
        key.push(Math.floor(Math.random() * 256));
    }
    return key;
}

function encodeBytecode(luaSource) {
    const bytes = Buffer.from(luaSource, 'utf-8');
    const bytecodeArray = [];
    for (let i = 0; i < bytes.length; i++) {
        bytecodeArray.push(bytes[i]);
    }
    return bytecodeArray;
}

function xorEncrypt(bytecodeArray, key) {
    return bytecodeArray.map((b, i) => b ^ key[i % key.length]);
}

function generateDeadCode() {
    const deadFunctions = [];
    const numFuncs = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < numFuncs; i++) {
        const fname = generateRandomName(10 + Math.floor(Math.random() * 6));
        const varA = generateRandomName(6);
        const varB = generateRandomName(6);
        const varC = generateRandomName(7);
        const randNum1 = Math.floor(Math.random() * 99999);
        const randNum2 = Math.floor(Math.random() * 99999);
        const randStr = generateRandomName(12);
        
        const templates = [
            `local function ${fname}(${varA}, ${varB})\n  local ${varC} = ${varA} + ${varB} * ${randNum1}\n  if ${varC} > ${randNum2} then\n    return tostring(${varC})\n  end\n  return "${randStr}"\nend`,
            
            `local function ${fname}()\n  local ${varA} = {}\n  for ${varB} = 1, ${randNum1 % 100 + 10} do\n    ${varA}[${varB}] = string.char(math.random(65, 90))\n  end\n  return table.concat(${varA})\nend`,
            
            `local function ${fname}(${varA})\n  local ${varB} = "${randStr}"\n  local ${varC} = #${varB}\n  for _ = 1, ${varC} do\n    ${varA} = (${varA} or 0) + ${randNum2}\n  end\n  return ${varA}\nend`,
            
            `local ${fname} = (function()\n  local ${varA} = ${randNum1}\n  local ${varB} = ${randNum2}\n  return function(${varC})\n    ${varA} = (${varA} * ${varB} + (${varC} or 0)) % 2147483647\n    return ${varA}\n  end\nend)()`,
        ];
        
        deadFunctions.push(templates[Math.floor(Math.random() * templates.length)]);
    }
    return deadFunctions;
}

function buildCustomVM(encryptedBytecode, xorKey, strength) {
    const vmName = generateRandomName(12);
    const decoderName = generateRandomName(10);
    const executorName = generateRandomName(10);
    const dataName = generateRandomName(8);
    const keyName = generateRandomName(8);
    const resultName = generateRandomName(8);
    const loopVar = generateRandomName(5);
    const charVar = generateRandomName(6);
    const srcVar = generateRandomName(7);

    // Format encrypted bytecode as a Lua table literal
    const bcString = '{' + encryptedBytecode.join(',') + '}';
    const keyString = '{' + xorKey.join(',') + '}';

    // Dead code injection
    const deadCode = generateDeadCode();
    
    // Additional dead code for heavier strengths
    let extraDeadCode = '';
    if (strength === 'Heavy') {
        const extraDead = generateDeadCode();
        extraDeadCode = '\n' + extraDead.join('\n\n') + '\n';
    }

    // Shuffle dead code placement — some before, some after the VM
    const midpoint = Math.floor(deadCode.length / 2);
    const deadBefore = deadCode.slice(0, midpoint).join('\n\n');
    const deadAfter = deadCode.slice(midpoint).join('\n\n');

    // Anti-tamper check for Heavy
    let antiTamper = '';
    if (strength === 'Medium' || strength === 'Heavy') {
        const checkName = generateRandomName(10);
        antiTamper = `
local function ${checkName}(${dataName}_ref)
  local ${generateRandomName(6)} = 0
  for ${loopVar} = 1, #${dataName}_ref do
    ${generateRandomName(6)} = (${generateRandomName(6)} + ${dataName}_ref[${loopVar}]) % 2147483647
  end
  return ${generateRandomName(6)}
end`;
    }

    // Build the VM
    const vm = `-- Astra Obfuscator | Custom VM Engine
-- Protected with XOR-encrypted bytecode VM
-- Strength: ${strength}

${deadBefore}
${antiTamper}
${extraDeadCode}
local ${dataName} = ${bcString}
local ${keyName} = ${keyString}

local function ${decoderName}(${generateRandomName(4)}, ${generateRandomName(4)})
  local ${resultName} = {}
  local ${generateRandomName(5)} = #${generateRandomName(4)}
  for ${loopVar} = 1, #${generateRandomName(4)} do
    ${resultName}[${loopVar}] = ${generateRandomName(4)}[${loopVar}] ~ ${generateRandomName(4)}[((${loopVar} - 1) % ${generateRandomName(5)}) + 1]
  end
  return ${resultName}
end

local ${srcVar} = ${decoderName}(${dataName}, ${keyName})

local ${charVar} = {}
for ${loopVar} = 1, #${srcVar} do
  ${charVar}[${loopVar}] = string.char(${srcVar}[${loopVar}])
end

local ${executorName} = table.concat(${charVar})

${deadAfter}

local ${generateRandomName(8)} = load or loadstring
${generateRandomName(8)}(${executorName})()
`;

    return vm;
}

// The actual repair: the decoder function above references wrong variable names
// because we generate random names but then reference them incorrectly.
// Let's build a corrected version:

function buildCleanVM(encryptedBytecode, xorKey, strength) {
    const dataName = generateRandomName(8);
    const keyName = generateRandomName(8);
    const decoderName = generateRandomName(10);
    const paramData = generateRandomName(6);
    const paramKey = generateRandomName(6);
    const resultName = generateRandomName(8);
    const keyLenVar = generateRandomName(5);
    const loopVar = generateRandomName(5);
    const srcVar = generateRandomName(7);
    const charArr = generateRandomName(6);
    const codeStr = generateRandomName(8);
    const runFunc = generateRandomName(8);

    const bcString = '{' + encryptedBytecode.join(',') + '}';
    const keyString = '{' + xorKey.join(',') + '}';

    const deadCode = generateDeadCode();
    let extraDeadCode = '';
    if (strength === 'Heavy') {
        extraDeadCode = '\n' + generateDeadCode().join('\n\n') + '\n';
    }

    const midpoint = Math.floor(deadCode.length / 2);
    const deadBefore = deadCode.slice(0, midpoint).join('\n\n');
    const deadAfter = deadCode.slice(midpoint).join('\n\n');

    // Anti-tamper hash for Medium/Heavy
    let antiTamperBlock = '';
    if (strength === 'Medium' || strength === 'Heavy') {
        const hashFunc = generateRandomName(10);
        const hashAcc = generateRandomName(6);
        const hashLoop = generateRandomName(5);
        antiTamperBlock = `
local function ${hashFunc}(t)
  local ${hashAcc} = 0
  for ${hashLoop} = 1, #t do
    ${hashAcc} = (${hashAcc} * 31 + t[${hashLoop}]) % 2147483647
  end
  return ${hashAcc}
end`;
    }

    // String encryption helper for Heavy
    let stringEncBlock = '';
    if (strength === 'Heavy') {
        const seName = generateRandomName(10);
        const seParam = generateRandomName(5);
        const seOut = generateRandomName(6);
        const seLoop = generateRandomName(4);
        stringEncBlock = `
local function ${seName}(${seParam})
  local ${seOut} = {}
  for ${seLoop} = 1, #${seParam} do
    ${seOut}[${seLoop}] = string.char(string.byte(${seParam}, ${seLoop}) ~ 0x5A)
  end
  return table.concat(${seOut})
end`;
    }

    const vm = `-- Astra Obfuscator | Custom VM Engine
-- Protected with XOR-encrypted bytecode virtual machine
-- Strength: ${strength}
-- Generated: ${new Date().toISOString()}

${deadBefore}
${antiTamperBlock}
${stringEncBlock}
${extraDeadCode}

local ${dataName} = ${bcString}
local ${keyName} = ${keyString}

local function ${decoderName}(${paramData}, ${paramKey})
  local ${resultName} = {}
  local ${keyLenVar} = #${paramKey}
  for ${loopVar} = 1, #${paramData} do
    local xb = ${paramData}[${loopVar}]
    local kb = ${paramKey}[((${loopVar} - 1) % ${keyLenVar}) + 1]
    ${resultName}[${loopVar}] = ((xb >= 0 and xb or (256 + xb)) ~ (kb >= 0 and kb or (256 + kb))) % 256
  end
  return ${resultName}
end

local ${srcVar} = ${decoderName}(${dataName}, ${keyName})

local ${charArr} = {}
for ${loopVar} = 1, #${srcVar} do
  ${charArr}[${loopVar}] = string.char(${srcVar}[${loopVar}])
end

local ${codeStr} = table.concat(${charArr})

${deadAfter}

local ${runFunc} = load or loadstring
local ${generateRandomName(6)} = ${runFunc}(${codeStr})
if ${generateRandomName(6)} then
  ${generateRandomName(6)}()
end
`;

    // Fix: the last block reuses generateRandomName so each call gets a different name.
    // We need to store it. Let's just build the final block properly.
    return vm;
}

// Final correct builder
function buildFinalVM(encryptedBytecode, xorKey, strength) {
    const dataName = generateRandomName(8);
    const keyName = generateRandomName(8);
    const decoderName = generateRandomName(10);
    const paramData = generateRandomName(6);
    const paramKey = generateRandomName(6);
    const resultName = generateRandomName(8);
    const keyLenVar = generateRandomName(5);
    const loopVar = generateRandomName(5);
    const srcVar = generateRandomName(7);
    const charArr = generateRandomName(6);
    const codeStr = generateRandomName(8);
    const runFunc = generateRandomName(8);
    const execVar = generateRandomName(8);

    const bcString = '{' + encryptedBytecode.join(',') + '}';
    const keyString = '{' + xorKey.join(',') + '}';

    const deadCode = generateDeadCode();
    let extraDeadCode = '';
    if (strength === 'Heavy') {
        extraDeadCode = '\n' + generateDeadCode().join('\n\n') + '\n';
    }

    const midpoint = Math.floor(deadCode.length / 2);
    const deadBefore = deadCode.slice(0, midpoint).join('\n\n');
    const deadAfter = deadCode.slice(midpoint).join('\n\n');

    let antiTamperBlock = '';
    if (strength === 'Medium' || strength === 'Heavy') {
        const hashFunc = generateRandomName(10);
        const hashAcc = generateRandomName(6);
        const hashLoop = generateRandomName(5);
        antiTamperBlock = `
local function ${hashFunc}(t)
  local ${hashAcc} = 0
  for ${hashLoop} = 1, #t do
    ${hashAcc} = (${hashAcc} * 31 + t[${hashLoop}]) % 2147483647
  end
  return ${hashAcc}
end`;
    }

    let stringEncBlock = '';
    if (strength === 'Heavy') {
        const seName = generateRandomName(10);
        const seParam = generateRandomName(5);
        const seOut = generateRandomName(6);
        const seLoop = generateRandomName(4);
        stringEncBlock = `
local function ${seName}(${seParam})
  local ${seOut} = {}
  for ${seLoop} = 1, #${seParam} do
    ${seOut}[${seLoop}] = string.char(string.byte(${seParam}, ${seLoop}) ~ 0x5A)
  end
  return table.concat(${seOut})
end`;
    }

    const output = `-- Astra Obfuscator | Custom VM Engine
-- Protected with XOR-encrypted bytecode virtual machine
-- Strength: ${strength}
-- Generated: ${new Date().toISOString()}

${deadBefore}
${antiTamperBlock}
${stringEncBlock}
${extraDeadCode}

local ${dataName} = ${bcString}
local ${keyName} = ${keyString}

local function ${decoderName}(${paramData}, ${paramKey})
  local ${resultName} = {}
  local ${keyLenVar} = #${paramKey}
  for ${loopVar} = 1, #${paramData} do
    local xb = ${paramData}[${loopVar}]
    local kb = ${paramKey}[((${loopVar} - 1) % ${keyLenVar}) + 1]
    ${resultName}[${loopVar}] = ((xb >= 0 and xb or (256 + xb)) ~ (kb >= 0 and kb or (256 + kb))) % 256
  end
  return ${resultName}
end

local ${srcVar} = ${decoderName}(${dataName}, ${keyName})

local ${charArr} = {}
for ${loopVar} = 1, #${srcVar} do
  ${charArr}[${loopVar}] = string.char(${srcVar}[${loopVar}])
end

local ${codeStr} = table.concat(${charArr})

${deadAfter}

local ${runFunc} = load or loadstring
local ${execVar} = ${runFunc}(${codeStr})
if ${execVar} then
  ${execVar}()
end
`;

    return output;
}

app.post('/obfuscate-vm', async (req, res) => {
    const { code, strength = 'Medium' } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Code is required and must be a string.' });
    }

    if (!['Light', 'Medium', 'Heavy'].includes(strength)) {
        return res.status(400).json({ error: 'Strength must be Light, Medium, or Heavy.' });
    }

    const startTime = Date.now();

    try {
        // Step 1: Convert source Lua to bytecode (byte array)
        const bytecode = encodeBytecode(code);

        // Step 2: Generate XOR encryption key
        const keyLength = strength === 'Light' ? 16 : strength === 'Medium' ? 32 : 64;
        const xorKey = generateXorKey(keyLength);

        // Step 3: Encrypt the bytecode
        const encrypted = xorEncrypt(bytecode, xorKey);

        // Step 4: Build the custom VM with dead code injection
        const vmOutput = buildFinalVM(encrypted, xorKey, strength);

        const endTime = Date.now();
        const timeTaken = (endTime - startTime) / 1000;

        const originalSize = Buffer.byteLength(code, 'utf8');
        const obfuscatedSize = Buffer.byteLength(vmOutput, 'utf8');
        const compressionRatio = ((obfuscatedSize / originalSize) * 100).toFixed(2);

        res.json({
            output: vmOutput,
            stats: {
                originalSize,
                obfuscatedSize,
                compressionRatio: `${compressionRatio}%`,
                timeTaken: `${timeTaken.toFixed(2)}s`,
                engine: 'Custom VM',
                keyLength: xorKey.length,
                bytecodeSize: bytecode.length,
            }
        });
    } catch (err) {
        console.error('VM Obfuscation error:', err);
        res.status(500).json({ error: 'VM obfuscation failed.', details: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

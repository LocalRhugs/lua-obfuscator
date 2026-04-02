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

const PROMETHEUS_DIR = process.env.PROMETHEUS_DIR || path.join(__dirname, 'Prometheus');

// ─── Prometheus Engine ───
app.post('/obfuscate', async (req, res) => {
    const { code, strength = 'Medium' } = req.body;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Code is required and must be a string.' });
    }
    const strengthMap = { 'Light': 'Weak', 'Medium': 'Medium', 'Heavy': 'Strong' };
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
            const timeTaken = (Date.now() - startTime) / 1000;
            if (error) {
                return res.status(500).json({ error: 'Obfuscation failed.', details: stderr || error.message });
            }
            try {
                const obfuscatedCode = await fs.readFile(tempOutFile, 'utf-8');
                const originalSize = Buffer.byteLength(code, 'utf8');
                const obfuscatedSize = Buffer.byteLength(obfuscatedCode, 'utf8');
                res.json({
                    output: obfuscatedCode,
                    stats: {
                        originalSize, obfuscatedSize,
                        compressionRatio: `${((obfuscatedSize / originalSize) * 100).toFixed(2)}%`,
                        timeTaken: `${timeTaken.toFixed(2)}s`
                    }
                });
                await fs.unlink(tempInFile).catch(() => {});
                await fs.unlink(tempOutFile).catch(() => {});
            } catch (readError) {
                return res.status(500).json({ error: 'Failed to read obfuscated file.', details: readError.message });
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// ─── Custom VM Engine (luaparse + Custom VM) ───
const luaparse = require('luaparse');
const { Compiler } = require('./vm-engine/compiler');
const { generate } = require('./vm-engine/generator');

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
        // 1 & 2. Parse source → AST using luaparse
        const ast = luaparse.parse(code);

        // 3. Compile: AST → bytecode with custom instruction set
        const compiler = new Compiler();
        const compiled = compiler.compile(ast);

        // 4. Generate: bytecode → encrypted Lua VM (no load/loadstring, no plaintext)
        const vmOutput = generate(compiled, strength);

        const timeTaken = (Date.now() - startTime) / 1000;
        const originalSize = Buffer.byteLength(code, 'utf8');
        const obfuscatedSize = Buffer.byteLength(vmOutput, 'utf8');

        // Count total bytecode instructions
        let totalOpcodes = 0;
        for (const f of compiled.functions) totalOpcodes += f.code.length;

        res.json({
            output: vmOutput,
            stats: {
                originalSize, obfuscatedSize,
                compressionRatio: `${((obfuscatedSize / originalSize) * 100).toFixed(2)}%`,
                timeTaken: `${timeTaken.toFixed(2)}s`,
                engine: 'Astra VM v3.0 (Hardened)',
                keyLength: strength === 'Light' ? 16 : strength === 'Medium' ? 32 : 64,
                keyFragments: strength === 'Light' ? 2 : strength === 'Medium' ? 3 : 5,
                bytecodeSize: totalOpcodes,
                functionsCompiled: compiled.functions.length,
                security: {
                    multiLayerKey: true,
                    dispatchTable: true,
                    antiTamper: true,
                    lazyDecrypt: true,
                    opcodeShuffling: true,
                    bytecodeChunking: true,
                }
            }
        });
    } catch (err) {
        console.error('VM Obfuscation error:', err);
        res.status(500).json({
            error: 'VM obfuscation failed.',
            details: err.message
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

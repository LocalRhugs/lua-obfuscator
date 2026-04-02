const luaparse = require('luaparse');
const { Compiler } = require('../vm-engine/compiler');
const { generate } = require('../vm-engine/generator');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    const { code, strength = 'Medium' } = req.body;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Code is required and must be a string.' });
    }

    try {
        const startTime = Date.now();
        // Pre-process Luau 'continue' keywords into function calls
        const processedCode = code
            .replace(/\bcontinue\b/g, '__AstraContinue__()')
            .replace(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*|\[["']?[a-zA-Z0-9_]+["']?\])*)\s*(\+|-|\*|\/|%|\^|\.\.)=\s*([^;\n]+?)(?=\s*(?:--|;|\n|$))/g, '$1 = $1 $2 ($3)');
        const ast = luaparse.parse(processedCode);
        const compiler = new Compiler();
        const compiled = compiler.compile(ast);
        const vmOutput = generate(compiled, strength);

        const timeTaken = (Date.now() - startTime) / 1000;
        const originalSize = Buffer.byteLength(code, 'utf8');
        const obfuscatedSize = Buffer.byteLength(vmOutput, 'utf8');

        let totalOpcodes = 0;
        for (const f of compiled.functions) totalOpcodes += f.code.length;

        res.status(200).json({
            output: vmOutput,
            stats: {
                originalSize,
                obfuscatedSize,
                compressionRatio: `${((obfuscatedSize / originalSize) * 100).toFixed(2)}%`,
                timeTaken: `${timeTaken.toFixed(2)}s`,
                engine: 'Astra VM (luaparse) v2.2.7',
                bytecodeSize: totalOpcodes,
                functionsCompiled: compiled.functions.length,
            }
        });
    } catch (err) {
        res.status(500).json({
            error: 'VM obfuscation failed.',
            details: err.message
        });
    }
};

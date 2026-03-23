const { LuaFactory } = require('wasmoon');
const fs = require('fs');
const path = require('path');

// Recursive function to load all Lua files into the VM
async function loadPrometheusModules(lua, baseDir, relativePath = '') {
    const fullPath = path.join(baseDir, relativePath);
    const files = fs.readdirSync(fullPath);

    for (const file of files) {
        const filePath = path.join(fullPath, file);
        const relFilePath = path.join(relativePath, file).replace(/\\/g, '/');
        
        if (fs.statSync(filePath).isDirectory()) {
            await loadPrometheusModules(lua, baseDir, relFilePath);
        } else if (file.endsWith('.lua')) {
            const content = fs.readFileSync(filePath, 'utf8');
            // Mocking the filesystem by putting modules in package.preload
            // This is standard for embedding Lua in apps
            const moduleName = relFilePath.slice(0, -4).replace(/\//g, '.').replace(/^src\./, '');
            await lua.doString(`
                package.preload["${moduleName}"] = function()
                    ${content}
                end
            `);
        }
    }
}

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
        const luaFactory = new LuaFactory();
        const lua = await luaFactory.createEngine();

        // 1. Lua 5.1 Polyfills for Wasmoon (Lua 5.4)
        await lua.doString(`
            -- Polyfills for Prometheus (Lua 5.1 based)
            function getfenv(f) return _G end
            function setfenv(f, env) return f end
            loadstring = load
            table.getn = function(t) return #t end
            table.foreach = function(t, f) for k, v in pairs(t) do f(k, v) end end
            
            -- package.path fallback
            package.path = "./?.lua;" .. package.path
        `);

        // 2. Load Prometheus source code
        const prometheusDir = path.join(process.cwd(), 'Prometheus');
        await loadPrometheusModules(lua, prometheusDir);

        // 3. Prepare the Bridge
        await lua.doString(`
            local Prometheus = require("prometheus")
            
            function run_obfuscation(source, presetName)
                local preset = Prometheus.Presets[presetName] or Prometheus.Presets.Medium
                local pipeline = Prometheus.Pipeline:fromConfig(preset)
                return pipeline:apply(source, "input.lua")
            end
        `);

        // 4. Run it
        const runObfuscate = await lua.global.get('run_obfuscation');
        const output = await runObfuscate(code, strength);

        const timeTaken = (Date.now() - startTime) / 1000;
        const originalSize = Buffer.byteLength(code, 'utf8');
        const obfuscatedSize = Buffer.byteLength(output, 'utf8');

        res.status(200).json({
            output: output,
            stats: {
                originalSize,
                obfuscatedSize,
                compressionRatio: `${((obfuscatedSize / originalSize) * 100).toFixed(2)}%`,
                timeTaken: `${timeTaken.toFixed(2)}s`,
                engine: 'Prometheus (Cloud/Wasmoon Engine)'
            }
        });
    } catch (err) {
        console.error('Prometheus Serverless Error:', err);
        res.status(500).json({
            error: 'Prometheus obfuscation failed.',
            details: err.message
        });
    }
};

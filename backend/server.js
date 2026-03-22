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
app.use(express.json());

// Set PROMETHEUS_DIR to the installed loction, or local fallback.
const PROMETHEUS_DIR = process.env.PROMETHEUS_DIR || path.join(__dirname, 'Prometheus');

app.post('/obfuscate', async (req, res) => {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Code is required and must be a string.' });
    }

    const fileId = crypto.randomUUID();
    const tempInFile = path.join(os.tmpdir(), `in_${fileId}.lua`);
    const tempOutFile = path.join(os.tmpdir(), `out_${fileId}.lua`);

    try {
        await fs.writeFile(tempInFile, code, 'utf-8');

        // Use LUA_CMD environment variable or default to Windows path
        const LUA_CMD = process.env.LUA_CMD || '"C:\\Program Files (x86)\\Lua\\5.1\\lua.exe"';
        const command = `${LUA_CMD} cli.lua --preset Medium --out "${tempOutFile}" "${tempInFile}"`;
        
        exec(command, { cwd: PROMETHEUS_DIR }, async (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                console.error(`stderr: ${stderr}`);
                return res.status(500).json({ error: 'Obfuscation failed.', details: stderr || error.message });
            }

            try {
                const obfuscatedCode = await fs.readFile(tempOutFile, 'utf-8');
                res.json({ output: obfuscatedCode });
                
                // Cleanup files
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

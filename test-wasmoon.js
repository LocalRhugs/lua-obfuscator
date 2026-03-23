const { LuaFactory } = require('wasmoon');
const path = require('path');
const fs = require('fs');

async function test() {
    const luaFactory = new LuaFactory();
    const lua = await luaFactory.createEngine();
    
    // Mount Prometheus directory
    const promDir = path.resolve(__dirname, 'Prometheus');
    const srcDir = path.join(promDir, 'src');
    
    // We need to provide a filesystem to Wasmoon if we want it to work normally.
    // Or we can manually set package.path to Absolute Paths on the HOST FS
    // But Wasmoon runs in a sandbox.
    
    // Alternative: Pre-read all Lua files and put them in a table, then mock require.
    // That's too much work.
    
    // Let's see if we can just do dorigidir? No.
    console.log('Testing Wasmoon...');
    try {
        await lua.doString(`
            print("Lua version: " .. _VERSION)
        `);
        console.log('Wasmoon initialized.');
    } catch (e) {
        console.error('Wasmoon failed:', e);
    }
}

test();

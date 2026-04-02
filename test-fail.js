const fs = require('fs');
const luaparse = require('luaparse');
const {Compiler} = require('./vm-engine/compiler');
const {generate} = require('./vm-engine/generator');

const codeRaw = fs.readFileSync('./fail-script-2.lua', 'utf8');
const code = codeRaw
    .replace(/\bcontinue\b/g, '__AstraContinue__()')
    .replace(/([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*|\[["']?[a-zA-Z0-9_]+["']?\])*)\s*(\+|-|\*|\/|%|\^|\.\.)=\s*([^;\n]+?)(?=\s*(?:--|;|\n|$))/g, '$1 = $1 $2 ($3)');

try {
  // Parse with Lua 5.1/Roblox extensions if possible, luaparse default is 5.1
  const ast = luaparse.parse(code, {
      luaVersion: '5.1',
      extendedIdentifiers: true
  });
  console.log("Parsed successfully.");
  
  const compiler = new Compiler();
  const compiled = compiler.compile(ast);
  console.log("Compiled successfully.");
  
  const output = generate(compiled, 'Medium');
  console.log("Generated successfully. Length: " + output.length);
} catch (e) {
  console.error(e);
}

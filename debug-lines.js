const {Compiler} = require('./vm-engine/compiler');
const {generate} = require('./vm-engine/generator');
const luaparse = require('luaparse');

const code = `local char = localPlayer.Character or localPlayer.CharacterAdded:Wait()
local humanoid = char:WaitForChild("Humanoid")`;

const ast = luaparse.parse(code);
const output = generate(new Compiler().compile(ast), 'Medium');
const lines = output.split('\n');

console.log('=== LINE 255 ===');
console.log(lines[254]);
console.log('=== LINE 375 ===');
console.log(lines[374]);
console.log('=== SURROUNDING LINE 255 ===');
for (let i = 250; i <= 260; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}

const luaparse = require('luaparse');
const {Compiler} = require('./vm-engine/compiler');
const {generate} = require('./vm-engine/generator');

const code = `local function greet(name)
  print("Hello, " .. name)
end
greet("World")
for i = 1, 5 do
  if i > 3 then
    print("Big: " .. tostring(i))
  else
    print("Small: " .. tostring(i))
  end
end`;

try {
  const ast = luaparse.parse(code);
  const compiled = new Compiler().compile(ast);
  const output = generate(compiled, 'Heavy');

  console.log('=== COMPILATION SUCCESS ===');
  console.log('Functions compiled:', compiled.functions.length);
  console.log('Main bytecode size:', compiled.functions[0].code.length, 'bytes');
  console.log('Output size:', output.length, 'chars');
  console.log('Contains load():', output.includes('loadstring') || output.includes('load('));
  console.log('Contains source text "greet":', output.includes('greet'));
  console.log('Contains source text "Hello":', output.includes('Hello'));
  console.log('');
  console.log('First 300 chars of output:');
  console.log(output.substring(0, 300));
} catch (e) {
  console.log('ERROR:', e.message);
  console.log(e.stack);
}

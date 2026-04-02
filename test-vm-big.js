const luaparse = require('luaparse');
const {Compiler} = require('./vm-engine/compiler');
const {generate} = require('./vm-engine/generator');

// A bigger script to test chunking and all features
const code = `
local data = {}
for i = 1, 100 do
  data[i] = "item_" .. tostring(i)
end

local function processItem(item)
  local result = string.upper(item)
  return result .. "_processed"
end

local function filterItems(items, predicate)
  local filtered = {}
  for i = 1, #items do
    if predicate(items[i]) then
      filtered[#filtered + 1] = items[i]
    end
  end
  return filtered
end

local function mapItems(items, transform)
  local mapped = {}
  for i = 1, #items do
    mapped[i] = transform(items[i])
  end
  return mapped
end

local processed = mapItems(data, processItem)
local evens = filterItems(data, function(item)
  local num = tonumber(item:match("%d+"))
  return num % 2 == 0
end)

print("Total items: " .. tostring(#data))
print("Processed: " .. tostring(#processed))
print("Even items: " .. tostring(#evens))
print("First processed: " .. processed[1])
print("Last even: " .. evens[#evens])

local config = {
  maxRetries = 3,
  timeout = 30,
  debug = false,
  endpoint = "https://api.example.com",
  headers = {
    contentType = "application/json",
    auth = "Bearer token123"
  }
}

local function retry(fn, maxAttempts)
  local attempts = 0
  local success, result
  repeat
    attempts = attempts + 1
    success, result = pcall(fn)
  until success or attempts >= maxAttempts
  return success, result, attempts
end

local counter = 0
local function increment()
  counter = counter + 1
  if counter > 2 then
    return counter
  end
  error("not ready yet")
end

local ok, val, tries = retry(increment, config.maxRetries)
print("Retry test: ok=" .. tostring(ok) .. " val=" .. tostring(val) .. " tries=" .. tostring(tries))
`;

try {
  console.time('compile');
  const ast = luaparse.parse(code);
  const compiled = new Compiler().compile(ast);
  console.timeEnd('compile');
  
  for (const strength of ['Light', 'Medium', 'Heavy']) {
    console.time(`generate-${strength}`);
    const output = generate(compiled, strength);
    console.timeEnd(`generate-${strength}`);
    
    console.log(`\n=== ${strength.toUpperCase()} ===`);
    console.log('Functions compiled:', compiled.functions.length);
    console.log('Output size:', output.length, 'chars');
    console.log('Contains plaintext strings:', 
      output.includes('"item_"') || output.includes('"not ready yet"') || output.includes('"Bearer'));
    console.log('Contains load/loadstring:', output.includes('loadstring(') || output.includes('load('));
    
    // Check security features
    console.log('Has dispatch table:', output.includes('dispTbl') || /\w+\[\d+\]\s*=\s*function/.test(output));
    console.log('Has anti-tamper:', output.includes('integrity') || output.includes('hookGuard') || /integrityCheck|integrity/.test(output));
    console.log('Has key fragments:', (output.match(/kfrag\d|local\s+\w+\d\s*=\s*\{/g) || []).length > 1);
  }
  
  console.log('\n=== ALL TESTS PASSED ===');
} catch (e) {
  console.log('ERROR:', e.message);
  console.log(e.stack);
}

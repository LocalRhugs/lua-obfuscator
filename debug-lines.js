const {Compiler} = require('./vm-engine/compiler');
const {generate} = require('./vm-engine/generator');
const luaparse = require('luaparse');

const code = `local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local localPlayer = Players.LocalPlayer

-- Wait for character
local char = localPlayer.Character or localPlayer.CharacterAdded:Wait()
local humanoid = char:WaitForChild("Humanoid")

-- Walkspeed + Jump
humanoid.WalkSpeed = 50
humanoid.JumpPower = 100

-- Reapply on respawn
localPlayer.CharacterAdded:Connect(function(newChar)
    local hum = newChar:WaitForChild("Humanoid")
    hum.WalkSpeed = 50
    hum.JumpPower = 100
end)

-- ESP
local function createESP(player)
    if player == localPlayer then return end
    player.CharacterAdded:Connect(function(newChar)
        local highlight = Instance.new("Highlight")
        highlight.FillColor = Color3.fromRGB(255, 0, 0)
        highlight.FillTransparency = 0.5
        highlight.Parent = newChar
    end)
    if player.Character then
        local highlight = Instance.new("Highlight")
        highlight.FillColor = Color3.fromRGB(255, 0, 0)
        highlight.FillTransparency = 0.5
        highlight.Parent = player.Character
    end
end

for _, player in pairs(Players:GetPlayers()) do
    createESP(player)
end

Players.PlayerAdded:Connect(createESP)

print("Loaded!")
print("WalkSpeed: 50")
print("JumpPower: 100")`;

const ast = luaparse.parse(code);
const output = generate(new Compiler().compile(ast), 'Medium');
const lines = output.split('\n');

console.log('=== SURROUNDING LINE 260 ===');
for (let i = 255; i <= 265; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}
console.log('=== SURROUNDING LINE 380 ===');
for (let i = 375; i <= 385; i++) {
  console.log(`${i}: ${lines[i-1]}`);
}

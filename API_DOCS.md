# Astra Obfuscator API Documentation

The Astra Obfuscator API provides high-performance Lua obfuscation through two specialized engines. No API keys are required.

## Endpoints

### 1. Prometheus Engine API
Advanced property renaming, control flow flattening, and string encryption.

**Endpoint:** `POST /api/prometheus`  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "code": "print('hello world')",
  "strength": "Medium"
}
```
*   `code` (String): The Lua source code to obfuscate.
*   `strength` (String): `Light`, `Medium`, or `Heavy`.

**Response:**
```json
{
  "output": "-- Obfuscated Code...",
  "stats": {
    "originalSize": 20,
    "obfuscatedSize": 1240,
    "timeTaken": "0.45s"
  }
}
```

---

### 2. Astra VM Engine API
Custom Bytecode Virtual Machine protection (v2.2.7). Source code never exists in plaintext.

**Endpoint:** `POST /api/astra-vm`  
**Content-Type:** `application/json`

**Request Body:**
```json
{
  "code": "print('hello world')",
  "strength": "Medium"
}
```

---

## Integration Example (Javascript)

```javascript
fetch('https://your-vercel-domain.com/api/prometheus', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'print(\"Hello from API\")',
    strength: 'Heavy'
  })
})
.then(res => res.json())
.then(data => console.log(data.output));
```

// Astra VM Engine — Lua Lexer
// Tokenizes Lua source code into a stream of tokens

const KEYWORDS = new Set([
  'and','break','do','else','elseif','end','false','for',
  'function','goto','if','in','local','nil','not','or',
  'repeat','return','then','true','until','while'
]);

const TOKEN = {
  NUMBER:'NUMBER', STRING:'STRING', IDENT:'IDENT', KEYWORD:'KEYWORD',
  PLUS:'+', MINUS:'-', STAR:'*', SLASH:'/', PERCENT:'%', CARET:'^',
  HASH:'#', DOTDOT:'..', DOTS:'...', DOT:'.',
  EQ:'==', NEQ:'~=', LT:'<', GT:'>', LE:'<=', GE:'>=', ASSIGN:'=',
  LPAREN:'(', RPAREN:')', LBRACE:'{', RBRACE:'}', LBRACKET:'[', RBRACKET:']',
  COMMA:',', SEMI:';', COLON:':',
  EOF:'EOF'
};

class Token {
  constructor(type, value, line) {
    this.type = type;
    this.value = value;
    this.line = line;
  }
}

class Lexer {
  constructor(source) {
    this.src = source;
    this.pos = 0;
    this.line = 1;
  }

  peek() { return this.pos < this.src.length ? this.src[this.pos] : '\0'; }
  advance() { const c = this.src[this.pos++]; if (c === '\n') this.line++; return c; }
  match(ch) { if (this.peek() === ch) { this.advance(); return true; } return false; }

  skipWhitespaceAndComments() {
    while (this.pos < this.src.length) {
      const c = this.peek();
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
        this.advance();
      } else if (c === '-' && this.pos + 1 < this.src.length && this.src[this.pos + 1] === '-') {
        this.advance(); this.advance();
        if (this.peek() === '[') {
          const saved = this.pos;
          this.advance();
          let eqCount = 0;
          while (this.peek() === '=') { this.advance(); eqCount++; }
          if (this.peek() === '[') {
            this.advance();
            this.skipLongString(eqCount);
            continue;
          }
          this.pos = saved;
        }
        while (this.pos < this.src.length && this.peek() !== '\n') this.advance();
      } else {
        break;
      }
    }
  }

  skipLongString(eqCount) {
    const closing = ']' + '='.repeat(eqCount) + ']';
    while (this.pos < this.src.length) {
      const idx = this.src.indexOf(closing, this.pos);
      if (idx === -1) { this.pos = this.src.length; return ''; }
      const content = this.src.substring(this.pos, idx);
      for (const ch of content) if (ch === '\n') this.line++;
      this.pos = idx + closing.length;
      return content;
    }
    return '';
  }

  readString(quote) {
    let str = '';
    while (this.pos < this.src.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const esc = this.advance();
        const escMap = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"', a: '\x07', b: '\b', f: '\f', v: '\v' };
        if (escMap[esc]) str += escMap[esc];
        else if (esc >= '0' && esc <= '9') {
          let num = esc;
          for (let i = 0; i < 2 && this.peek() >= '0' && this.peek() <= '9'; i++) num += this.advance();
          str += String.fromCharCode(parseInt(num, 10));
        } else str += esc;
      } else {
        str += this.advance();
      }
    }
    if (this.pos < this.src.length) this.advance(); // closing quote
    return str;
  }

  readNumber() {
    let num = '';
    if (this.peek() === '0' && (this.pos + 1 < this.src.length && (this.src[this.pos + 1] === 'x' || this.src[this.pos + 1] === 'X'))) {
      num += this.advance(); num += this.advance();
      while (/[0-9a-fA-F]/.test(this.peek())) num += this.advance();
      return num;
    }
    while (/[0-9]/.test(this.peek())) num += this.advance();
    if (this.peek() === '.' && /[0-9]/.test(this.src[this.pos + 1] || '')) {
      num += this.advance();
      while (/[0-9]/.test(this.peek())) num += this.advance();
    }
    if (this.peek() === 'e' || this.peek() === 'E') {
      num += this.advance();
      if (this.peek() === '+' || this.peek() === '-') num += this.advance();
      while (/[0-9]/.test(this.peek())) num += this.advance();
    }
    return num;
  }

  nextToken() {
    this.skipWhitespaceAndComments();
    if (this.pos >= this.src.length) return new Token(TOKEN.EOF, null, this.line);
    const line = this.line;
    const c = this.peek();

    // Numbers
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(this.src[this.pos + 1] || ''))) {
      return new Token(TOKEN.NUMBER, this.readNumber(), line);
    }

    // Strings
    if (c === '"' || c === "'") { this.advance(); return new Token(TOKEN.STRING, this.readString(c), line); }
    if (c === '[' && (this.src[this.pos + 1] === '[' || this.src[this.pos + 1] === '=')) {
      const saved = this.pos;
      this.advance();
      let eq = 0;
      while (this.peek() === '=') { this.advance(); eq++; }
      if (this.peek() === '[') {
        this.advance();
        return new Token(TOKEN.STRING, this.skipLongString(eq), line);
      }
      this.pos = saved;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(c)) {
      let id = '';
      while (/[a-zA-Z0-9_]/.test(this.peek())) id += this.advance();
      if (id === 'true') return new Token(TOKEN.KEYWORD, 'true', line);
      if (id === 'false') return new Token(TOKEN.KEYWORD, 'false', line);
      if (id === 'nil') return new Token(TOKEN.KEYWORD, 'nil', line);
      if (KEYWORDS.has(id)) return new Token(TOKEN.KEYWORD, id, line);
      return new Token(TOKEN.IDENT, id, line);
    }

    // Operators and punctuation
    this.advance();
    switch (c) {
      case '+': return new Token(TOKEN.PLUS, '+', line);
      case '*': return new Token(TOKEN.STAR, '*', line);
      case '/': return new Token(TOKEN.SLASH, '/', line);
      case '%': return new Token(TOKEN.PERCENT, '%', line);
      case '^': return new Token(TOKEN.CARET, '^', line);
      case '#': return new Token(TOKEN.HASH, '#', line);
      case '(': return new Token(TOKEN.LPAREN, '(', line);
      case ')': return new Token(TOKEN.RPAREN, ')', line);
      case '{': return new Token(TOKEN.LBRACE, '{', line);
      case '}': return new Token(TOKEN.RBRACE, '}', line);
      case ']': return new Token(TOKEN.RBRACKET, ']', line);
      case ',': return new Token(TOKEN.COMMA, ',', line);
      case ';': return new Token(TOKEN.SEMI, ';', line);
      case ':': return new Token(TOKEN.COLON, ':', line);
      case '-': return new Token(TOKEN.MINUS, '-', line);
      case '.':
        if (this.match('.')) {
          if (this.match('.')) return new Token(TOKEN.DOTS, '...', line);
          return new Token(TOKEN.DOTDOT, '..', line);
        }
        return new Token(TOKEN.DOT, '.', line);
      case '<': return this.match('=') ? new Token(TOKEN.LE, '<=', line) : new Token(TOKEN.LT, '<', line);
      case '>': return this.match('=') ? new Token(TOKEN.GE, '>=', line) : new Token(TOKEN.GT, '>', line);
      case '=': return this.match('=') ? new Token(TOKEN.EQ, '==', line) : new Token(TOKEN.ASSIGN, '=', line);
      case '~': if (this.match('=')) return new Token(TOKEN.NEQ, '~=', line);
        throw new Error(`Unexpected character '~' at line ${line}`);
      case '[': return new Token(TOKEN.LBRACKET, '[', line);
      default: throw new Error(`Unexpected character '${c}' at line ${line}`);
    }
  }

  tokenize() {
    const tokens = [];
    while (true) {
      const tok = this.nextToken();
      tokens.push(tok);
      if (tok.type === TOKEN.EOF) break;
    }
    return tokens;
  }
}

module.exports = { Lexer, Token, TOKEN, KEYWORDS };

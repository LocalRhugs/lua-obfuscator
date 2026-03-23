// Astra VM Engine — Lua Parser
// Recursive descent parser: tokens → AST

const { TOKEN } = require('./lexer');

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  cur() { return this.tokens[this.pos]; }
  peek(offset = 0) { return this.tokens[this.pos + offset]; }
  advance() { return this.tokens[this.pos++]; }
  
  expect(type, value) {
    const t = this.cur();
    if (value !== undefined) {
      if (t.type !== type || t.value !== value)
        throw new Error(`Expected '${value}' but got '${t.value || t.type}' at line ${t.line}`);
    } else if (t.type !== type) {
      throw new Error(`Expected ${type} but got ${t.type} at line ${t.line}`);
    }
    return this.advance();
  }

  check(type, value) {
    const t = this.cur();
    if (value !== undefined) return t.type === type && t.value === value;
    return t.type === type;
  }

  match(type, value) {
    if (this.check(type, value)) { this.advance(); return true; }
    return false;
  }

  isBlockEnd() {
    const t = this.cur();
    if (t.type === TOKEN.EOF) return true;
    if (t.type === TOKEN.KEYWORD) {
      return ['end','else','elseif','until'].includes(t.value);
    }
    return false;
  }

  // ── Entry point ──
  parseBlock() {
    const stmts = [];
    while (!this.isBlockEnd()) {
      const s = this.parseStatement();
      if (s) stmts.push(s);
      this.match(TOKEN.SEMI);
    }
    return { type: 'Block', body: stmts };
  }

  parseStatement() {
    const t = this.cur();
    if (t.type === TOKEN.KEYWORD) {
      switch (t.value) {
        case 'local': return this.parseLocal();
        case 'if': return this.parseIf();
        case 'while': return this.parseWhile();
        case 'for': return this.parseFor();
        case 'repeat': return this.parseRepeat();
        case 'function': return this.parseFunctionDecl(false);
        case 'return': return this.parseReturn();
        case 'do': return this.parseDo();
        case 'break': this.advance(); return { type: 'BreakStatement' };
      }
    }
    return this.parseExpressionStatement();
  }

  // ── Local declarations ──
  parseLocal() {
    this.expect(TOKEN.KEYWORD, 'local');
    if (this.check(TOKEN.KEYWORD, 'function')) {
      return this.parseFunctionDecl(true);
    }
    const names = [this.expect(TOKEN.IDENT).value];
    while (this.match(TOKEN.COMMA)) names.push(this.expect(TOKEN.IDENT).value);
    let values = [];
    if (this.match(TOKEN.ASSIGN)) {
      values = this.parseExpressionList();
    }
    return { type: 'LocalStatement', names, values };
  }

  // ── If statement ──
  parseIf() {
    this.expect(TOKEN.KEYWORD, 'if');
    const condition = this.parseExpression();
    this.expect(TOKEN.KEYWORD, 'then');
    const body = this.parseBlock();
    const elseifs = [];
    while (this.match(TOKEN.KEYWORD, 'elseif')) {
      const cond = this.parseExpression();
      this.expect(TOKEN.KEYWORD, 'then');
      const block = this.parseBlock();
      elseifs.push({ condition: cond, body: block });
    }
    let elseBody = null;
    if (this.match(TOKEN.KEYWORD, 'else')) {
      elseBody = this.parseBlock();
    }
    this.expect(TOKEN.KEYWORD, 'end');
    return { type: 'IfStatement', condition, body, elseifs, elseBody };
  }

  // ── While ──
  parseWhile() {
    this.expect(TOKEN.KEYWORD, 'while');
    const condition = this.parseExpression();
    this.expect(TOKEN.KEYWORD, 'do');
    const body = this.parseBlock();
    this.expect(TOKEN.KEYWORD, 'end');
    return { type: 'WhileStatement', condition, body };
  }

  // ── For ──
  parseFor() {
    this.expect(TOKEN.KEYWORD, 'for');
    const firstName = this.expect(TOKEN.IDENT).value;
    if (this.match(TOKEN.ASSIGN)) {
      // Numeric for
      const start = this.parseExpression();
      this.expect(TOKEN.COMMA);
      const stop = this.parseExpression();
      let step = null;
      if (this.match(TOKEN.COMMA)) step = this.parseExpression();
      this.expect(TOKEN.KEYWORD, 'do');
      const body = this.parseBlock();
      this.expect(TOKEN.KEYWORD, 'end');
      return { type: 'NumericFor', name: firstName, start, stop, step, body };
    }
    // Generic for
    const names = [firstName];
    while (this.match(TOKEN.COMMA)) names.push(this.expect(TOKEN.IDENT).value);
    this.expect(TOKEN.KEYWORD, 'in');
    const iterators = this.parseExpressionList();
    this.expect(TOKEN.KEYWORD, 'do');
    const body = this.parseBlock();
    this.expect(TOKEN.KEYWORD, 'end');
    return { type: 'GenericFor', names, iterators, body };
  }

  // ── Repeat/Until ──
  parseRepeat() {
    this.expect(TOKEN.KEYWORD, 'repeat');
    const body = this.parseBlock();
    this.expect(TOKEN.KEYWORD, 'until');
    const condition = this.parseExpression();
    return { type: 'RepeatStatement', body, condition };
  }

  // ── Do block ──
  parseDo() {
    this.expect(TOKEN.KEYWORD, 'do');
    const body = this.parseBlock();
    this.expect(TOKEN.KEYWORD, 'end');
    return { type: 'DoStatement', body };
  }

  // ── Function declaration ──
  parseFunctionDecl(isLocal) {
    this.expect(TOKEN.KEYWORD, 'function');
    let name = null;
    let isMember = false;
    if (!isLocal || this.check(TOKEN.IDENT)) {
      name = this.expect(TOKEN.IDENT).value;
      while (this.match(TOKEN.DOT)) {
        name += '.' + this.expect(TOKEN.IDENT).value;
      }
      if (this.match(TOKEN.COLON)) {
        name += ':' + this.expect(TOKEN.IDENT).value;
        isMember = true;
      }
    }
    this.expect(TOKEN.LPAREN);
    const params = [];
    let hasVarargs = false;
    if (!this.check(TOKEN.RPAREN)) {
      if (this.check(TOKEN.DOTS)) { this.advance(); hasVarargs = true; }
      else {
        params.push(this.expect(TOKEN.IDENT).value);
        while (this.match(TOKEN.COMMA)) {
          if (this.check(TOKEN.DOTS)) { this.advance(); hasVarargs = true; break; }
          params.push(this.expect(TOKEN.IDENT).value);
        }
      }
    }
    this.expect(TOKEN.RPAREN);
    if (isMember) params.unshift('self');
    const body = this.parseBlock();
    this.expect(TOKEN.KEYWORD, 'end');
    return { type: 'FunctionDeclaration', name, params, body, isLocal, hasVarargs };
  }

  // ── Return ──
  parseReturn() {
    this.expect(TOKEN.KEYWORD, 'return');
    let values = [];
    if (!this.isBlockEnd() && !this.check(TOKEN.SEMI)) {
      values = this.parseExpressionList();
    }
    this.match(TOKEN.SEMI);
    return { type: 'ReturnStatement', values };
  }

  // ── Expression statement (call or assignment) ──
  parseExpressionStatement() {
    const expr = this.parseSuffixExpression();
    // Check for assignment
    if (this.check(TOKEN.ASSIGN) || this.check(TOKEN.COMMA)) {
      const targets = [expr];
      while (this.match(TOKEN.COMMA)) targets.push(this.parseSuffixExpression());
      this.expect(TOKEN.ASSIGN);
      const values = this.parseExpressionList();
      return { type: 'AssignmentStatement', targets, values };
    }
    // Otherwise it's a function call expression used as statement
    return { type: 'ExpressionStatement', expression: expr };
  }

  // ── Expression list ──
  parseExpressionList() {
    const exprs = [this.parseExpression()];
    while (this.match(TOKEN.COMMA)) exprs.push(this.parseExpression());
    return exprs;
  }

  // ── Expression (precedence climbing) ──
  parseExpression() { return this.parseOr(); }

  parseOr() {
    let left = this.parseAnd();
    while (this.match(TOKEN.KEYWORD, 'or')) {
      left = { type: 'BinaryExpression', op: 'or', left, right: this.parseAnd() };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseComparison();
    while (this.match(TOKEN.KEYWORD, 'and')) {
      left = { type: 'BinaryExpression', op: 'and', left, right: this.parseComparison() };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseConcat();
    const ops = [TOKEN.LT, TOKEN.GT, TOKEN.LE, TOKEN.GE, TOKEN.EQ, TOKEN.NEQ];
    while (ops.some(op => this.check(op))) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', op, left, right: this.parseConcat() };
    }
    return left;
  }

  parseConcat() {
    let left = this.parseAddSub();
    if (this.check(TOKEN.DOTDOT)) {
      this.advance();
      // Right-associative
      const right = this.parseConcat();
      return { type: 'BinaryExpression', op: '..', left, right };
    }
    return left;
  }

  parseAddSub() {
    let left = this.parseMulDiv();
    while (this.check(TOKEN.PLUS) || this.check(TOKEN.MINUS)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', op, left, right: this.parseMulDiv() };
    }
    return left;
  }

  parseMulDiv() {
    let left = this.parseUnary();
    while (this.check(TOKEN.STAR) || this.check(TOKEN.SLASH) || this.check(TOKEN.PERCENT)) {
      const op = this.advance().value;
      left = { type: 'BinaryExpression', op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.check(TOKEN.MINUS)) {
      this.advance();
      return { type: 'UnaryExpression', op: '-', operand: this.parseUnary() };
    }
    if (this.match(TOKEN.KEYWORD, 'not')) {
      return { type: 'UnaryExpression', op: 'not', operand: this.parseUnary() };
    }
    if (this.check(TOKEN.HASH)) {
      this.advance();
      return { type: 'UnaryExpression', op: '#', operand: this.parseUnary() };
    }
    return this.parsePower();
  }

  parsePower() {
    let base = this.parseSuffixExpression();
    if (this.check(TOKEN.CARET)) {
      this.advance();
      // Right-associative
      const exp = this.parseUnary();
      return { type: 'BinaryExpression', op: '^', left: base, right: exp };
    }
    return base;
  }

  // ── Suffix expression (calls, indexing, member access) ──
  parseSuffixExpression() {
    let expr = this.parsePrimary();
    while (true) {
      if (this.check(TOKEN.DOT)) {
        this.advance();
        const name = this.expect(TOKEN.IDENT).value;
        expr = { type: 'MemberExpression', object: expr, property: name };
      } else if (this.check(TOKEN.LBRACKET)) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TOKEN.RBRACKET);
        expr = { type: 'IndexExpression', object: expr, index };
      } else if (this.check(TOKEN.COLON)) {
        this.advance();
        const method = this.expect(TOKEN.IDENT).value;
        const args = this.parseCallArgs();
        expr = { type: 'MethodCall', object: expr, method, args };
      } else if (this.check(TOKEN.LPAREN) || this.check(TOKEN.LBRACE) || this.check(TOKEN.STRING)) {
        const args = this.parseCallArgs();
        expr = { type: 'FunctionCall', callee: expr, args };
      } else {
        break;
      }
    }
    return expr;
  }

  parseCallArgs() {
    if (this.check(TOKEN.LPAREN)) {
      this.advance();
      const args = [];
      if (!this.check(TOKEN.RPAREN)) {
        args.push(this.parseExpression());
        while (this.match(TOKEN.COMMA)) args.push(this.parseExpression());
      }
      this.expect(TOKEN.RPAREN);
      return args;
    }
    if (this.check(TOKEN.LBRACE)) return [this.parseTableConstructor()];
    if (this.check(TOKEN.STRING)) return [{ type: 'StringLiteral', value: this.advance().value }];
    throw new Error(`Expected function arguments at line ${this.cur().line}`);
  }

  // ── Primary expressions ──
  parsePrimary() {
    const t = this.cur();
    if (t.type === TOKEN.NUMBER) {
      this.advance();
      return { type: 'NumberLiteral', value: Number(t.value) };
    }
    if (t.type === TOKEN.STRING) {
      this.advance();
      return { type: 'StringLiteral', value: t.value };
    }
    if (t.type === TOKEN.KEYWORD && t.value === 'true') {
      this.advance();
      return { type: 'BooleanLiteral', value: true };
    }
    if (t.type === TOKEN.KEYWORD && t.value === 'false') {
      this.advance();
      return { type: 'BooleanLiteral', value: false };
    }
    if (t.type === TOKEN.KEYWORD && t.value === 'nil') {
      this.advance();
      return { type: 'NilLiteral' };
    }
    if (t.type === TOKEN.DOTS) {
      this.advance();
      return { type: 'VarargExpression' };
    }
    if (t.type === TOKEN.IDENT) {
      this.advance();
      return { type: 'Identifier', name: t.value };
    }
    if (t.type === TOKEN.LPAREN) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TOKEN.RPAREN);
      return expr;
    }
    if (t.type === TOKEN.LBRACE) {
      return this.parseTableConstructor();
    }
    if (t.type === TOKEN.KEYWORD && t.value === 'function') {
      this.advance();
      this.expect(TOKEN.LPAREN);
      const params = [];
      let hasVarargs = false;
      if (!this.check(TOKEN.RPAREN)) {
        if (this.check(TOKEN.DOTS)) { this.advance(); hasVarargs = true; }
        else {
          params.push(this.expect(TOKEN.IDENT).value);
          while (this.match(TOKEN.COMMA)) {
            if (this.check(TOKEN.DOTS)) { this.advance(); hasVarargs = true; break; }
            params.push(this.expect(TOKEN.IDENT).value);
          }
        }
      }
      this.expect(TOKEN.RPAREN);
      const body = this.parseBlock();
      this.expect(TOKEN.KEYWORD, 'end');
      return { type: 'FunctionExpression', params, body, hasVarargs };
    }
    throw new Error(`Unexpected token '${t.value || t.type}' at line ${t.line}`);
  }

  // ── Table constructor ──
  parseTableConstructor() {
    this.expect(TOKEN.LBRACE);
    const fields = [];
    while (!this.check(TOKEN.RBRACE)) {
      if (this.check(TOKEN.LBRACKET)) {
        // [expr] = expr
        this.advance();
        const key = this.parseExpression();
        this.expect(TOKEN.RBRACKET);
        this.expect(TOKEN.ASSIGN);
        const value = this.parseExpression();
        fields.push({ type: 'IndexedField', key, value });
      } else if (this.check(TOKEN.IDENT) && this.peek(1) && this.peek(1).type === TOKEN.ASSIGN) {
        const key = this.advance().value;
        this.advance(); // =
        const value = this.parseExpression();
        fields.push({ type: 'NamedField', key, value });
      } else {
        const value = this.parseExpression();
        fields.push({ type: 'ValueField', value });
      }
      if (!this.match(TOKEN.COMMA) && !this.match(TOKEN.SEMI)) break;
    }
    this.expect(TOKEN.RBRACE);
    return { type: 'TableConstructor', fields };
  }
}

module.exports = { Parser };

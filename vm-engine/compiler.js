// Astra VM Engine — Compiler (Fixed with luaparse)
// Compiles luaparse AST -> custom bytecode with a unique instruction set

const OPCODES = {
  LOAD_CONST: 0x01, LOAD_NIL: 0x02, LOAD_TRUE: 0x03, LOAD_FALSE: 0x04,
  GET_LOCAL: 0x05, SET_LOCAL: 0x06, GET_GLOBAL: 0x07, SET_GLOBAL: 0x08,
  GET_TABLE: 0x09, SET_TABLE: 0x0A, NEW_TABLE: 0x0B, SET_LIST: 0x0C,
  ADD: 0x10, SUB: 0x11, MUL: 0x12, DIV: 0x13,
  MOD: 0x14, POW: 0x15, CONCAT: 0x16, UNM: 0x17,
  NOT: 0x18, LEN: 0x19,
  EQ: 0x20, NEQ: 0x21, LT: 0x22, GT: 0x23, LE: 0x24, GE: 0x25,
  JMP: 0x30, JMP_FALSE: 0x31, JMP_TRUE: 0x32,
  CALL: 0x40, RETURN: 0x41, CLOSURE: 0x42,
  POP: 0x50, DUP: 0x51,
  FOR_PREP: 0x60, FOR_LOOP: 0x61,
  HALT: 0xFF,
};

class FunctionPrototype {
  constructor() {
    this.code = [];
    this.constants = [];
    this.constMap = new Map();
    this.numParams = 0;
    this.locals = [];       // [{name, slot, depth}]
    this.scopeDepth = 0;
    this.nextSlot = 0;
    this.breakJumps = [];   // Stack of arrays for nested loops
  }

  emit(op) { this.code.push(op); return this.code.length - 1; }
  emit16(val) { this.code.push((val >> 8) & 0xFF, val & 0xFF); }
  
  emitOp(op) { return this.emit(op); }
  emitOp16(op, val) { const pos = this.emit(op); this.emit16(val); return pos; }
  emitCall(nargs, nrets) { this.emit(OPCODES.CALL); this.emit(nargs); this.emit(nrets); }

  addConstant(value) {
    const key = typeof value === 'string' ? `s:${value}` : `n:${value}`;
    if (this.constMap.has(key)) return this.constMap.get(key);
    const idx = this.constants.length;
    this.constants.push(value);
    this.constMap.set(key, idx);
    return idx;
  }

  currentPos() { return this.code.length; }
  
  patch16(pos, value) {
    this.code[pos + 1] = (value >> 8) & 0xFF;
    this.code[pos + 2] = value & 0xFF;
  }

  addLocal(name) {
    const slot = this.nextSlot++;
    this.locals.push({ name, slot, depth: this.scopeDepth });
    return slot;
  }

  resolveLocal(name) {
    for (let i = this.locals.length - 1; i >= 0; i--) {
      if (this.locals[i].name === name) return this.locals[i].slot;
    }
    return -1;
  }

  pushScope() { this.scopeDepth++; }
  popScope() {
    while (this.locals.length > 0 && this.locals[this.locals.length - 1].depth === this.scopeDepth) {
      this.locals.pop();
    }
    this.scopeDepth--;
  }
}

class Compiler {
  constructor() {
    this.functions = [];
  }

  compile(ast) {
    const mainFunc = new FunctionPrototype();
    this.functions.push(mainFunc);
    this.compileBlock(mainFunc, ast.body || ast);
    mainFunc.emitOp(OPCODES.HALT);
    return { functions: this.functions, opcodes: OPCODES };
  }

  compileBlock(func, block) {
    const body = Array.isArray(block) ? block : (block.body || []);
    for (const stmt of body) {
      this.compileStatement(func, stmt);
    }
  }

  getDecodedValue(node) {
    if (node.type === 'StringLiteral') {
      if (node.value !== null) return node.value;
      if (node.raw) {
        // Strip quotes
        return node.raw.substring(1, node.raw.length - 1)
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, '\\');
      }
    }
    return node.value;
  }

  compileStatement(func, node) {
    switch (node.type) {
      case 'LocalStatement': return this.compileLocal(func, node);
      case 'AssignmentStatement': return this.compileAssignment(func, node);
      case 'IfStatement': return this.compileIf(func, node);
      case 'WhileStatement': return this.compileWhile(func, node);
      case 'ForNumericStatement': return this.compileNumericFor(func, node);
      case 'ForGenericStatement': return this.compileGenericFor(func, node);
      case 'RepeatStatement': return this.compileRepeat(func, node);
      case 'DoStatement':
        func.pushScope();
        this.compileBlock(func, node.body);
        func.popScope();
        return;
      case 'FunctionDeclaration': return this.compileFuncDecl(func, node);
      case 'ReturnStatement': return this.compileReturn(func, node);
      case 'BreakStatement': return this.compileBreak(func, node);
      case 'CallStatement':
        this.compileExpression(func, node.expression, 0);
        return;
    }
  }

  compileLocal(func, node) {
    const vars = node.variables;
    const inits = node.init || [];
    for (let i = 0; i < vars.length; i++) {
      if (i < inits.length) {
        this.compileExpression(func, inits[i]);
      } else {
        func.emitOp(OPCODES.LOAD_NIL);
      }
      const slot = func.addLocal(vars[i].name);
      func.emitOp16(OPCODES.SET_LOCAL, slot);
    }
  }

  compileAssignment(func, node) {
    const vars = node.variables;
    const inits = node.init || [];
    for (let i = 0; i < vars.length; i++) {
      if (i < inits.length) {
        this.compileExpression(func, inits[i]);
      } else {
        func.emitOp(OPCODES.LOAD_NIL);
      }
    }
    for (let i = vars.length - 1; i >= 0; i--) {
      const target = vars[i];
      if (target.type === 'Identifier') {
        const slot = func.resolveLocal(target.name);
        if (slot >= 0) func.emitOp16(OPCODES.SET_LOCAL, slot);
        else func.emitOp16(OPCODES.SET_GLOBAL, func.addConstant(target.name));
      } else if (target.type === 'MemberExpression') {
        const tmpV = func.nextSlot++;
        func.emitOp16(OPCODES.SET_LOCAL, tmpV);
        this.compileExpression(func, target.base);
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(target.identifier.name));
        func.emitOp16(OPCODES.GET_LOCAL, tmpV);
        func.emitOp(OPCODES.SET_TABLE);
      } else if (target.type === 'IndexExpression') {
        const tmpV = func.nextSlot++;
        func.emitOp16(OPCODES.SET_LOCAL, tmpV);
        this.compileExpression(func, target.base);
        this.compileExpression(func, target.index);
        func.emitOp16(OPCODES.GET_LOCAL, tmpV);
        func.emitOp(OPCODES.SET_TABLE);
      }
    }
  }

  compileIf(func, node) {
    const endJumps = [];
    let lastJf = -1;

    for (let i = 0; i < node.clauses.length; i++) {
      const clause = node.clauses[i];
      if (lastJf !== -1) {
        func.patch16(lastJf, func.currentPos());
        lastJf = -1;
      }

      if (clause.condition) {
        this.compileExpression(func, clause.condition);
        lastJf = func.emitOp16(OPCODES.JMP_FALSE, 0);
        func.pushScope();
        this.compileBlock(func, clause.body);
        func.popScope();
        if (i < node.clauses.length - 1) {
          endJumps.push(func.emitOp16(OPCODES.JMP, 0));
        }
      } else {
        func.pushScope();
        this.compileBlock(func, clause.body);
        func.popScope();
      }
    }

    if (lastJf !== -1) func.patch16(lastJf, func.currentPos());
    const endPos = func.currentPos();
    for (const j of endJumps) func.patch16(j, endPos);
  }

  compileWhile(func, node) {
    func.breakJumps.push([]);
    const start = func.currentPos();
    this.compileExpression(func, node.condition);
    const exit = func.emitOp16(OPCODES.JMP_FALSE, 0);
    func.pushScope();
    this.compileBlock(func, node.body);
    func.popScope();
    func.emitOp16(OPCODES.JMP, start);
    func.patch16(exit, func.currentPos());
    const breaks = func.breakJumps.pop();
    for (const b of breaks) func.patch16(b, func.currentPos());
  }

  compileNumericFor(func, node) {
    func.pushScope();
    func.breakJumps.push([]);
    const vSlot = func.addLocal(node.variable.name);
    const lSlot = func.addLocal('(limit)');
    const sSlot = func.addLocal('(step)');

    this.compileExpression(func, node.start);
    func.emitOp16(OPCODES.SET_LOCAL, vSlot);
    this.compileExpression(func, node.end);
    func.emitOp16(OPCODES.SET_LOCAL, lSlot);
    if (node.step) this.compileExpression(func, node.step);
    else func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(1));
    func.emitOp16(OPCODES.SET_LOCAL, sSlot);

    const prep = func.emitOp16(OPCODES.FOR_PREP, 0);
    func.emit16(vSlot);
    const body = func.currentPos();
    func.pushScope();
    this.compileBlock(func, node.body);
    func.popScope();

    const loop = func.emitOp16(OPCODES.FOR_LOOP, 0);
    func.emit16(vSlot);
    func.patch16(loop, body);
    func.patch16(prep, func.currentPos());

    const breaks = func.breakJumps.pop();
    for (const b of breaks) func.patch16(b, func.currentPos());
    func.popScope();
  }

  compileGenericFor(func, node) {
    func.pushScope();
    func.breakJumps.push([]);
    const iSlot = func.addLocal('(iter)');
    const sSlot = func.addLocal('(state)');
    const cSlot = func.addLocal('(control)');
    const vSlots = node.variables.map(v => func.addLocal(v.name));

    for (const ex of node.iterators) this.compileExpression(func, ex);
    // Generic multi-ret handle (simplistic)
    func.emitOp16(OPCODES.SET_LOCAL, cSlot);
    func.emitOp16(OPCODES.SET_LOCAL, sSlot);
    func.emitOp16(OPCODES.SET_LOCAL, iSlot);

    const top = func.currentPos();
    func.emitOp16(OPCODES.GET_LOCAL, iSlot);
    func.emitOp16(OPCODES.GET_LOCAL, sSlot);
    func.emitOp16(OPCODES.GET_LOCAL, cSlot);
    func.emitCall(2, node.variables.length);

    for (let i = node.variables.length - 1; i >= 0; i--) {
      func.emitOp16(OPCODES.SET_LOCAL, vSlots[i]);
    }
    func.emitOp16(OPCODES.GET_LOCAL, vSlots[0]);
    func.emitOp16(OPCODES.SET_LOCAL, cSlot);
    func.emitOp16(OPCODES.GET_LOCAL, cSlot);
    func.emitOp(OPCODES.LOAD_NIL);
    func.emitOp(OPCODES.EQ);
    const exit = func.emitOp16(OPCODES.JMP_TRUE, 0);

    func.pushScope();
    this.compileBlock(func, node.body);
    func.popScope();
    func.emitOp16(OPCODES.JMP, top);
    func.patch16(exit, func.currentPos());

    const breaks = func.breakJumps.pop();
    for (const b of breaks) func.patch16(b, func.currentPos());
    func.popScope();
  }

  compileRepeat(func, node) {
    func.breakJumps.push([]);
    const start = func.currentPos();
    func.pushScope();
    this.compileBlock(func, node.body);
    this.compileExpression(func, node.condition);
    func.popScope();
    func.emitOp16(OPCODES.JMP_FALSE, start);
    const breaks = func.breakJumps.pop();
    for (const b of breaks) func.patch16(b, func.currentPos());
  }

  compileBreak(func) {
    if (func.breakJumps.length === 0) throw new Error('break outside loop');
    const j = func.emitOp16(OPCODES.JMP, 0);
    func.breakJumps[func.breakJumps.length - 1].push(j);
  }

  compileFuncDecl(func, node) {
    const child = new FunctionPrototype();
    child.numParams = node.parameters.length;
    for (const p of node.parameters) {
      if (p.type === 'VarargLiteral') child.addLocal('...');
      else child.addLocal(p.name);
    }
    const idx = this.functions.length;
    this.functions.push(child);
    this.compileBlock(child, node.body);
    child.emitOp(OPCODES.LOAD_NIL);
    child.emit(OPCODES.RETURN);
    child.emit(1);

    func.emitOp16(OPCODES.CLOSURE, idx);
    if (node.isLocal) {
      func.emitOp16(OPCODES.SET_LOCAL, func.addLocal(node.identifier.name));
    } else if (node.identifier) {
      const id = node.identifier;
      if (id.type === 'Identifier') {
        func.emitOp16(OPCODES.SET_GLOBAL, func.addConstant(id.name));
      } else {
        // Nested: a.b.c = closure
        this.emitMemberPathSet(func, id);
      }
    }
  }

  emitMemberPathSet(func, node) {
    const parts = [];
    let curr = node;
    while (curr.type === 'MemberExpression') {
      parts.unshift(curr.identifier.name);
      curr = curr.base;
    }
    parts.unshift(curr.name);

    const slot = func.resolveLocal(parts[0]);
    if (slot >= 0) func.emitOp16(OPCODES.GET_LOCAL, slot);
    else func.emitOp16(OPCODES.GET_GLOBAL, func.addConstant(parts[0]));

    for (let i = 1; i < parts.length - 1; i++) {
      func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(parts[i]));
      func.emitOp(OPCODES.GET_TABLE);
    }

    const tmpT = func.nextSlot++;
    func.emitOp16(OPCODES.SET_LOCAL, tmpT);
    const tmpC = func.nextSlot++;
    func.emitOp16(OPCODES.SET_LOCAL, tmpC);
    
    func.emitOp16(OPCODES.GET_LOCAL, tmpT);
    func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(parts[parts.length - 1]));
    func.emitOp16(OPCODES.GET_LOCAL, tmpC);
    func.emitOp(OPCODES.SET_TABLE);
  }

  compileReturn(func, node) {
    const args = node.arguments || [];
    if (args.length === 0) {
      func.emitOp(OPCODES.LOAD_NIL);
      func.emit(OPCODES.RETURN);
      func.emit(1);
    } else {
      for (const a of args) this.compileExpression(func, a);
      func.emit(OPCODES.RETURN);
      func.emit(args.length);
    }
  }

  compileExpression(func, node, nrets = 1) {
    switch (node.type) {
      case 'NumericLiteral':
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(node.value));
        return;
      case 'StringLiteral':
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(this.getDecodedValue(node)));
        return;
      case 'BooleanLiteral':
        func.emitOp(node.value ? OPCODES.LOAD_TRUE : OPCODES.LOAD_FALSE);
        return;
      case 'NilLiteral':
        func.emitOp(OPCODES.LOAD_NIL);
        return;
      case 'Identifier': {
        const slot = func.resolveLocal(node.name);
        if (slot >= 0) func.emitOp16(OPCODES.GET_LOCAL, slot);
        else func.emitOp16(OPCODES.GET_GLOBAL, func.addConstant(node.name));
        return;
      }
      case 'BinaryExpression': return this.compileBinary(func, node);
      case 'UnaryExpression':
        this.compileExpression(func, node.argument);
        const uOp = node.operator === '-' ? OPCODES.UNM : (node.operator === 'not' ? OPCODES.NOT : OPCODES.LEN);
        func.emitOp(uOp);
        return;
      case 'CallExpression': return this.compileCall(func, node, nrets);
      case 'MemberExpression':
        this.compileExpression(func, node.base);
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(node.identifier.name));
        func.emitOp(OPCODES.GET_TABLE);
        return;
      case 'IndexExpression':
        this.compileExpression(func, node.base);
        this.compileExpression(func, node.index);
        func.emitOp(OPCODES.GET_TABLE);
        return;
      case 'TableConstructorExpression': return this.compileTable(func, node);
      case 'FunctionDeclaration': // Function expression
        const c = new FunctionPrototype();
        c.numParams = node.parameters.length;
        for (const p of node.parameters) c.addLocal(p.type === 'VarargLiteral' ? '...' : p.name);
        const fi = this.functions.length;
        this.functions.push(c);
        this.compileBlock(c, node.body);
        c.emitOp(OPCODES.LOAD_NIL);
        c.emit(OPCODES.RETURN); c.emit(1);
        func.emitOp16(OPCODES.CLOSURE, fi);
        return;
      case 'VarargLiteral':
        const vs = func.resolveLocal('...');
        if (vs >= 0) func.emitOp16(OPCODES.GET_LOCAL, vs);
        else func.emitOp(OPCODES.LOAD_NIL);
        return;
    }
  }

  compileBinary(func, node) {
    if (node.operator === 'and' || node.operator === 'or') {
      this.compileExpression(func, node.left);
      func.emitOp(OPCODES.DUP);
      const j = func.emitOp16(node.operator === 'and' ? OPCODES.JMP_FALSE : OPCODES.JMP_TRUE, 0);
      func.emitOp(OPCODES.POP);
      this.compileExpression(func, node.right);
      func.patch16(j, func.currentPos());
      return;
    }
    this.compileExpression(func, node.left);
    this.compileExpression(func, node.right);
    const om = {'+':0x10, '-':0x11, '*':0x12, '/':0x13, '%':0x14, '^':0x15, '..':0x16, '==':0x20, '~=':0x21, '<':0x22, '>':0x23, '<=':0x24, '>=':0x25};
    if (om[node.operator]) func.emitOp(om[node.operator]);
  }

  compileCall(func, node, nrets) {
    if (node.base.type === 'MemberExpression' && node.base.indexer === ':') {
      this.compileExpression(func, node.base.base);
      func.emitOp(OPCODES.DUP);
      func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(node.base.identifier.name));
      func.emitOp(OPCODES.GET_TABLE);
      const tf = func.nextSlot++, ts = func.nextSlot++;
      func.emitOp16(OPCODES.SET_LOCAL, tf);
      func.emitOp16(OPCODES.SET_LOCAL, ts);
      func.emitOp16(OPCODES.GET_LOCAL, tf);
      func.emitOp16(OPCODES.GET_LOCAL, ts);
      for (const a of node.arguments) this.compileExpression(func, a);
      func.emitCall(node.arguments.length + 1, nrets);
      return;
    }
    this.compileExpression(func, node.base);
    for (const a of node.arguments) this.compileExpression(func, a);
    func.emitCall(node.arguments.length, nrets);
  }

  compileTable(func, node) {
    func.emitOp(OPCODES.NEW_TABLE);
    let li = 1;
    for (const f of node.fields) {
      func.emitOp(OPCODES.DUP);
      if (f.type === 'TableKeyString') {
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(f.key.name));
        this.compileExpression(func, f.value);
      } else if (f.type === 'TableKey') {
        this.compileExpression(func, f.key);
        this.compileExpression(func, f.value);
      } else {
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(li++));
        this.compileExpression(func, f.value);
      }
      func.emitOp(OPCODES.SET_TABLE);
    }
  }
}

module.exports = { Compiler, OPCODES };

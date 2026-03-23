// Astra VM Engine — Compiler
// Compiles AST → custom bytecode with a unique instruction set

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
    this.compileBlock(mainFunc, ast);
    mainFunc.emitOp(OPCODES.HALT);
    return { functions: this.functions, opcodes: OPCODES };
  }

  compileBlock(func, block) {
    for (const stmt of block.body) {
      this.compileStatement(func, stmt);
    }
  }

  compileStatement(func, node) {
    switch (node.type) {
      case 'LocalStatement': return this.compileLocal(func, node);
      case 'AssignmentStatement': return this.compileAssignment(func, node);
      case 'IfStatement': return this.compileIf(func, node);
      case 'WhileStatement': return this.compileWhile(func, node);
      case 'NumericFor': return this.compileNumericFor(func, node);
      case 'GenericFor': return this.compileGenericFor(func, node);
      case 'RepeatStatement': return this.compileRepeat(func, node);
      case 'DoStatement':
        func.pushScope();
        this.compileBlock(func, node.body);
        func.popScope();
        return;
      case 'FunctionDeclaration': return this.compileFuncDecl(func, node);
      case 'ReturnStatement': return this.compileReturn(func, node);
      case 'BreakStatement': return this.compileBreak(func, node);
      case 'ExpressionStatement':
        this.compileExpression(func, node.expression);
        // Discard return value for calls used as statements
        if (node.expression.type === 'FunctionCall' || node.expression.type === 'MethodCall') {
          // Call was already emitted with 0 returns
        } else {
          func.emitOp(OPCODES.POP);
        }
        return;
    }
  }

  compileLocal(func, node) {
    const { names, values } = node;
    for (let i = 0; i < names.length; i++) {
      if (i < values.length) {
        this.compileExpression(func, values[i]);
      } else {
        func.emitOp(OPCODES.LOAD_NIL);
      }
      const slot = func.addLocal(names[i]);
      func.emitOp16(OPCODES.SET_LOCAL, slot);
    }
  }

  compileAssignment(func, node) {
    const { targets, values } = node;
    // Evaluate all values first
    for (let i = 0; i < targets.length; i++) {
      if (i < values.length) {
        this.compileExpression(func, values[i]);
      } else {
        func.emitOp(OPCODES.LOAD_NIL);
      }
    }
    // Assign in reverse order (stack is LIFO)
    for (let i = targets.length - 1; i >= 0; i--) {
      const target = targets[i];
      if (target.type === 'Identifier') {
        const slot = func.resolveLocal(target.name);
        if (slot >= 0) func.emitOp16(OPCODES.SET_LOCAL, slot);
        else func.emitOp16(OPCODES.SET_GLOBAL, func.addConstant(target.name));
      } else if (target.type === 'MemberExpression') {
        // Stack has value. We need table and key below it.
        // Emit: table, key, value -> SET_TABLE
        // We need to compile table and key BEFORE the values, but we already compiled values.
        // Solution: use a temp local
        const tmpSlot = func.nextSlot++;
        func.emitOp16(OPCODES.SET_LOCAL, tmpSlot); // stash value
        this.compileExpression(func, target.object);
        const keyIdx = func.addConstant(target.property);
        func.emitOp16(OPCODES.LOAD_CONST, keyIdx);
        func.emitOp16(OPCODES.GET_LOCAL, tmpSlot); // push value back
        func.emitOp(OPCODES.SET_TABLE);
      } else if (target.type === 'IndexExpression') {
        const tmpSlot = func.nextSlot++;
        func.emitOp16(OPCODES.SET_LOCAL, tmpSlot);
        this.compileExpression(func, target.object);
        this.compileExpression(func, target.index);
        func.emitOp16(OPCODES.GET_LOCAL, tmpSlot);
        func.emitOp(OPCODES.SET_TABLE);
      }
    }
  }

  compileIf(func, node) {
    this.compileExpression(func, node.condition);
    const jumpFalse = func.emitOp16(OPCODES.JMP_FALSE, 0); // placeholder
    
    func.pushScope();
    this.compileBlock(func, node.body);
    func.popScope();

    if (node.elseifs.length === 0 && !node.elseBody) {
      func.patch16(jumpFalse, func.currentPos());
      return;
    }

    const endJumps = [];
    endJumps.push(func.emitOp16(OPCODES.JMP, 0));
    func.patch16(jumpFalse, func.currentPos());

    for (const elif of node.elseifs) {
      this.compileExpression(func, elif.condition);
      const jf = func.emitOp16(OPCODES.JMP_FALSE, 0);
      func.pushScope();
      this.compileBlock(func, elif.body);
      func.popScope();
      endJumps.push(func.emitOp16(OPCODES.JMP, 0));
      func.patch16(jf, func.currentPos());
    }

    if (node.elseBody) {
      func.pushScope();
      this.compileBlock(func, node.elseBody);
      func.popScope();
    }

    const endPos = func.currentPos();
    for (const j of endJumps) func.patch16(j, endPos);
  }

  compileWhile(func, node) {
    func.breakJumps.push([]);
    const loopStart = func.currentPos();
    this.compileExpression(func, node.condition);
    const exitJump = func.emitOp16(OPCODES.JMP_FALSE, 0);
    
    func.pushScope();
    this.compileBlock(func, node.body);
    func.popScope();

    func.emitOp16(OPCODES.JMP, loopStart);
    func.patch16(exitJump, func.currentPos());

    const breaks = func.breakJumps.pop();
    for (const b of breaks) func.patch16(b, func.currentPos());
  }

  compileNumericFor(func, node) {
    func.pushScope();
    func.breakJumps.push([]);

    // Allocate 3 consecutive slots: loop var, limit, step
    const varSlot = func.addLocal(node.name);
    const limitSlot = func.addLocal('(limit)');
    const stepSlot = func.addLocal('(step)');

    // Initialize
    this.compileExpression(func, node.start);
    func.emitOp16(OPCODES.SET_LOCAL, varSlot);
    this.compileExpression(func, node.stop);
    func.emitOp16(OPCODES.SET_LOCAL, limitSlot);
    if (node.step) {
      this.compileExpression(func, node.step);
    } else {
      func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(1));
    }
    func.emitOp16(OPCODES.SET_LOCAL, stepSlot);

    const prepJump = func.emitOp16(OPCODES.FOR_PREP, 0); // base slot encoded in FOR_PREP
    func.emit16(varSlot); // additional operand: base slot

    const bodyStart = func.currentPos();
    func.pushScope();
    this.compileBlock(func, node.body);
    func.popScope();

    const loopInstr = func.emitOp16(OPCODES.FOR_LOOP, 0);
    func.emit16(varSlot);
    func.patch16(loopInstr, bodyStart);

    func.patch16(prepJump, func.currentPos());

    const breaks = func.breakJumps.pop();
    for (const b of breaks) func.patch16(b, func.currentPos());
    func.popScope();
  }

  compileGenericFor(func, node) {
    func.pushScope();
    func.breakJumps.push([]);

    // Allocate hidden locals for iterator state
    const iterSlot = func.addLocal('(iter)');
    const stateSlot = func.addLocal('(state)');
    const controlSlot = func.addLocal('(control)');
    
    // Allocate loop variables
    const varSlots = node.names.map(n => func.addLocal(n));

    // Evaluate iterator expression (e.g., pairs(t) returns iter, state, init)
    for (const expr of node.iterators) {
      this.compileExpression(func, expr);
    }
    // If iterators is a function call, it should return 3 values
    // For simplicity, we handle the common case: one call returning 3 values
    if (node.iterators.length === 1 && 
        (node.iterators[0].type === 'FunctionCall' || node.iterators[0].type === 'MethodCall')) {
      // Call was already compiled. We need to re-compile with 3 returns
      // Remove the call we just emitted and redo it
      // Actually, let's just compile the call with 3 returns here
      // We pop what we just pushed and redo
      func.emitOp(OPCODES.POP);
      this.compileCallExpression(func, node.iterators[0], 3);
    }
    func.emitOp16(OPCODES.SET_LOCAL, controlSlot);
    func.emitOp16(OPCODES.SET_LOCAL, stateSlot);
    func.emitOp16(OPCODES.SET_LOCAL, iterSlot);

    const loopTop = func.currentPos();
    
    // Call iterator: iter(state, control)
    func.emitOp16(OPCODES.GET_LOCAL, iterSlot);
    func.emitOp16(OPCODES.GET_LOCAL, stateSlot);
    func.emitOp16(OPCODES.GET_LOCAL, controlSlot);
    func.emitCall(2, node.names.length);

    // Set loop variables (in reverse since stack is LIFO)
    for (let i = node.names.length - 1; i >= 0; i--) {
      func.emitOp16(OPCODES.SET_LOCAL, varSlots[i]);
    }

    // Update control variable
    func.emitOp16(OPCODES.GET_LOCAL, varSlots[0]);
    func.emitOp16(OPCODES.SET_LOCAL, controlSlot);

    // Check if control var is nil → exit
    func.emitOp16(OPCODES.GET_LOCAL, controlSlot);
    func.emitOp(OPCODES.LOAD_NIL);
    func.emitOp(OPCODES.EQ);
    const exitJump = func.emitOp16(OPCODES.JMP_TRUE, 0);

    // Body
    func.pushScope();
    this.compileBlock(func, node.body);
    func.popScope();

    func.emitOp16(OPCODES.JMP, loopTop);
    func.patch16(exitJump, func.currentPos());

    const breaks = func.breakJumps.pop();
    for (const b of breaks) func.patch16(b, func.currentPos());
    func.popScope();
  }

  compileRepeat(func, node) {
    func.breakJumps.push([]);
    const loopStart = func.currentPos();
    
    func.pushScope();
    this.compileBlock(func, node.body);
    this.compileExpression(func, node.condition);
    func.popScope();
    
    func.emitOp16(OPCODES.JMP_FALSE, loopStart);

    const breaks = func.breakJumps.pop();
    for (const b of breaks) func.patch16(b, func.currentPos());
  }

  compileBreak(func) {
    if (func.breakJumps.length === 0) throw new Error('break outside loop');
    const j = func.emitOp16(OPCODES.JMP, 0);
    func.breakJumps[func.breakJumps.length - 1].push(j);
  }

  compileFuncDecl(func, node) {
    const childFunc = new FunctionPrototype();
    childFunc.numParams = node.params.length;
    for (const p of node.params) childFunc.addLocal(p);
    const funcIdx = this.functions.length;
    this.functions.push(childFunc);
    this.compileBlock(childFunc, node.body);
    // Implicit return nil
    childFunc.emitOp(OPCODES.LOAD_NIL);
    childFunc.emit(OPCODES.RETURN);
    childFunc.emit(1);

    // In the parent, create a closure and assign it
    func.emitOp16(OPCODES.CLOSURE, funcIdx);

    if (node.isLocal) {
      const slot = func.addLocal(node.name);
      func.emitOp16(OPCODES.SET_LOCAL, slot);
    } else if (node.name) {
      if (node.name.includes('.') || node.name.includes(':')) {
        // Method or nested: a.b.c = func → compile as table set
        const parts = node.name.split(/[.:]/);
        const slot = func.resolveLocal(parts[0]);
        if (slot >= 0) func.emitOp16(OPCODES.GET_LOCAL, slot);
        else func.emitOp16(OPCODES.GET_GLOBAL, func.addConstant(parts[0]));
        for (let i = 1; i < parts.length - 1; i++) {
          func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(parts[i]));
          func.emitOp(OPCODES.GET_TABLE);
        }
        // Swap: table is below closure on stack. Use temp.
        const tmp = func.nextSlot++;
        func.emitOp16(OPCODES.SET_LOCAL, tmp); // stash closure
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(parts[parts.length - 1])); 
        func.emitOp16(OPCODES.GET_LOCAL, tmp); // push closure
        func.emitOp(OPCODES.SET_TABLE);
      } else {
        func.emitOp16(OPCODES.SET_GLOBAL, func.addConstant(node.name));
      }
    }
  }

  compileReturn(func, node) {
    if (node.values.length === 0) {
      func.emitOp(OPCODES.LOAD_NIL);
      func.emit(OPCODES.RETURN);
      func.emit(1);
    } else {
      for (const v of node.values) this.compileExpression(func, v);
      func.emit(OPCODES.RETURN);
      func.emit(node.values.length);
    }
  }

  // ── Expressions ──
  compileExpression(func, node) {
    switch (node.type) {
      case 'NumberLiteral':
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(node.value));
        return;
      case 'StringLiteral':
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(node.value));
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
      case 'BinaryExpression':
        return this.compileBinary(func, node);
      case 'UnaryExpression':
        this.compileExpression(func, node.operand);
        if (node.op === '-') func.emitOp(OPCODES.UNM);
        else if (node.op === 'not') func.emitOp(OPCODES.NOT);
        else if (node.op === '#') func.emitOp(OPCODES.LEN);
        return;
      case 'FunctionCall':
        return this.compileCallExpression(func, node, 1);
      case 'MethodCall':
        return this.compileCallExpression(func, node, 1);
      case 'MemberExpression':
        this.compileExpression(func, node.object);
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(node.property));
        func.emitOp(OPCODES.GET_TABLE);
        return;
      case 'IndexExpression':
        this.compileExpression(func, node.object);
        this.compileExpression(func, node.index);
        func.emitOp(OPCODES.GET_TABLE);
        return;
      case 'TableConstructor':
        return this.compileTable(func, node);
      case 'FunctionExpression': {
        const childFunc = new FunctionPrototype();
        childFunc.numParams = node.params.length;
        for (const p of node.params) childFunc.addLocal(p);
        const fi = this.functions.length;
        this.functions.push(childFunc);
        this.compileBlock(childFunc, node.body);
        childFunc.emitOp(OPCODES.LOAD_NIL);
        childFunc.emit(OPCODES.RETURN);
        childFunc.emit(1);
        func.emitOp16(OPCODES.CLOSURE, fi);
        return;
      }
      case 'VarargExpression':
        func.emitOp16(OPCODES.GET_LOCAL, func.addConstant('...')); // simplified
        return;
    }
  }

  compileBinary(func, node) {
    // Short-circuit for 'and' and 'or'
    if (node.op === 'and') {
      this.compileExpression(func, node.left);
      func.emitOp(OPCODES.DUP);
      const jump = func.emitOp16(OPCODES.JMP_FALSE, 0);
      func.emitOp(OPCODES.POP);
      this.compileExpression(func, node.right);
      func.patch16(jump, func.currentPos());
      return;
    }
    if (node.op === 'or') {
      this.compileExpression(func, node.left);
      func.emitOp(OPCODES.DUP);
      const jump = func.emitOp16(OPCODES.JMP_TRUE, 0);
      func.emitOp(OPCODES.POP);
      this.compileExpression(func, node.right);
      func.patch16(jump, func.currentPos());
      return;
    }

    this.compileExpression(func, node.left);
    this.compileExpression(func, node.right);

    const opMap = {
      '+': OPCODES.ADD, '-': OPCODES.SUB, '*': OPCODES.MUL,
      '/': OPCODES.DIV, '%': OPCODES.MOD, '^': OPCODES.POW,
      '..': OPCODES.CONCAT,
      '==': OPCODES.EQ, '~=': OPCODES.NEQ,
      '<': OPCODES.LT, '>': OPCODES.GT, '<=': OPCODES.LE, '>=': OPCODES.GE,
    };
    if (opMap[node.op]) func.emitOp(opMap[node.op]);
  }

  compileCallExpression(func, node, nrets) {
    if (node.type === 'MethodCall') {
      this.compileExpression(func, node.object);
      func.emitOp(OPCODES.DUP); // duplicate for self
      func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(node.method));
      func.emitOp(OPCODES.GET_TABLE);
      // Swap self and function: we need func, self, args on stack
      // Stack is: ..., object, func. We need: ..., func, object
      // Use a temp
      const tmp = func.nextSlot++;
      func.emitOp16(OPCODES.SET_LOCAL, tmp); // stash func
      // Stack now: ..., object
      // We need to push func below object... this is tricky with a pure stack machine
      // Alternative: just push self again after func
      // Let's reorganize: compile object, get method, then push self
      // Actually let me redo this completely for method calls:
      
      // Reset what we did — this approach is cleaner:
      // We won't use the above. Let me pop everything and redo.
      // Actually the code is already emitted. Let me use the temp approach.
      // Stack: obj, func (func is in tmp)
      // We need: func, obj, arg1, arg2, ...
      // obj is on stack, func is in tmp
      const tmp2 = func.nextSlot++;
      func.emitOp16(OPCODES.SET_LOCAL, tmp2); // stash object
      func.emitOp16(OPCODES.GET_LOCAL, tmp);  // push func
      func.emitOp16(OPCODES.GET_LOCAL, tmp2); // push self (object)
      
      for (const arg of node.args) this.compileExpression(func, arg);
      func.emitCall(node.args.length + 1, nrets); // +1 for self
      return;
    }

    // Regular function call
    // Check if this is an expression statement (nrets=0 for statement context)
    this.compileExpression(func, node.callee);
    for (const arg of node.args) this.compileExpression(func, arg);
    func.emitCall(node.args.length, nrets);
  }

  compileTable(func, node) {
    func.emitOp(OPCODES.NEW_TABLE);
    let listIndex = 1;
    for (const field of node.fields) {
      func.emitOp(OPCODES.DUP); // dup table ref
      if (field.type === 'NamedField') {
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(field.key));
        this.compileExpression(func, field.value);
        func.emitOp(OPCODES.SET_TABLE);
      } else if (field.type === 'IndexedField') {
        this.compileExpression(func, field.key);
        this.compileExpression(func, field.value);
        func.emitOp(OPCODES.SET_TABLE);
      } else { // ValueField — sequential integer keys
        func.emitOp16(OPCODES.LOAD_CONST, func.addConstant(listIndex++));
        this.compileExpression(func, field.value);
        func.emitOp(OPCODES.SET_TABLE);
      }
    }
  }
}

module.exports = { Compiler, OPCODES };

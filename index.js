// ----PARSER----

function skipSpace(string) {
  let skippable = string.match(/^(\s|#.*)*/);
  return string.slice(skippable[0].length);
}

function parseExpression(program) {
  program = skipSpace(program);
  let match, expr;

  if (match = /^"([^"]*)"/.exec(program)) {
    expr = {type: "value", value: match[1]};
  } 
  else if (match = /^\d+\b/.exec(program)) {
    expr = {type: "value", value: Number(match[0])};
  } 
  else if (match = /^[^\s(),#"]+/.exec(program)) {
    expr = {type: "word", name: match[0]};
  } 
  else {
    throw new SyntaxError("Unexpected syntax");
  }

  return parseApply(expr, program.slice(match[0].length));
}

function parseApply(expr, program) {
  program = skipSpace(program);

  if (program[0] !== "(") {
    return {expr, rest: program};
  }

  program = skipSpace(program.slice(1));
  expr = {type: "apply", operator: expr, args: []};

  while (program[0] !== ")") {
    let arg = parseExpression(program);
    expr.args.push(arg.expr);
    program = skipSpace(arg.rest);

    if (program[0] === ",") {
      program = skipSpace(program.slice(1));
    } 
    else if (program[0] !== ")") {
      throw new SyntaxError("Expected ',' or ')'");
    }
  }

  return parseApply(expr, program.slice(1));
}

function parse(program) {
  let {expr, rest} = parseExpression(program);
  if (skipSpace(rest).length > 0) {
    throw new SyntaxError("Unexpected text after program");
  }
  return expr;
}

// ----EVALUATOR----

const specialForms = Object.create(null);

function evaluate(expr, scope) {
  if (expr.type === "value") return expr.value;

  if (expr.type === "word") {
    if (expr.name in scope) return scope[expr.name];
    throw new ReferenceError(`Undefined binding: ${expr.name}`);
  }

  if (expr.type === "apply") {
    let {operator, args} = expr;

    if (operator.type === "word" && operator.name in specialForms) {
      return specialForms[operator.name](args, scope);
    }

    let op = evaluate(operator, scope);
    if (typeof op !== "function") {
      throw new TypeError("Applying a non-function");
    }

    return op(...args.map(arg => evaluate(arg, scope)));
  }
}

// ----SPECIAL FORMS----

specialForms.if = (args, scope) => {
  if (evaluate(args[0], scope) !== false)
    return evaluate(args[1], scope);
  else
    return evaluate(args[2], scope);
};

specialForms.while = (args, scope) => {
  while (evaluate(args[0], scope) !== false) {
    evaluate(args[1], scope);
  }
  return false;
};

specialForms.do = (args, scope) => {
  let value = false;
  for (let arg of args) {
    value = evaluate(arg, scope);
  }
  return value;
};

specialForms.define = (args, scope) => {
  let value = evaluate(args[1], scope);
  scope[args[0].name] = value;
  return value;
};

specialForms.fun = (args, scope) => {
  let body = args[args.length - 1];
  let params = args.slice(0, -1).map(e => e.name);

  return function(...values) {
    let localScope = Object.create(scope);
    for (let i = 0; i < values.length; i++) {
      localScope[params[i]] = values[i];
    }
    return evaluate(body, localScope);
  };
};

specialForms.set = (args, scope) => {
  let name = args[0].name;
  let value = evaluate(args[1], scope);

  for (let s = scope; s; s = Object.getPrototypeOf(s)) {
    if (Object.prototype.hasOwnProperty.call(s, name)) {
      s[name] = value;
      return value;
    }
  }

  throw new ReferenceError(`Setting undefined variable ${name}`);
};

// ----GLOBAL SCOPE----

const globalScope = Object.create(null);

globalScope.true = true;
globalScope.false = false;

["+","-","*","/","==","<",">"].forEach(op => {
  globalScope[op] = Function("a,b", `return a ${op} b;`);
});

globalScope.print = value => {
  console.log("Output:", value);
  return value;
};

// ---Arrays----

globalScope.array = (...values) => values;
globalScope.length = array => array.length;
globalScope.element = (array, i) => array[i];

// ----RUNNER----

function runEgg(program) {
  return evaluate(parse(program), Object.create(globalScope));
}

// ----USER INPUT----

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("Egg+ Interpreter Ready");

rl.question("Enter Egg code: ", code => {
  try {
    runEgg(code);
  } catch (e) {
    console.log("Error:", e.message);
  }
  rl.close();
});

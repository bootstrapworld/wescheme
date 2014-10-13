var repl_input;
var output_list;
var repl_input_li;
var __nenv;
var __venv;
var __history_front;
var __history_back;

function formatOutput(x) {
  var res = [];

  for(var i = 0; i < x.length; i++) {
    res[i] = plt.compiler.sexpToString(x[i]);
  }
  return res;
}

function repl2_setup(__nenv, __venv) {
  repl_input = document.getElementById("repl-input");
  repl_input_li = document.getElementById("repl-input-li");
  output_list = document.getElementById("output-list");
  __history_front = [];
  __history_back = [];
}

// returns the element in the history at the current index.
// Dir is the direction. 1 for up, -1 for down
// current is the currently viewed element
function popElementFromHistory(dir, current) {
  if(dir === 1 && __history_front.length > 0){
    __history_back.push(current);
    return __history_front.pop();
  } else if(dir === -1 && __history_back.length > 0) {
    __history_front.push(current);
    return __history_back.pop();
  }
  return current;
}

function getError(e){
  try{
    var err =  JSON.parse(e),
        structuredErr = JSON.parse(err['structured-error']);
    return structuredErr.message;
  } catch (JSONerror){
    console.log('!!!!!!!!!!!! FATAL ERROR !!!!!!!!!!!!!!!');
    throw(e);
  }
}

function readFromRepl(event) {
  var key = event.keyCode;

  if(key === 13) { // "\n"
    var aSource = repl_input.value;
    var progres;
    // run the local compiler
    var debug = true;
    var sexp      = plt.compiler.lex(aSource, undefined, debug);
    var AST       = plt.compiler.parse(sexp, debug);
//    var pyret     = plt.compiler.toPyretString(AST, debug);
//    console.log(pyret.join("\n"));
    var ASTandPinfo = plt.compiler.desugar(AST, undefined, debug);
        program     = ASTandPinfo[0],
        pinfo       = ASTandPinfo[1];
    var pinfo       = plt.compiler.analyze(program, debug);
    var response    = plt.compiler.compile(program, pinfo, debug);
    console.log((0,eval)('(' + response.bytecode + ')'));
 
    repl_input.value = ""; // clear the input
    var temp = document.createElement("li"); // make an li element
    temp.textContent = aSource; // stick the program's text in there

  } else if(key === 38) {
    repl_input.value = popElementFromHistory(1, repl_input.value);
    return false;
  } else if (key === 40) {
    repl_input.value = popElementFromHistory(-1, repl_input.value);
    return false;
  } else {
    return true;
  }
}
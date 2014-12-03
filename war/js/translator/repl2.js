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

// pyretAST contains the actual AST node from the Pyret parser
var pyretAST;
function pyretCheck(racketAST){
    // Source2Source translate and transpile into Pyret
    var pyretSrc  = plt.compiler.toPyretString(racketAST);
    console.log('TRANSLATED PYRET SOURCE:\n'+pyretSrc);
    var transpiledAST = plt.compiler.toPyretAST(racketAST),
        transpiledAST_str = JSON.stringify(transpiledAST, null, 2);
    var url="http://localhost:3000/"+encodeURI(pyretSrc[0]);
    var request = new XMLHttpRequest();
    request.onloadend=function(){
      console.log(this.responseText);
      var pyretAST = JSON.parse(this.responseText),
          pyretAST_str = JSON.stringify(pyretAST, null, 2);
      
      console.log('Translated Pyret AST is ');
      console.log(pyretAST);
      console.log('Transpiled Pyret AST ');
      console.log(transpiledAST);
      if(sameResults(pyretAST, transpiledAST)){
        console.log('MATCH!');
      }
    };
    request.open("GET", url);
    request.send();
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
    var ASTandPinfo = plt.compiler.desugar(AST, undefined, debug);
        program     = ASTandPinfo[0],
        pinfo       = ASTandPinfo[1];
    var pinfo       = plt.compiler.analyze(program, debug);
    var response    = plt.compiler.compile(program, pinfo, debug);
    response.bytecode = (0,eval)('(' + response.bytecode + ')');
    console.log(response);
//    pyretCheck(AST);
    console.log(plt.compiler.toPyretAST(AST));
 
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
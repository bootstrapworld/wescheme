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

// adds an element to the history
function addToHistory(val) {
  while(__history_back.length > 0) {
    var temp = __history_back.pop();

    if(temp != "")
      __history_front.push(temp);
  }
  __history_front.push(val);
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
    try {
      console.log("// LEXING: ///////////////////////////////////\nraw:");
      var start = new Date().getTime(),
          sexp = plt.compiler.lex(aSource),
          end = new Date().getTime(),
          lexTime = Math.floor(end-start);
      console.log(sexp);
      console.log("Lexed in "+lexTime+"ms. Lexed as:\n"+plt.compiler.sexpToString(sexp));
    } catch (e) {
      if(e instanceof unimplementedException){throw e.str + " NOT IMPLEMENTED";}
      console.log(e);
      console.log(getError(e));
      throw Error("LEXING ERROR\n"+getError(e).toString());
    }
    try {
      console.log("// PARSING: //////////////////////////////////\nraw:");
      var start = new Date().getTime(),
          AST = plt.compiler.parse(sexp);
          end = new Date().getTime(),
          parseTime = Math.floor(end-start);
      console.log(AST);
      console.log("Parsed in "+parseTime+"ms. Parsed as:\n"+AST.join("\n"));
    } catch (e) {
      if(e instanceof unimplementedException){throw e.str + " NOT IMPLEMENTED";}
      console.log(getError(e));
      throw Error("PARSING ERROR\n"+getError(e).toString());
    }
    try {
      console.log("// DESUGARING: //////////////////////////////\nraw");
      var start = new Date().getTime(),
          ASTandPinfo = plt.compiler.desugar(AST),
          program = ASTandPinfo[0],
          pinfo = ASTandPinfo[1],
          end = new Date().getTime(),
          desugarTime = Math.floor(end-start);
      console.log(program);
      console.log("Desugared in "+desugarTime+"ms. Desugared to:\n"+program.join("\n"));
      console.log("pinfo:");
      console.log(pinfo);
    } catch (e) {
      console.log(e);
      if(e instanceof unimplementedException){ throw e.str + " NOT IMPLEMENTED";}
      console.log(getError(e));
      throw Error("DESUGARING ERROR\n"+getError(e).toString());
    }
    try {
      console.log("// ANALYSIS: //////////////////////////////\n");
      var start = new Date().getTime();
      window.pinfo = plt.compiler.analyze(program);
      var end = new Date().getTime(),
      analysisTime = Math.floor(end-start);
      console.log("Analyzed in "+analysisTime+"ms. pinfo bound to window.pinfo");
    } catch (e) {
      if(e instanceof unimplementedException){throw e.str + " NOT IMPLEMENTED";}
      throw Error("ANALYSIS ERROR\n"+getError(e).toString());
    }
    try {
      console.log("// COMPILATION: //////////////////////////////\n");
      var start = new Date().getTime();
      window.pinfo = plt.compiler.compile(program, pinfo);
      var end = new Date().getTime(),
      compileTime = Math.floor(end-start);
      console.log("Compiled in "+compileTime+"ms");
    } catch (e) {
      if(e instanceof unimplementedException){throw e.str + " NOT IMPLEMENTED";}
      throw Error("COMPILATION ERROR\n"+getError(e).toString());
    }
    console.log("// SUMMARY: /////////////////////////////////\n"
                + "Lexing:     " + lexTime    + "ms\nParsing:    " + parseTime + "ms\n"
                + "Desugaring: " + desugarTime + "ms\nAnalysis:   " + analysisTime + "ms\n"
                + "TOTAL:      " + (lexTime+parseTime+desugarTime+analysisTime)+"ms");
    
    
    repl_input.value = ""; // clear the input
    var temp = document.createElement("li"); // make an li element
    temp.textContent = aSource; // stick the program's text in there
    output_list.insertBefore(temp, repl_input_li);
    addToHistory(aSource);

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
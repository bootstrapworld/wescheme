// if not defined, declare the compiler object as part of plt
window.plt   = window.plt || {};
plt.compiler = plt.compiler || {};

/*
 
 BSL AST -> Pyret AST
 follows definition from XXXXX
 
 */


(function () {
    'use strict';
 
    // convertToPyret : [listof Programs] -> JSON
    // generate pyret parse tree, preserving location information
    function convertToPyret(programs){
      function foldToPyret(acc, p){return [p.toPyret()].concat(acc); }
      return programs.reduceRight(foldToPyret, []);
    }
 
    Vector.prototype.toPyret = function(){
      return 'types.vector(['+this.elts.join(',')+'])';
    };
    Array.prototype.toPyret = function(quoted){
      return 'types.'+(this.length===0? 'EMPTY':'list(['+this.map(convertToBytecode).join(',')+'])');
    };
    // Bytecode generation for jsnums types
    jsnums.Rational.prototype.toPyret = function(){
      return {name: 'frac-expr', kids: [{value: this.stx}], pos: this.location.toPyret()};
    };
    jsnums.BigInteger.prototype.toPyret = function(){
      return {name: 'num-expr', kids: [{value: this.stx}], pos: this.location.toPyret()};
    };
    jsnums.FloatPoint.prototype.toPyret = function(){
      return {name: 'num-expr', kids: [{value: this.stx}], pos: this.location.toPyret()};
    };
    jsnums.Complex.prototype.toPyret = function(){
      throw "Complex Numbers are not yet supported in Pyret";
    };
 
    Char.prototype.toPyret = function(){
      return 'types[\'char\'](String.fromCharCode('+this.val.charCodeAt(0)+'))';
    };
 
    // Pyret Locations need ending line and column info
    Location.prototype.toPyret = function(){
      return  {"start-line": this.sLine, "start-column": this.sCol, "start-char": this.offset
            , "end-line":   this.eLine, "end-column": this.eCol, "end-char": this.offset + this.span
            , source: this.source };
    };

    // literals
    // literal(String|Char|Number|Vector)
    // everything has a toPyret() method _except_ Strs,
    // which are a hidden datatype for some reason
    literal.prototype.toPyret = function(){
      return (this.val.toPyret)? this.val.toPyret()
                                :  {name: "string-expr", pos : this.location.toPyret()
                                   , kids: [this.toWrittenString()]};
    };
 

    // Function definition
    // defFunc(name, args, body, stx)
    defFunc.prototype.toPyret = function(){
      return {name: "fun-expr", pos: this.location.toPyret()};
    };

    // Variable definition
    // defVar(name, rhs, stx)
    defVar.prototype.toPyret = function(){
      return {name: "let-expr", pos: this.location.toPyret()};
    };

    // Multi-Variable definition
    // defVars(names, rhs, stx)
    defVars.prototype.toPyret = function(){
      return "translation of Multi-Variable Definitions is not yet implemented";
    };

    // Structure definition
    // defStruct(name, fields, stx)
    defStruct.prototype.toPyret = function(){
      return "translation of Structure Definitions is not yet implemented";
    };

    // Begin expression
    // beginExpr(exprs, stx)
    beginExpr.prototype.toPyret = function(){
      return "translation of Begin Expressions is not yet implemented";
    };

    // Lambda expression
    // lambdaExpr(args, body, stx)
    lambdaExpr.prototype.toPyret = function(){
      return {name: "lambda-expr", pos: this.location.toPyret()};
    };
 
    // Local expression
    // localExpr(args, body, stx)
    localExpr.prototype.toPyret = function(){
      return "translation of Local Expressions is not yet implemented";
    };
 
 
    // call expression
    // callExpr(func, args, stx)
    callExpr.prototype.toPyret = function(){
      return "translation of Call Expressions is not yet implemented";
    };

    // if expression
    // ifExpr(predicate, consequence, alternate, stx)
    ifExpr.prototype.toPyret = function(){
      return "translation of If Expressions is not yet implemented";
    };
 
    // symbol expression
    // symbolExpr(val)
    symbolExpr.prototype.toPyret = function(){
      return "translation of Symbol Expressions is not yet implemented";
    };
  
    // require expression
    // requireExpr(spec, stx)
    requireExpr.prototype.toPyret = function(){
      return "translation of Require Expressions is not yet implemented";
    };

 
    /////////////////////
    /* Export Bindings */
    /////////////////////
    plt.compiler.toPyretAST = convertToPyret;
})();

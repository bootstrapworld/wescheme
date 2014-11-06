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
      return 'types.rational('+this.n+', '+this.d+')';
    };
    jsnums.BigInteger.prototype.toPyret = function(){
      return 'types.bignum('+this.toString()+')';
    };
    jsnums.FloatPoint.prototype.toPyret = function(){
      return 'types["float"]('+this.toString()+')';
    };
    jsnums.Complex.prototype.toPyret = function(){
      return 'types.complex('+this.r+', '+this.i+')';
    };
    Char.prototype.toPyret = function(){
      return 'types[\'char\'](String.fromCharCode('+this.val.charCodeAt(0)+'))';
    };

    // literals
    // literal(String|Char|Number|Vector)
    literal.prototype.toPyret = function(){
      return "translation of Literals is not yet implemented";
    };
 

    // Function definition
    // defFunc(name, args, body, stx)
    defFunc.prototype.toPyret = function(){
      return "translation of Function Definitions is not yet implemented";
    };

    // Variable definition
    // defVar(name, rhs, stx)
    defVar.prototype.toPyret = function(){
      return "translation of Variable Definitions is not yet implemented";
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
      return "translation of Lambda Expressions is not yet implemented";
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
      return {pos: this.location.toPyret()
              , kids : [this.predicate.toPyret()
                        , this.consequence.toPyret()
                        , this.alternate.toPyret()]
                // (if-expr IF test COLON body branch ... ELSECOLON else END)
                return RUNTIME.getField(ast, 's-if-else')
                  .app(pos(node.pos), makeList(
                    [RUNTIME.getField(ast, 's-if-branch')
                     .app(pos(node.kids[1].pos), tr(node.kids[1]), tr(node.kids[3]))]
                      .concat(node.kids.slice(4, -3).map(tr))),
                       tr(node.kids[node.kids.length - 2]));
    };
 
    // symbol expression
    // symbolExpr(val)
    symbolExpr.prototype.toPyret = function(){
      return "translation of Symbol Expressions is not yet implemented";
    };
 
    // list expression
    // listExpr(vals)
    listExpr.prototype.toPyret = function(){
      return "translation of List Expressions is not yet implemented";
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

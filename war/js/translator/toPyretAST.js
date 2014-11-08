// if not defined, declare the compiler object as part of plt
window.plt   = window.plt || {};
plt.compiler = plt.compiler || {};

/*
 
 BSL AST -> Pyret AST
 follows definition from XXXXX
 
 */


(function () {
    'use strict';
 
    // empty location
    var blankLoc = {"startRow": 1, "startCol": 0, "startChar": 1
                    , "endRow": 1, "endCol": 0, "endChar": 1};

 
    // convertToPyret : [listof Programs] -> JSON
    // generate pyret parse tree, preserving location information
    function convertToPyret(programs){
      function foldToPyret(acc, p){
        return [plt.compiler.isDefinition(p)?
                {name: "stmt", pos: p.location.toPyret(), kids: [p.toPyret()]}
                : p.toPyret()].concat(acc);
      }
      var result = programs.reduceRight(foldToPyret, []);
      return { name: "program"
             , kids: [ {name: "prelude", kids: [], pos: blankLoc}
                      , {name: "block", kids: result, pos: programs.location.toPyret()}]
             , pos: programs.location.toPyret()};
    }
 
    Vector.prototype.toPyret = function(){
      return 'types.vector(['+this.elts.join(',')+'])';
    };
    Array.prototype.toPyret = function(quoted){
      return '[]';
    };
    // Bytecode generation for jsnums types
    jsnums.Rational.prototype.toPyret = function(){
      var loc = this.location.toPyret();
      return {name: 'frac-expr'
              , pos: loc
              , kids: [{value: this.stx
                       , key: '\'RATIONAL:'+this.stx
                       , name: 'RATIONAL'
                       , pos: this.location.toPyret()}]};
    };
    jsnums.BigInteger.prototype.toPyret = function(){
      var loc = this.location.toPyret();
      return {name: 'num-expr'
              , pos: loc
              , kids: [{value: this.stx
                       , key: '\'NUMBER:'+this.stx
                       , name: 'NUMBER'
                       , pos: loc}]};
    };
    jsnums.FloatPoint.prototype.toPyret = function(){
      var loc = this.location.toPyret();
      return {name: 'num-expr'
              , pos: loc
              , kids: [{value: this.stx
                       , key: '\'NUMBER:'+this.stx
                       , name: 'NUMBER'
                       , pos: loc}]};
    };
    jsnums.Complex.prototype.toPyret = function(){
      throw "Complex Numbers are not yet supported in Pyret";
    };
 
    Char.prototype.toPyret = function(){
      return 'types[\'char\'](String.fromCharCode('+this.val.charCodeAt(0)+'))';
    };
  
    // literals
    // literal(String|Char|Number|Vector)
    // everything has a toPyret() method _except_ Strs,
    // which are a hidden datatype for some reason
    literal.prototype.toPyret = function(){
      var loc = this.location.toPyret(),
          that = this;
      function convertString(){
        return {name: "string-expr"
                , pos : loc
                , kids: [{key: '\'STRING:'+that.val.toWrittenString()
                         , name: 'STRING'
                         , value: that.val.toDisplayedString()
                         , pos : loc}]};
      }
      function convertNumber(){
        return {name: "num-expr"
                , pos : loc
                , kids: [{key: '\'NUMBER:'+that.val.toString()
                         , name: 'NUMBER'
                         , value: that.val.toString()
                         , pos : loc}]};
      }
 
      var val = (that.val.toPyret)? that.val.toPyret(loc) :
            isNaN(this)? convertString()  :
              /* else */  convertNumber();
 
      return {name: "stmt" , pos: loc
            , kids: [{name: "check-test", pos: loc
                     , kids: [{name: "binop-expr", pos: loc
                              , kids: [{name: "expr", pos: loc
                                       , kids: [{name: "prim-expr", pos: loc
                                                , kids: [val]}]}]}]}]}
    };
 

    // Function definition
    // defFunc(name, args, body, stx)
    defFunc.prototype.toPyret = function(){
/*      var loc = this.location.toPyret();
      return {name: "fun-expr", pos: loc
            , kids: [{name:'FUN', value:'fun', key:'\'FUN', pos:this.stx[0].location.toPyret()}
                     ,{name:'fun-header'
                     , kids: [{name:'ty-params', kids:[], pos: blankLoc}
                              ,{name:'NAME'
                                , value: this.name.stx
                                , key:'\'NAME:'+this.name.stx
                                , pos: this.name.location.toPyret()}
                              ,{name:'args'
                                , kids: this.args.map(function(arg){return arg.toPyret();})
                                , pos: this.args.location.toPyret()}]
                      , pos: this.stx[1].location.toPyret()}
                     ,{name:'COLON', value:':', key:'\'COLON:', pos: blankLoc}
                     ,{name:'doc-string', kids: [], pos: blankLoc}
                     ,{name:'block', kids: [this.body.toPyret()], pos: this.body.location.toPyret()}
                     ,{name:'where-clause', kids:  [], pos: blankLoc}
                     ,{name:'end'
                      , kids: [{name:'END',value:'end', key:'\'END:end', pos:this.location.end()}]
                      , pos: this.location.end().toPyret()}]
            , pos: loc};*/
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
      var loc = this.location.toPyret();
      return {name: 'stmt'
              , pos: loc
              , kids: [{name: 'check-test'
                       , pos: loc
                       , kids: [{name: 'binop-expr'
                                , pos: loc
                                , kids: [{name: 'expr'
                                         , pos: loc
                                         , kids: [{name: 'id-expr'
                                                  , pos: loc
                                                  , kids: [{key: '\'NAME:'+this.val
                                                           , name: 'NAME'
                                                           , pos: loc
                                                           , value: this.val}]}]}]}]}]};
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

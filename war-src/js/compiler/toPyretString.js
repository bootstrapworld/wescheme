goog.provide('plt.compiler.toPyretString');

goog.require("plt.compiler.literal");
goog.require("plt.compiler.symbolExpr");
goog.require("plt.compiler.Program");
goog.require("plt.compiler.couple");
goog.require("plt.compiler.ifExpr");
goog.require("plt.compiler.beginExpr");
goog.require("plt.compiler.letExpr");
goog.require("plt.compiler.letStarExpr");
goog.require("plt.compiler.letrecExpr");
goog.require("plt.compiler.localExpr");
goog.require("plt.compiler.andExpr");
goog.require("plt.compiler.orExpr");
goog.require("plt.compiler.condExpr");
goog.require("plt.compiler.caseExpr");
goog.require("plt.compiler.lambdaExpr");
goog.require("plt.compiler.quotedExpr");
goog.require("plt.compiler.unquotedExpr");
goog.require("plt.compiler.quasiquotedExpr");
goog.require("plt.compiler.unquoteSplice");
goog.require("plt.compiler.callExpr");
goog.require("plt.compiler.whenUnlessExpr");
goog.require("plt.compiler.defFunc");
goog.require("plt.compiler.defVar");
goog.require("plt.compiler.defVars");
goog.require("plt.compiler.defStruct");
goog.require("plt.compiler.requireExpr");
goog.require("plt.compiler.provideStatement");
goog.require("plt.compiler.unsupportedExpr");
goog.require("plt.compiler.throwError");
goog.require("plt.compiler.structBinding");


// if not definedsymbolMap[ declare the compiler object as part of plt
window.plt   = window.plt || {};
plt.compiler = plt.compiler || {};

/*
 
 BSL AST -> Pyret Source
 follows definition from http://www.pyret.org/docs/latest/
 
 TODO:
 - insert accessor and predicate functions into source, to allow them to evaluate to functions?
 - use those functions in the pyret source instead, simplifying callExpr translation?
 - use binop form of all infix functions
 - fix quoted symbols, so they print as strings
 - translate append as a binop tree
 - we must auto-insert data definition for posn, and functions for lists (first, append, etc) and boxes 
 */
(function () {
    'use strict';
 
   // import frequently-used bindings
   var literal          = plt.compiler.literal;
   var symbolExpr       = plt.compiler.symbolExpr;
   var Program          = plt.compiler.Program;
   var couple           = plt.compiler.couple;
   var ifExpr           = plt.compiler.ifExpr;
   var beginExpr        = plt.compiler.beginExpr;
   var letExpr          = plt.compiler.letExpr;
   var letStarExpr      = plt.compiler.letStarExpr;
   var letrecExpr       = plt.compiler.letrecExpr;
   var localExpr        = plt.compiler.localExpr;
   var andExpr          = plt.compiler.andExpr;
   var orExpr           = plt.compiler.orExpr;
   var condExpr         = plt.compiler.condExpr;
   var caseExpr         = plt.compiler.caseExpr;
   var lambdaExpr       = plt.compiler.lambdaExpr;
   var quotedExpr       = plt.compiler.quotedExpr;
   var unquotedExpr     = plt.compiler.unquotedExpr;
   var quasiquotedExpr  = plt.compiler.quasiquotedExpr;
   var unquoteSplice    = plt.compiler.unquoteSplice;
   var callExpr         = plt.compiler.callExpr;
   var whenUnlessExpr   = plt.compiler.whenUnlessExpr;
   var defFunc          = plt.compiler.defFunc;
   var defVar           = plt.compiler.defVar;
   var defVars          = plt.compiler.defVars;
   var defStruct        = plt.compiler.defStruct;
   var requireExpr      = plt.compiler.requireExpr;
   var provideStatement = plt.compiler.provideStatement;
   var unsupportedExpr  = plt.compiler.unsupportedExpr;
   var throwError       = plt.compiler.throwError;
   var structBinding    = plt.compiler.structBinding;
 
    var _pinfo = null, constructors = {}, accessors = {}, predicates = {};
    // add info about posns
    constructors["make-posn"] = "posn";
    accessors["posn-x"] = "x";
    accessors["posn-y"] = "y";
    predicates["posn?"] = "is-posn";
    // add info about lists
    accessors["rest"] = "rest";
    accessors["first"] = "first";
    accessors["length"] = "length";
    predicates["posn?"] = "is-posn";
 
    // convertToPyretString : [listof Programs] pinfo -> Pyret String
    // BSL-to-pyret translation for testing. ignores location information altogether
    function converttoPyretString(programs, pinfo){
      _pinfo = pinfo;
      // identify structs
      var isStruct = function(b){return (b instanceof structBinding);},
          accumulateStructInfo = function(b){
            constructors[b.constructor] = b.name;
            predicates[b.predicate] = "is-"+b.name;
            b.accessors.forEach(function(a){accessors[a]=a.substring(b.name.length+1);});
          },
          isTestCase = function(p){
            return (p instanceof callExpr)
                && (p.func instanceof symbolExpr)
                && (["check-expect", "EXAMPLE", "check-within"].indexOf(p.func.val) > -1);
          },
          defsAndExprs = programs.filter(function(p){return !isTestCase(p);}),
          testCases = programs.filter(isTestCase);
      _pinfo.definedNames.values().filter(isStruct).forEach(accumulateStructInfo);
 
      return defsAndExprs.map(toPyretString, []).concat(testCases.map(toPyretString));
    }
 
    function toPyretString(p){return p.toPyretString(); }
 
 
    ////////////////////////// FUNCTION MAPPINGS ///////////////////////
    // pyret functions that are infix
    var infix = ["+","-","*","/","=",">","<",">=","<=","and","or", "append", "string"];
    // racket functions for which there is no known translation
    var noTranslation = ["eval"];
 
    // racket->pyret function name mapping
    var symbolMap = {};
    symbolMap["min"]    = "num-min";
    symbolMap["max"]    = "num-max";
    symbolMap["abs"]    = "num-abs";
    symbolMap["sin"]    = "num-sin";
    symbolMap["cos"]    = "num-cos";
    symbolMap["tan"]    = "num-tan";
    symbolMap["asin"]   = "num-asin";
    symbolMap["acos"]   = "num-acos";
    symbolMap["atan"]   = "num-atan";
    symbolMap["modulo"] = "num-modulo";
    symbolMap["sqrt"]   = "num-sqrt";
    symbolMap["sqr"]    = "num-sqr";
    symbolMap["ceiling"]= "num-ceiling";
    symbolMap["floor"]  = "num-floor";
    symbolMap["log"]    = "num-log";
    symbolMap["expt"]   = "num-expr";
    symbolMap["="]      = "==";
    symbolMap["equal?"] = "equal-always";
    symbolMap["image=?"] = "equal-always";
    symbolMap["string=?"] = "equal-always";
    symbolMap["ormap"]  = "any";
    symbolMap["number->string"] = "num-tostring";
    symbolMap["bitmap/url"] = "image-url";
    symbolMap["empty?"] = "is-empty";
    symbolMap["cons?"]  = "is-link";
    symbolMap["cons"]   = "link";

 
    function makeBinopTreeForInfixApplication(infixOperator, exprs){
      function addExprToTree(tree, expr){
         return "("+expr.toPyretString()+" "+infixOperator+" "+tree+")";
      }
      // starting with the first expr, build the binop-expr tree
      var last = exprs[exprs.length-1], rest = exprs.slice(0, exprs.length-1);
      return rest.reduceRight(addExprToTree, last.toPyretString());
    }
 
    // convert a symbol to a Pyret string or a Pyret boolean
    function makeLiteralFromSymbol(sym){
     return '"'+sym.val+'"';
    }
 
    function makeStructFromMembers(constructor, elts, isQuoted){
      var args = elts.map(function(e){
        return (e instanceof Array)? makeStructFromMembers(constructor, e, isQuoted)
                          : (isQuoted && e instanceof symbolExpr)? makeLiteralFromSymbol(e)
                          : e.toPyretString();});
      return "["+constructor+": "+args.join(",")+"]"
    }
 
    Char.prototype.toPyretString = function(){
      var hexCode = (this.val.charCodeAt(0).toString(16).toUpperCase());
      return (this.val.charCodeAt(0) < 128)? '"'+this.val+'"' : ('"\\u'+hexCode +'"');
    }
 
    ////////////////////////// DEFINITIONS AND EXPRESSIONS /////////////
    // Function definition
    // defFunc(name, args, body, stx)
    defFunc.prototype.toPyretString = function(){
      var str="fun "+this.name.toPyretString()+"("+this.args.map(toPyretString).join(",")+"):\n";
      str+="  "+this.body.toPyretString()+"\nend";
      return str;
    };

    // Variable definition
    // defVar(name, expr, stx)
    defVar.prototype.toPyretString = function(){
      var str = this.name.toPyretString()+" = "+this.expr.toPyretString();
      return str;
    };
    defVars.prototype.toPyretString = function(){
      return "translation of defVars is not yet implemented";
    };


    // Structure definition
    // defStruct(name, fields, stx)
    defStruct.prototype.toPyretString = function(){
      var str = "", name = this.name.toPyretString(),
          typeName = name+"_"
      str+="data "+typeName+": | "+name+"("+this.fields.map(toPyretString).join(", ")+")"+" end\n";
 
      function makeStandaloneAccessorFunction(field){
        str+="fun "+name+"-"+field.toPyretString()+"(_struct_): "
              +"_struct_."+field.toPyretString()+" end\n";
      }
 
      // add accessor functions, constructor and predicate
      this.fields.forEach(makeStandaloneAccessorFunction)
      str+="fun "+name+"QUESTION(_struct_): "+"is-"+name+"(_struct_) end\n";
      str+="fun make-"+name+"("+this.fields.map(toPyretString).join(",")+"): "
          +name+"("+this.fields.map(toPyretString).join(",")+") end\n";
      return str;
    };
                                     
    beginExpr.prototype.toPyretString = function(){
      return "block: "+this.exprs.map(toPyretString)+" end";
    };
    whenUnlessExpr.prototype.toPyretString = function(){
      // if it's "unless", change the predicate to not(pred) in racket
      var pred = (this.stx.val==="unless")? "not("+this.predicate.toPyretString()+")"
                                          : this.predicate.toPyretString(),
          begin_exp = new beginExpr(this.exprs, this.stx);
      return "when "+pred+":"+begin_exp.toPyretString()+" end"
    };
    localExpr.prototype.toPyretString = function(){
      // if there are no defs, just translate the body
      if(this.defs.length === 0) return this.body.toPyretString();
      function makeBindingFromDefn(d){
        return d.name.toPyretString()+" = "+((d instanceof defVar)? d.expr.toPyretString() :
          "lam("+d.args.map(toPyretString).join(", ")+"):\n"+d.body.toPyretString()+" end")
      }
      var bindings = this.defs.map(makeBindingFromDefn);
      return "letrec "+bindings.join(", ")+": "+this.body.toPyretString()+" end";
    };

    letrecExpr.prototype.toPyretString = function(){
      // if there are no defs, just translate the body
      if(this.bindings.length === 0) return this.body.toPyretString();
      function makeBindingFromCouple(c){
        return c.first.toPyretString()+" = "+c.second.toPyretString();
      }
      var bindings = this.bindings.map(makeBindingFromCouple);
      return "letrec "+bindings.join(", ")+": "+this.body.toPyretString()+" end";
    };
    // we make temp bindings first, to preserve scope behavior
    letExpr.prototype.toPyretString = function(){
      // if there are no defs, just translate the body
      if(this.bindings.length === 0) return this.body.toPyretString();
      var tmpIDs = this.bindings.map(function(c){return c.first.toPyretString()+"_tmp";}),
          // bind the rhs to lhs_tmp (a_1 = 5, ...)
          tmpBindings = this.bindings.map(function(c, i){return tmpIDs[i]+" = "+c.second.toPyretString();}),
          // bind lhs_tmp to lhs (a = a_1, ...)
          newBindings = this.bindings.map(function(c, i){return c.first.toPyretString()+" = "+tmpIDs[i];});
      return "block:\n"+tmpBindings.join("\n")+"\n"+newBindings.join("\n")+"\n"+this.body.toPyretString()+" end";
    };
    letStarExpr.prototype.toPyretString = function(){
      // if there are no defs, just translate the body
      if(this.bindings.length === 0) return this.body.toPyretString();
      var bindings = this.bindings.map(function(c){
                      return c.first.toPyretString()+" = "+c.second.toPyretString();
      });
      return "block:\n"+bindings.join("\n")+"\n"+this.body.toPyretString()+" end";
    };
    caseExpr.prototype.toPyretString = function(){
      function convertClause(c){
        return "| any(lam(elt): equal-always(_val,elt) end, "
              + c.first.toPyretString() + ") then: " + c.second.toPyretString();
      }
      return "block: \n _val=" + this.expr.toPyretString() + "\n ask:"
              + this.clauses.map(convertClause).join("\n") + "\n end \n end";
    };

    // Lambda expression
    // lambdaExpr(args, body, stx)
    lambdaExpr.prototype.toPyretString = function(){
      var str = "";
      str+="lam("+this.args.map(toPyretString).join(", ")+"):\n";
      str+="  "+this.body.toPyretString()+"\nend";
      return str;
    };
 
    // cond expression
    // condExpr(clauses, stx)
    condExpr.prototype.toPyretString = function(){
      function convertClause(couple){
        return " | "+((couple.first.toPyretString()=="else")? " otherwise: "
                        : couple.first.toPyretString() + " then: ")
                + couple.second.toPyretString()+"\n";
      }
 
      var str = "ask:\n";
      str+=this.clauses.map(convertClause)+"end";
      return str;
    };
 
    // and expression
    // andExpr(exprs, stx)
    andExpr.prototype.toPyretString = function(){
      return makeBinopTreeForInfixApplication("and", this.exprs);
    };
 
    // or expression
    // orExpr(exprs, stx)
    orExpr.prototype.toPyretString = function(){
      return makeBinopTreeForInfixApplication("or", this.exprs);
    };
 
    // call expression
    // callExpr(func, args, stx)
    callExpr.prototype.toPyretString = function(){
      var funcStr = this.func.toString();
 
      // special-case for check-expect and EXAMPLE
      if(["EXAMPLE", "check-expect"].indexOf(funcStr) > -1){
        return "check:\n"+this.args[0].toPyretString()+" is "+this.args[1].toPyretString()+"\nend";
      }
 
      // special-case for infix operators
      if(infix.indexOf(funcStr) > -1){
        return makeBinopTreeForInfixApplication(this.func.toPyretString(), this.args);
      }
 
      // special-case for vector and list constructors
      if(funcStr==="vector") return makeStructFromMembers("array", this.args);
      if(funcStr==="list")   return makeStructFromMembers("list", this.args);
 
      // special-case for big-bang
      if(funcStr === "big-bang"){
        var world_args = [this.args[0].toPyretString(), makeStructFromMembers("list", this.args.slice(1))];
        return this.func.toPyretString() +"("+world_args.join(', ')+")";
      }
 
      // special-case for constructor functions
      if(constructors[funcStr]){
        return funcStr.substring(5)+"("+this.args.map(toPyretString).join(', ')+")";
      }
 
      // special-case for accessor functions
      if(accessors[funcStr]){
        return this.args[0].toPyretString()+"."+accessors[funcStr];
      }
 
      // special-case for struct-predicate functions
      if(predicates[funcStr]){
        return predicates[funcStr]+"("+this.args[0].toPyretString()+")";
      }
 
      // general case
      return this.func.toPyretString() +"("+this.args.map(toPyretString).join(', ')+")";
    };

    // if expression
    // ifExpr(predicate, consequence, alternate, stx)
    ifExpr.prototype.toPyretString = function(){
      var rawPredicate = ((this.predicate instanceof callExpr)
                          && (this.predicate.func.val === "verify-boolean-branch-value"))?
                          this.predicate.args[2] : this.predicate;
      var str = "";
      str+="if "+rawPredicate.toPyretString() + ":\n  ";
      str+=this.consequence.toPyretString() + "\nelse:\n  ";
      str+=this.alternative.toPyretString() + "\nend";
      return str;
    };
                                     
    // quotedExpr
    // quotedExpr(val)
    quotedExpr.prototype.toPyretString = function(){
      if(this.val instanceof literal && this.val.val instanceof symbolExpr){
        return makeLiteralFromSymbol(this.val);
      } else if(this.val instanceof literal){
        return this.val.toPyretString();
      } else if(this.val instanceof symbolExpr){
        return makeLiteralFromSymbol(this.val);
      } else if (this.val instanceof Array){
        return makeStructFromMembers("list", this.val, true);
      } else {
        throw "There is no translation for "+this.toString();
      }
    };
    // we do the best we can to desugar and translate quasiquoted expressions
    quasiquotedExpr.prototype.toPyretString = function(){
      return this.desugar(_pinfo)[0].toPyretString();
    };
 
    // if a symbol already has a (different) name in Pyret, use that
    // otherwise, clean it up so it's a valid Pyret identifier
    symbolExpr.prototype.toPyretString = function(){
      return (symbolMap[this.val])? symbolMap[this.val]
          : this.val.length===1? this.val
          : this.val.replace(/\//g,'SLASH').replace(/\?/g,'QUESTION').replace(/\!/g,'BANG').replace(/\+/g,'PLUS');
    };

    // literals
    // literal(String|Char|Number)
    literal.prototype.toPyretString = function(){
      return this.val.toPyretString? this.val.toPyretString()
          : this.val.toWrittenString? this.val.toWrittenString()
                  /* else */        : this.val.toString();
    };
                             
    // require expression
    // requireExpr(spec, stx)
    requireExpr.prototype.toPyretString = function(){
      return "translation of Require Expressions is not yet implemented";
    };

    /////////////////////
    /* Export Bindings */
    /////////////////////
    plt.compiler.toPyretString = converttoPyretString;
})();

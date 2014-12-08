// if not definedfnMap[ declare the compiler object as part of plt
window.plt   = window.plt || {};
plt.compiler = plt.compiler || {};

/*
 
 BSL AST -> Pyret Source
 follows definition from http://www.pyret.org/docs/latest/
 
 */

(function () {
    'use strict';
 
    // convertToPyretString : [listof Programs] -> Pyret String
    // BSL-to-pyret translation for testing. ignores location information altogether
    function converttoPyretString(programs){
      function foldtoPyretString(acc, p){return [p.toPyretString()].concat(acc); }
      return programs.reduceRight(foldtoPyretString, []);
    }
 
 
    ////////////////////////// VALUES AND IDENTIFIERS ///////////////////
 
    // if a symbol already has a (different) name in Pyret, use that
    // otherwise, clean it up so it's a valid Pyret identifier
    symbolExpr.prototype.toPyretString = function(){
      var sym = getPyretFn(this.val.toString());
      return (sym.toString().replace(/\//g,'-').replace(/\?/g,'').replace(/\*/g,''));
    };

    // literals
    // literal(String|Char|Number)
    literal.prototype.toPyretString = function(){
      return this.val.toWrittenString? this.val.toWrittenString() : this.val.toString();
    };
 
    ////////////////////////// FUNCTION MAPPINGS ///////////////////////
    // pyret functions that are infix
    var infix = ["+","-","*","/","=",">","<",">=","<=","and","or"];
                                                   
    // given a BSL function name, produce the corresponding Pyret function name
    // if there's a mapping defined, use it. Otherwise, use the given BSLfn as-is
    function getPyretFn(BSLfn){
      return (fnMap[BSLfn]==undefined)? BSLfn : fnMap[BSLfn];
    }
                                                   
    // racket->pyret function name mapping
    var fnMap = {};
    fnMap["min"] = "num-min";
    fnMap["max"] = "num-max";
    fnMap["abs"] = "num-abs";
    fnMap["sin"] = "num-sin";
    fnMap["cos"] = "num-cos";
    fnMap["tan"] = "num-tan";
    fnMap["asin"] = "num-asin";
    fnMap["acos"] = "num-acos";
    fnMap["atan"] = "num-atan";
    fnMap["num/url"] = "num-url";
    fnMap["num/url"] = "num-url";
    fnMap["num/url"] = "num-url";
    fnMap["modulo"] = "num-modulo";
    fnMap["sqrt"] = "num-sqrt";
    fnMap["sqr"] = "num-url";
    fnMap["ceiling"] = "num-ceiling";
    fnMap["floor"] = "num-floor";
    fnMap["log"] = "num-log";
    fnMap["expt"] = "num-expr";
    fnMap["number->string"] = "num-tostring";
    fnMap["bitmap/url"] = "image-url";
                                     
                                     
    function makeBinopTreeForInfixApplication(infixOperator, exprs){
      function addExprToTree(tree, expr){
         return "("+expr.toPyretString()+" "+infixOperator+" "+tree+")";
      }
      // starting with the first expr, build the binop-expr tree
      var last = exprs[exprs.length-1], rest = exprs.slice(0, exprs.length-1);
      return rest.reduceRight(addExprToTree, last.toPyretString());
    }
                                     
 
    ////////////////////////// DEFINITIONS AND EXPRESSIONS /////////////
    // Function definition
    // defFunc(name, args, body, stx)
    defFunc.prototype.toPyretString = function(){
      var str="fun "+this.name.toPyretString()+"("+converttoPyretString(this.args).join(",")+"):\n";
      str+="  "+this.body.toPyretString()+"\nend";
      return str;
    };

    // Variable definition
    // defVar(name, expr, stx)
    defVar.prototype.toPyretString = function(){
      var str = "var "+this.name.toPyretString()+" = "+this.expr.toPyretString();
      return str;
    };

    // Structure definition
    // defStruct(name, fields, stx)
    defStruct.prototype.toPyretString = function(){
      var str = "", name = this.name.toPyretString(),
          typeName = name.charAt(0).toUpperCase()+name.slice(1);
      str+="data "+typeName+": "+name
          +"("+converttoPyretString(this.fields).join(", ")+")"+" end";
      return str;
    };
                                     
    beginExpr.prototype.toPyretString = function(){};
    whenUnlessExpr.prototype.toPyret = function(){};
    letrecExpr.prototype.toPyret = function(){};
    letExpr.prototype.toPyret = function(){};
    letStarExpr.prototype.toPyret = function(){};
    condExpr.prototype.toPyretString = function(){};
    caseExpr.prototype.toPyretString = function(){};
    beginExpr.prototype.toPyretString = function(){};

    // Lambda expression
    // lambdaExpr(args, body, stx)
    lambdaExpr.prototype.toPyretString = function(){
      var str = "";
      str+="lam("+converttoPyretString(this.args).join(", ")+"):\n";
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
      return this.exprs.slice(1).reduce(function(str, expr){
        return "("+str+" and "+expr.toPyretString()+")";
                             }, this.exprs[0].toPyretString());
    };
 
    // or expression
    // orExpr(exprs, stx)
    orExpr.prototype.toPyretString = function(){
      return this.exprs.slice(1).reduce(function(str, expr){
        return "("+str+" or "+expr.toPyretString()+")";
                             }, this.exprs[0].toPyretString());
    };
 
    // call expression
    // callExpr(func, args, stx)
    // we need to treat infix operators specially
    callExpr.prototype.toPyretString = function(){
      var str = "";
                                     
      // special-case for check
      if(this.func.toString()=="EXAMPLE"
         || this.func.toString()=="check-expect"){
        return "check:\n"+this.args[0].toPyretString()+" is "+this.args[1].toPyretString()+"\nend";
      }
                             
      // special-case for infix operators
      // use toString() because we want to compare the *original* racket string
      if(infix.indexOf(this.func.toString()) > -1){
        return makeBinopTreeForInfixApplication(this.func.toString(), this.args);
      }
                                     
      // general case
      return getPyretFn(this.func.toPyretString())
            +"("+converttoPyretString(this.args).join(', ')+")";
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
      return this.val;
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

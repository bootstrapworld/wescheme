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
    function convertToPyret(programs){
      function foldToPyret(acc, p){return [p.toPyret()].concat(acc); }
      return programs.reduceRight(foldToPyret, []);
    }
 
 
    ////////////////////////// VALUES AND IDENTIFIERS ///////////////////
 
    // if a symbol already has a (different) name in Pyret, use that
    // otherwise, clean it up so it's a valid Pyret identifier
    symbolExpr.prototype.toPyret = function(){
      var sym = getPyretFn(this.val.toString());
      return (sym.toString().replace(/\//g,'-').replace(/\?/g,'').replace(/\*/g,''));
    };

    // literals
    // literal(String|Char|Number)
    literal.prototype.toPyret = function(){
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
 
    ////////////////////////// DEFINITIONS AND EXPRESSIONS /////////////
    // Function definition
    // defFunc(name, args, body, stx)
    defFunc.prototype.toPyret = function(){
      var str="fun "+this.name.toPyret()+"("+convertToPyret(this.args).join(",")+"):\n";
      str+="  "+this.body.toPyret()+"\nend";
      return str;
    };

    // Variable definition
    // defVar(name, expr, stx)
    defVar.prototype.toPyret = function(){
      var str = "var "+this.name.toPyret()+" = "+this.expr.toPyret();
      return str;
    };

    // Structure definition
    // defStruct(name, fields, stx)
    defStruct.prototype.toPyret = function(){
      var str = "", name = this.name.toPyret(),
          typeName = name.charAt(0).toUpperCase()+name.slice(1);
      str+="data "+typeName+": "+name
          +"("+convertToPyret(this.fields).join(", ")+")"+" end";
      return str;
    };

    // Lambda expression
    // lambdaExpr(args, body, stx)
    lambdaExpr.prototype.toPyret = function(){
      var str = "";
      str+="lam("+convertToPyret(this.args).join(", ")+"):\n";
      str+="  "+this.body.toPyret()+"\nend";
      return str;
    };
 
    // cond expression
    // condExpr(clauses, stx)
    condExpr.prototype.toPyret = function(){
      function convertClause(couple){
        return " | "+((couple.first.toPyret()=="else")? " otherwise: "
                        : couple.first.toPyret() + " then: ")
                + couple.second.toPyret()+"\n";
      }
 
      var str = "ask:\n";
      str+=this.clauses.map(convertClause)+"end";
      return str;
    };
 
    // and expression
    // andExpr(exprs, stx)
    andExpr.prototype.toPyret = function(){
      return this.exprs.slice(1).reduce(function(str, expr){
        return "("+str+" and "+expr.toPyret()+")";
                             }, this.exprs[0].toPyret());
    };
 
    // or expression
    // orExpr(exprs, stx)
    orExpr.prototype.toPyret = function(){
      return this.exprs.slice(1).reduce(function(str, expr){
        return "("+str+" or "+expr.toPyret()+")";
                             }, this.exprs[0].toPyret());
    };
 
    // call expression
    // callExpr(func, args, stx)
    // we need to treat infix operators specially
    callExpr.prototype.toPyret = function(){
      var str = "";
                                     
      // special-case for check
      if(this.func.toString()=="EXAMPLE"
         || this.func.toString()=="check-expect"){
        return "check:\n"+this.args[0].toPyret()+" is "+this.args[1].toPyret()+"\nend";
      }
                             
      // special-case for infix operators
      // use toString() because we want to compare the *original* racket string
      if(infix.indexOf(this.func.toString()) > -1){
        return "("+this.args[0].toPyret()
              +" "+this.func.toString()+" "
              +this.args[1].toPyret()+")";
      }
                                     
      // general case
      return getPyretFn(this.func.toPyret())
            +"("+convertToPyret(this.args).join(', ')+")";
    };

    // if expression
    // ifExpr(predicate, consequence, alternate, stx)
    ifExpr.prototype.toPyret = function(){
      var str = "";
      str+="if "+this.predicate.toPyret() + ":\n  ";
      str+=this.consequence.toPyret() + "\nelse:\n  ";
      str+=this.alternative.toPyret() + "\nend";
      return str;
    };
 
    // require expression
    // requireExpr(spec, stx)
    requireExpr.prototype.toPyret = function(){
      return "translation of Require Expressions is not yet implemented";
    };

    /////////////////////
    /* Export Bindings */
    /////////////////////
    plt.compiler.toPyretString = convertToPyret;
})();

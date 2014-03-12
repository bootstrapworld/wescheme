/*
 TODO
 - desugar Symbols
 - desugar defFunc?
 - tagApplicationOperator_Module
 - test cases get desugared into native calls (and thunks?)
 - implement bytecode structs
 - how to add struct binding when define-struct is desugared away?
 - compilation
*/
(function () {
 'use strict';
 
 // tag-application-operator/module: Stx module-name -> Stx
 // Adjust the lexical context of the func so it refers to the environment of a particular module.
 function tagApplicationOperator_Module(call_exp, moduleName){
    var func = call_exp.func,
        operands = call_exp.args,
        module = defaultModuleResolver(moduleName),
        env = compilerStructs.emptyEnv().extendEnv_moduleBinding(module);
    call_exp.context = env;
    return call_exp;
 }

// forceBooleanContext: str, loc, bool -> stx
// Force a boolean runtime test on the given expression.
 function forceBooleanContext(str, loc, boolExpr){
    var runtimeCall = new callExpr(new symbolExpr("verify-boolean-branch-value")
                                   , [new quotedExpr(new symbolExpr(str))
                                      , new quotedExpr(loc.toVector())
                                      , boolExpr
                                      , new quotedExpr(boolExpr.location.toVector())]);
    runtimeCall.location = boolExpr.location;
//    tagApplicationOperator_Module(runtimeCall, 'moby/runtime/kernel/misc');
    return runtimeCall;
 }
 
 //////////////////////////////////////////////////////////////////////////////
 // DESUGARING ////////////////////////////////////////////////////////////////

 // desugarProgram : Listof Programs null/pinfo -> [Listof Programs, pinfo]
 // desugar each program, appending those that desugar to multiple programs
 function desugarProgram(programs, pinfo){
      var acc = [ [], (pinfo || new compilerStructs.pinfo())];
      return programs.reduce((function(acc, p){
            var desugaredAndPinfo = p.desugar(acc[1]);
            if(desugaredAndPinfo[0].length){
              acc[0] = acc[0].concat(desugaredAndPinfo[0]);
            } else {
              acc[0].push(desugaredAndPinfo[0]);
            }
            return [acc[0], desugaredAndPinfo[1]];
        }), acc);
 }
 
 // Program.prototype.desugar: pinfo -> [Program, pinfo]
 Program.prototype.desugar = function(pinfo){ return [this, pinfo]; };
 defFunc.prototype.desugar = function(pinfo){
    // check for duplicate arguments
    checkDuplicateIdentifiers([this.name].concat(this.args), this.stx[0], this.location);
    var lambdaExp = new lambdaExpr(this.args, this.body),
        varExp =  new defVar(this.name, lambdaExp)
    lambdaExp.location = this.location;
    varExp.location = this.location;
    return varExp.desugar(pinfo);
 };
 defVar.prototype.desugar = function(pinfo){
    var exprAndPinfo = this.expr.desugar(pinfo);
    this.expr = exprAndPinfo[0];
    return [this, exprAndPinfo[1]];
 };
 defVars.prototype.desugar = function(pinfo){
    var exprAndPinfo = this.expr.desugar(pinfo);
    this.expr = exprAndPinfo[0];
    return [this, exprAndPinfo[1]];
 };
 defStruct.prototype.desugar = function(pinfo){
    var name = this.name.toString(),
        fields = this.fields.map(function(f){return f.toString();}),
        mutatorIds = fields.map(function(field){return name+'-'+field+'-set!';}),
        ids = [name, 'make-'+name, name+'?', name+'-ref', , name+'-set!'].concat(mutatorIds),
        idSymbols = ids.map(function(id){return new symbolExpr(id);}),
        call = new callExpr(new primop(new symbolExpr('make-struct-type')),
                            [new symbolExpr(name),
                             new symbolExpr("false"),
                             new numberExpr(fields.length),
                             new numberExpr(0)]);
        call.location = this.location;
    var defineValuesStx = [new defVars(idSymbols, call)],
        selectorStx = [];
    // given a field, make a definition that binds struct-field to the result of
    // a make-struct-field accessor call in the runtime
    function makeAccessorDefn(f, i){
      var runtimeOp = new primop(new symbolExpr('make-struct-field-accessor')),
          runtimeArgs = [new symbolExpr(name+'-ref'), new numberExpr(i), new symbolExpr("false")],
          runtimeCall = new callExpr(runtimeOp, runtimeArgs),
          defineVar = new defVar(new symbolExpr(name+'-'+f), runtimeCall);
      selectorStx.push(defineVar);
    }
    fields.forEach(makeAccessorDefn);
    return [defineValuesStx.concat(selectorStx), pinfo];
 };
 beginExpr.prototype.desugar = function(pinfo){
    var exprsAndPinfo = desugarProgram(this.exprs, pinfo);
    this.exprs = exprsAndPinfo[0];
    return [this, exprsAndPinfo[1]];
 };
 lambdaExpr.prototype.desugar = function(pinfo){
    // if this was parsed from raw syntax, check for duplicate arguments
    if(this.stx) checkDuplicateIdentifiers(this.args, this.stx[0], this.location);
    var bodyAndPinfo = this.body.desugar(pinfo);
    this.body = bodyAndPinfo[0];
    return [this, bodyAndPinfo[1]];
 };
 localExpr.prototype.desugar = function(pinfo){
    var defnsAndPinfo = desugarProgram(this.defs, pinfo);
    var exprAndPinfo = this.body.desugar(defnsAndPinfo[1]);
    this.defs = defnsAndPinfo[0];
    this.body = exprAndPinfo[0];
    return [this, exprAndPinfo[1]];
 };
 callExpr.prototype.desugar = function(pinfo){
    var exprsAndPinfo = desugarProgram([this.func].concat(this.args), pinfo);
    this.func = exprsAndPinfo[0][0];
    this.args = exprsAndPinfo[0].slice(1);
    return [this, exprsAndPinfo[1]];
 };
 ifExpr.prototype.desugar = function(pinfo){
    var exprsAndPinfo = desugarProgram([this.predicate,
                                        this.consequence,
                                        this.alternative],
                                       pinfo);
    this.predicate = forceBooleanContext("if", this.location, exprsAndPinfo[0][0]);
    this.consequence = exprsAndPinfo[0][1];
    this.alternative = exprsAndPinfo[0][2];
    return [this, exprsAndPinfo[1]];
 };

 // letrecs become locals
 letrecExpr.prototype.desugar = function(pinfo){
    function bindingToDefn(b){
      var def = new defVar(b.first, b.second);
      def.location = b.location;
      return def};
    var localAndPinfo = new localExpr(this.bindings.map(bindingToDefn), this.body).desugar(pinfo);
    localAndPinfo[0].location = this.location;
    return localAndPinfo;
 };
 // lets become calls
 letExpr.prototype.desugar = function(pinfo){
    var ids   = this.bindings.map(coupleFirst),
        exprs = this.bindings.map(coupleSecond);
    return new callExpr(new lambdaExpr(ids, this.body), exprs).desugar(pinfo);
 };
 // let*s become nested lets
 letStarExpr.prototype.desugar = function(pinfo){
    var body = this.body;
    for(var i=0; i<this.bindings.length; i++){
      body = new letExpr([this.bindings[i]], body);
    }
    return body.desugar(pinfo);
 };
 // conds become nested ifs
 condExpr.prototype.desugar = function(pinfo){
    // base case is all-false
    var expr = new callExpr(new symbolExpr('make-cond-exhausted-expression')
                            , new quotedExpr(this.location.toVector()));
    for(var i=this.clauses.length-1; i>-1; i--){
      expr = new ifExpr(this.clauses[i].first, this.clauses[i].second, expr);
      expr.location = this.location;
    }
    return expr.desugar(pinfo);
 };
 // case become nested ifs, with ormap as the predicate
 caseExpr.prototype.desugar = function(pinfo){
    var pinfoAndValSym = pinfo.gensym('val'),      // create a symbol 'val'
        updatedPinfo1 = pinfoAndValSym[0],        // generate pinfo containing 'val'
        valStx = pinfoAndValSym[1];               // remember the symbolExpr for 'val'
    var pinfoAndXSym = updatedPinfo1.gensym('x'), // create another symbol 'x' using pinfo1
        updatedPinfo2 = pinfoAndXSym[0],          // generate pinfo containing 'x'
        xStx = pinfoAndXSym[1];                   // remember the symbolExpr for 'x'
 
    // if there's an 'else', pop off the clause and use the result as the base
    var expr, clauses = this.clauses, lastClause = clauses[this.clauses.length-1];
    if((lastClause.first instanceof symbolExpr) && (lastClause.first.val === 'else')){
      expr = lastClause.second;
      clauses.pop();
    } else {
      expr = new symbolExpr('void');
    }

    // This is predicate we'll be applying using ormap: (lambda (x) (equal? x val))
    var predicateStx = new lambdaExpr([xStx], new callExpr(new symbolExpr('equal?'),
                                                          [xStx, valStx]));

    var stxs = [valStx, xStx, predicateStx]; // track all the syntax we've created
 
    // generate (if (ormap <predicate> (quote clause.first)) clause.second base)
    function processClause(base, clause){
      var ormapStx = new primop('ormap'),
          quoteStx = new quotedExpr(clause.first),
          callStx = new callExpr(ormapStx, [predicateStx, quoteStx]),
          ifStx = new ifExpr(callStx, clause.second, base);
      stxs = stxs.concat([ormapStx, callStx, quoteStx, ifStx]);
      return ifStx;
    }

    // build the body of the let by decomposing cases into nested ifs
    var binding = new couple(valStx, this.expr),
        body = clauses.reduceRight(processClause, expr),
        letExp = new letExpr([binding], body);
    stxs = stxs.concat([binding, body,letExp]);

    // assign location to every stx element
    var loc = this.location;
    stxs.forEach(function(stx){stx.location = loc;});
    return letExp.desugar(updatedPinfo2);
 };
 // ands become nested ifs
 andExpr.prototype.desugar = function(pinfo){
    var expr = this.exprs[this.exprs.length-1];
    for(var i= this.exprs.length-2; i>-1; i--){ // ASSUME length >=2!!!
      expr = new ifExpr(this.exprs[i], expr, new symbolExpr(new symbolExpr("false")));
      expr.location = this.location;
    }
    return expr.desugar(pinfo);
 };
 // ors become nested lets-with-if-bodies
 orExpr.prototype.desugar = function(pinfo){
    // grab the last expr, and remove it from the list and desugar
    var expr = forceBooleanContext("or", this.location, this.exprs.pop()),
        that = this;
 
    // given a desugared chain, add this expr to the chain
    // we optimize the predicate/consequence by binding the expression to a temp symbol
    function convertToNestedIf(restAndPinfo, expr){
      var pinfoAndTempSym = pinfo.gensym('tmp'),
          exprLoc = expr.location,
          tmpSym = pinfoAndTempSym[1],
          expr = forceBooleanContext("or", exprLoc, expr), // force a boolean context on the value
          tmpBinding = new couple(tmpSym, expr); // (let (tmpBinding) (if tmpSym tmpSym (...))
      tmpSym.location = exprLoc;
      tmpBinding.location = exprLoc;
      var if_exp = new ifExpr(tmpSym, tmpSym, restAndPinfo[0]),
          let_exp = new letExpr([tmpBinding], if_exp);
      if_exp.location = exprLoc;
      let_exp.location = exprLoc;
      return [let_exp, restAndPinfo[1]];
    }
    var exprsAndPinfo = this.exprs.reduceRight(convertToNestedIf, [expr, pinfo]),
        desugared = exprsAndPinfo[0].desugar(exprsAndPinfo[1]);
    return [desugared[0], exprsAndPinfo[1]];
 };
 
 quotedExpr.prototype.desugar = function(pinfo){
    function desugarQuotedItem(sexp){
      if(sexp instanceof Array) return sexp.map(desugarQuotedItem);
      else return new callExpr(new primop('list'), [new quotedExpr(sexp.toString())]);
    }
    if(this.val instanceof Array){
      var call_exp = new callExpr(new primop('append'), this.val.map(desugarQuotedItem));
      call_exp.location = this.location;
      return [call_exp, pinfo];
    } else {
      return [new symbolExpr(this.val), pinfo];
    }
 };

 // go through each item in search of unquote or unquoteSplice
 quasiquotedExpr.prototype.desugar = function(pinfo){
    function desugarQuasiQuotedElements(element) {
      if(element instanceof unquoteSplice){
        return element.val.desugar(pinfo)[0];
      } else if(element instanceof unquotedExpr){
        return new callExpr(new primop(new symbolExpr('list')), [element.val.desugar(pinfo)[0]]);
      } else if(element instanceof quasiquotedExpr){
        /* we first must exit the regime of quasiquote by calling desugar on the
         * list a la unquote or unquoteSplice */
        throwError("ASSERT: we should never parse a quasiQuotedExpr within an existing quasiQuotedExpr")
      } else if(element instanceof Array){
        return new callExpr(new primop(new symbolExpr('list')),
                            [new callExpr(new primop(new symbolExpr('append')),
                                          element.map(desugarQuasiQuotedElements))]);
      } else {
        return new callExpr(new primop(new symbolExpr('list')),
                            [new quotedExpr(element.toString())]);
      }
    }

    if(this.val instanceof Array){
      var result = new callExpr(new primop(new symbolExpr('append')),
                                this.val.map(desugarQuasiQuotedElements));
      return [result, pinfo];
    } else {
      return [new quotedExpr(this.val.toString()), pinfo];
    }
 };
 symbolExpr.prototype.desugar = function(pinfo){
    // is this 'else'?
    if(this.val === "else"){
        throwError(new types.Message([new types.ColoredPart(this.val, this.location)
                                      , ": not allowed "
                                      , new types.ColoredPart("here", this.location)
                                      , ", because this is not a question in a clause"]),
                    this.location);
    }
    return [this, pinfo];
 };
 
 //////////////////////////////////////////////////////////////////////////////
 // COLLECT DEFINITIONS ///////////////////////////////////////////////////////

 // extend the Program class to collect definitions
 // Program.collectDefnitions: pinfo -> pinfo
 Program.prototype.collectDefinitions = function(pinfo){ return pinfo; };

 // bf: symbol path number boolean string -> binding:function
 // Helper function.
 function bf(name, modulePath, arity, vararity, loc){
    return new bindingFunction(name, modulePath, arity, vararity, [], false, loc);
 }
 defVar.prototype.collectDefinitions = function(pinfo){
    var binding = (this.expr instanceof lambdaExpr)?
                    bf(this.name.val, false, this.expr.args.length, false, this.name.location)
                  : new bindingConstant(this.name.val, false, [], this.name.location);
    return pinfo.accumulateDefinedBinding(binding, this.location);
 };
 defVars.prototype.collectDefinitions = function(pinfo){
    var that = this;
    return this.names.reduce(function(pinfo, id){
      var binding = new bindingConstant(id.val, false, [], id.location);
      return pinfo.accumulateDefinedBinding(binding, that.location);
    }, pinfo);
 };
/* THIS SHOULD BE DEAD CODE
 ******************************************
  defStruct.prototype.collectDefinitions = function(pinfo){
    var id = this.id.toString(),
        fields = this.fields.map(function(f){return f.toString();}),
        loc = id.location,
        // build all the struct IDs
        constructorId = 'make-'+id,
        predicateId = id+'?',
        selectorIds = fields.map(function(f){return id+'-'+f;}),
        mutatorIds  = fields.map(function(f){return id+'-'+f+'-set!';}),
        // build all the bindings
        constructor = bf(constructorId, false, fields.length, false, loc),
        predicate = bf(predicateId, false, 1, false, loc),
        selectors = selectorIds.map(function(id){return bf(id, false, 1, false, loc);}),
        mutators  = mutatorIds.map(function(id){return bf(id, false, 2, false, loc);}),
        structure = new bindingStructure(id, false, fields, constructorId, predicateId
                                        , selectorIds, mutatorIds, loc),
        bindings = [structure, constructor, predicate].concat(selectors, mutators);
    return pinfo.accumulateDefinedBindings(bindings, this.location);
 };
 */
 // When we hit a require, we have to extend our environment to include the list of module
 // bindings provided by that module.
 requireExpr.prototype.collectDefinitions = function(pinfo){
/*    throw "collecting definitions from require is not yet implemented (see compiler.js)";
    var errorMessage =  ["require", ": ", "moby-error-type:unknown-module: ", this.spec],
        moduleName = pinfo.modulePathResolver(this.spec, this.currentModulePath);
    // if it's an invalid moduleName, throw an error
    if(!moduleName){
      throwError(errorMessage, this.location);
    }
    var moduleBinding = pinfo.moduleResolver(moduleName);
    // if it's an invalid moduleBinding, throw an error
    if(!moduleBinding){
      throwError(errorMessage, this.location);
    }
 
    // if everything is okay, add the module bindings to this pinfo and return
    pinfo.accumulateModule(pinfo.accumulateModuleBindings(moduleBinding.bindings));
 */
    return pinfo;
 };
 localExpr.prototype.collectDefinitions = function(pinfo){
    // remember previously defined names, so we can revert to them later
    // in the meantime, scan the body
    var prevKeys = pinfo.definedNames.keys(),
        localPinfo= this.defs.reduce(function(pinfo, p){
                                        return p.collectDefinitions(pinfo);
                                        }
                                        , pinfo),
        newPinfo  = this.body.collectDefinitions(localPinfo),
        newKeys = newPinfo.definedNames.keys();
    // now that the body is scanned, forget all the new definitions
    newKeys.forEach(function(k){
                  if(prevKeys.indexOf(k) === -1) newPinfo.definedNames.remove(k);
                });
    return newPinfo;
 };
 
 // BINDING STRUCTS ///////////////////////////////////////////////////////
 function provideBindingId(symbl){ this.symbl = symbl;}
 function provideBindingStructId(symbl){ this.symbl = symbl; }

 //////////////////////////////////////////////////////////////////////////////
 // COLLECT PROVIDES //////////////////////////////////////////////////////////

 // extend the Program class to collect provides
 // Program.collectProvides: pinfo -> pinfo
 Program.prototype.collectProvides = function(pinfo){
    return pinfo;
 };
 provideStatement.prototype.collectProvides = function(pinfo){
    var that = this;
    // collectProvidesFromClause : pinfo clause -> pinfo
    function collectProvidesFromClause(pinfo, clause){
      // if it's a symbol, make sure it's defined (otherwise error)
// console.log('collecting from '+clause.toString());
      if (clause instanceof symbolExpr){
        if(pinfo.definedNames.containsKey(clause.val)){
          pinfo.providedNames.put(clause.val, new provideBindingId(clause));
          return pinfo;
        } else {
          throwError(new types.Message(["The name '"
                                        , new types.ColoredPart(clause.toString(), clause.location)
                                        , "', is not defined in the program, and cannot be provided."])
                     , clause.location);
        }
      // if it's an array, make sure the struct is defined (otherwise error)
      // NOTE: ONLY (struct-out id) IS SUPPORTED AT THIS TIME
      } else if(clause instanceof Array){
// console.log(pinfo.definedNames.get(clause[1].val));
          if(pinfo.definedNames.containsKey(clause[1].val) &&
             (pinfo.definedNames.get(clause[1].val) instanceof bindingStructure)){
              // add the entire bindingStructure to the provided binding, so we
              // can access fieldnames, predicates, and permissions later
              var b = new provideBindingStructId(clause[1], pinfo.definedNames.get(clause[1].val));
              pinfo.providedNames.put(clause.val, b);
              return pinfo;
          } else {
            throwError(new types.Message(["The name '"
                                          , new types.ColoredPart(clause[1].toString(), clause[1].location)
                                          , "', is not defined in the program, and cannot be provided"])
                       , clause.location);
          }
      // anything with a different format throws an error
      } else {
        throw "Impossible: all invalid provide clauses should have been filtered out!";
      }
    }
    return this.clauses.reduce(collectProvidesFromClause, pinfo);
  };
 
 //////////////////////////////////////////////////////////////////////////////
 // ANALYZE USES //////////////////////////////////////////////////////////////

 // extend the Program class to analyzing uses
 // Program.analyzeUses: pinfo -> pinfo
 Program.prototype.analyzeUses = function(pinfo, env){ return pinfo; };
 defVar.prototype.analyzeUses = function(pinfo, env){
    // if it's a lambda, extend the environment with the function, then analyze as a lambda
    if(this.expr instanceof lambdaExpr) pinfo.env.extend(bf(this.name.val, false, this.expr.args.length, false, this.location));
    return this.expr.analyzeUses(pinfo, pinfo.env);
 };
 defVars.prototype.analyzeUses = function(pinfo, env){
    return this.expr.analyzeUses(pinfo, pinfo.env);
 };
 beginExpr.prototype.analyzeUses = function(pinfo, env){
    return this.exprs.reduce(function(p, expr){return expr.analyzeUses(p, env);}, pinfo);
 };
 lambdaExpr.prototype.analyzeUses = function(pinfo, env){
    var env1 = pinfo.env,
        env2 = this.args.reduce(function(env, arg){
          return env.extend(new bindingConstant(arg.val, false, [], arg.location));
        }, env1);
    return this.body.analyzeUses(pinfo, env2);
 };
 localExpr.prototype.analyzeUses = function(pinfo, env){
    // remember previously used bindings, so we can revert to them later
    // in the meantime, scan the body
    var prevKeys = pinfo.usedBindingsHash.keys(),
        localPinfo= this.defs.reduce(function(pinfo, p){
                                        return p.analyzeUses(pinfo, env);
                                        }
                                        , pinfo),
        newPinfo  = this.body.analyzeUses(localPinfo, env),
        newKeys = newPinfo.usedBindingsHash.keys();
    // now that the body is scanned, forget all the new definitions
    newKeys.forEach(function(k){
                  if(prevKeys.indexOf(k) === -1) newPinfo.usedBindingsHash.remove(k);
                });
    return newPinfo;
 };
 callExpr.prototype.analyzeUses = function(pinfo, env){
    return [this.func].concat(this.args).reduce(function(p, arg){
                            return arg.analyzeUses(p, env);
                            }, pinfo);
 }
 ifExpr.prototype.analyzeUses = function(pinfo, env){
    var exps = [this.predicate, this.consequence, this.alternative];
    return exps.reduce(function(p, exp){
                            return exp.analyzeUses(p,env);
                            }, pinfo);
 };
 symbolExpr.prototype.analyzeUses = function(pinfo, env){
    if(env.lookup_context(this.val)){
      return pinfo.accumulateBindingUse(env.lookup_context(this.val), pinfo);
    } else {
      return pinfo.accumulateFreeVariableUse(this.val, pinfo);
    }
 };

 //////////////////////////////////////////////////////////////////////////////
 // COMPILATION ///////////////////////////////////////////////////////////////
 
 // extend the Program class to include compilation
 // compile: pinfo -> [bytecode, pinfo]
 Program.prototype.compile = function(pinfo){
    return [this.val, pinfo];
 };
 
 defVar.prototype.compile = function(env, pinfo){
  throw new unimplementedException("defVar.compile");
   /*    var compiledIdAndPinfo = compileExpression(this.name, env, pinfo),
    compiledId = compiledExpressionAndPinfo[0],
    pinfo = compiledExpressionAndPinfo[1];
    var compiledBodyAndPinfo = this.body.compile(env, pinfo),
    compiledBody = compiledBodyAndPinfo[0],
    pinfo = compiledBodyAndPinfo[1];
    var bytecode = bcode:make-def-values([compiledId], compiled-body);
    return [bytecode, pinfo];
    */
 };

 defVars.prototype.compile = function(env, pinfo){
  throw new unimplementedException("defVars.compile");
  /*    var compiledIdsAndPinfo = compileExpression(this.names, env, pinfo),
          compiledIds = compiledIdsAndPinfo[0],
          pinfo = compiledIdsAndPinfo[1];
      var compiledBodyAndPinfo = this.body.compile(env, pinfo),
          compiledBody = compiledBodyAndPinfo[0],
          pinfo = compiledBodyAndPinfo[1];
      var bytecode = bcode:make-def-values(compiledIds, compiled-body);
      return [bytecode, pinfo];
   */
 };
 
 beginExpr.prototype.compile = function(env, pinfo){
  throw new unimplementedException("beginExpr.compile");
  /*    var compiledExpressionsAndPinfo = compileExpressions(this.exprs, env, pinfo),
          compiledExpressions = compiledExpressionsAndPinfo[0],
          pinfo1 = compiledExpressionsAndPinfo[1];
      var bytecode = bcode:make-seq(compiledExpressions);
      return [bytecode, pinfo1];
   */
 };
 
 // Compile a lambda expression.  The lambda must close its free variables over the
 // environment.
 lambdaExpr.prototype.compile = function(env, pinfo){
  throw new unimplementedException("lambdaExpr.compile");
  /*    var freeVars = freeVariables(this.body,
                               foldl( (function(variable env){return env.push(variable)})
                                     , emptyEnv
                                     lambdaExpr.args));
      var closureVectorAndEnv = getClosureVectorAndEnv(this.args, freeVars, env),
          closureVector = closureVectorAndEnv[0],
          extendedEnv = closureVectorAndEnv[1];
      var compiledBodyAndPinfo = compileExpressionAndPinfo(this.body, extendedEnv, pinfo),
          compiledBody = compiledBodyAndPinfo[0],
          pinfo = compiledBodyAndPinfo[1];
      var lambdaArgs = new Array(this.args.length),
          closureArgs = new Array(closureVector.length);
      var bytecode = bcode:make-lam(null, [], lambdaExpr.args.length
                                    ,lambdaArgs.map((function(){return new symbolExpr("val");}))
                                    ,false
                                    ,closureVector
                                    ,closureArgs.map((function(){return new symbolExpr("val/ref");}))
                                    ,0
                                    ,compiledBody);
   */
    return [bytecode, pinfo];
 };
 
 localExpr.prototype.compile = function(env, pinfo){
  throw new unimplementedException("localExpr.compile");
 };
 
 callExpr.prototype.compile = function(env, pinfo){
  throw new unimplementedException("callExpr.compile");
 };
 
 ifExpr.prototype.compile = function(env, pinfo){
  throw new unimplementedException("ifExpr.compile");
  /*    var compiledPredicateAndPinfo = this.predicate.compile(env, pinfo),
          compiledPredicate = compiledPredicateAndPinfo[0],
          pinfo = compiledPredicateAndPinfo[1];
      var compiledConsequenceAndPinfo = this.consequence.compile(env, pinfo),
          compiledConsequence = compiledConsequenceAndPinfo[0],
          pinfo = compiledConsequenceAndPinfo[1];
      var compiledAlternateAndPinfo = this.alternative.comppile(env), pinfo),
          compiledAlternate = compiledAlternateAndPinfo[0],
          pinfo = compiledAlternateAndPinfo[1];
      var bytecode = bcode:make-branch(compiledPredicate, compiledConsequence, compiledAlternate);
      return [bytecode, pinfo];
   */
 };
 
 symbolExpr.prototype.compile = function(env, pinfo){
  throw new unimplementedException("symbolExpr.compile");
  /*    var stackReference = envLookup(env, expr.val), bytecode;
      if(stackReference instanceof localStackRef){
        bytecode = bcode:make-localref(localStackRef.boxed, localStackRef.depth, false, false, false);
      } else if(stackReference instanceof globalStackRef){
        bytecode = bcode:make-toplevel(globalStackRef.depth, globalStackRef.pos, false, false);
      } else if(stackReference instanceof unboundStackRef){
        throw "Couldn't find "+expr.val+" in the environment";
      }
      return [bytecode, pinfo];
   */
 };
 
 listExpr.prototype.compile = function(env, pinfo){}
 quotedExpr.prototype.compile = function(env, pinfo){}
 primop.prototype.compile = function(env, pinfo){}
 requireExpr.prototype.compile = function(pinfo){};
 provideStatement.prototype.compile = function(env, pinfo){};
 quasiquotedExpr.prototype.compile = function(env, pinfo){ throw "IMPOSSIBLE: quasiqoutedExpr should have been desugared"; }
 defStruct.prototype.compile = function(env, pinfo){ throw "IMPOSSIBLE: define-struct should have been desugared"; };
 letStarExpr.prototype.compile = function(env, pinfo){ throw "IMPOSSIBLE: letrec should have been desugared"; };
 letExpr.prototype.compile = function(env, pinfo){ throw "IMPOSSIBLE: let should have been desugared"; };
 letStarExpr.prototype.compile = function(env, pinfo){ throw "IMPOSSIBLE: let* should have been desugared"; };
 letStarExpr.prototype.compile = function(env, pinfo){ throw "IMPOSSIBLE: cond should have been desugared"; };
 andExpr.prototype.compile = function(env, pinfo){ throw "IMPOSSIBLE: and should have been desugared" };
 orExpr.prototype.compile = function(env, pinfo){ throw "IMPOSSIBLE: or should have been desugared"; };

/////////////////////////////////////////////////////////////
 function analyze(programs){
    return programAnalyzeWithPinfo(programs, compilerStructs.getBasePinfo("base"));
 }
 
 // programAnalyzerWithPinfo : [listof Programs], pinfo -> pinfo
 // build up pinfo by looking at definitions, provides and uses
 function programAnalyzeWithPinfo(programs, pinfo){
   // collectDefinitions: [listof Programs] pinfo -> pinfo
   // Collects the definitions either imported or defined by this program.
   function collectDefinitions(programs, pinfo){
     // FIXME: this does not yet say anything if a definition is introduced twice
     // in the same lexical scope.  We must do this error check!
     return programs.reduce((function(pinfo, p){
//                             console.log('collecting definitions for '+p);
                             return p.collectDefinitions(pinfo);
                             })
                            , pinfo);
   }
   // collectProvides: [listof Programs] pinfo -> pinfo
   // Walk through the program and collect all the provide statements.
   function collectProvides(programs, pinfo){
      return programs.reduce((function(pinfo, p){
                                return p.collectProvides(pinfo)
                              })
                             , pinfo);
   }
   // analyzeUses: [listof Programs] pinfo -> pinfo
   // Collects the uses of bindings that this program uses.
    function analyzeUses(programs, pinfo){
      return programs.reduce((function(pinfo, p){
                                return p.analyzeUses(pinfo, pinfo.env);
                              })
                             , pinfo);
    }
//    console.log("collecting definitions");
    var pinfo1 = collectDefinitions(programs, pinfo);
//    console.log("collecting provides");
    var pinfo2 = collectProvides(programs, pinfo1);
//    console.log("analyzing uses");
    return analyzeUses(programs, pinfo2);
 }
 
 // compile-compilation-top: program pinfo -> bytecode
 function compile(program, pinfo){
 
    throw new unimplementedException("top-level compile");
 
    // The toplevel is going to include all of the defined identifiers in the pinfo
    // The environment will refer to elements in the toplevel.
    var toplevelPrefixAndEnv = makeModulePrefixAndEnv(pinfo),
        toplevelPrefix = toplevelPrefixAndEnv[0],
        env = toplevelPrefixAndEnv[1];
 
    // pull out separate program components for ordered compilation
    var defns    = program.filter(isDefinition),
        requires = program.filter((function(p){return (p instanceof requireExpr);})),
        provides = program.filter((function(p){return (p instanceof provideStatement);})),
        exprs    = program.filter(isExpression);
    // [bytecodes, pinfo, env?] Program -> [bytecodes, pinfo]
    // compile the program, then add the bytecodes and pinfo information to the acc
    function compileAndCollect(acc, p){
      var compiledProgramAndPinfo = p.compile(acc[1]),
          compiledProgram = compiledProgramAndPinfo[0],
          pinfo = compiledProgramAndPinfo[1];
      return [[compiledProgram].concat(acc[0]), pinfo];
    }
 
    var compiledRequiresAndPinfo = requires.reduce(compileAndCollect, [[], pinfo]),
        compiledRequires = compiledRequiresAndPinfo[0],
        pinfo = compiledRequiresAndPinfo[1];
    var compiledDefinitionsAndPinfo = defns.reduce(compileAndCollect, [[], pinfo]),
        compiledDefinitions = compiledDefinitionsAndPinfo[0],
        pinfo = compiledDefinitionsAndPinfo[1];
    var compiledExpressionsAndPinfo = exprs.reduce(compileAndCollect, [[], pinfo]),
        compiledExpressions = compiledExpressionsAndPinfo[0],
        pinfo = compiledExpressionsAndPinfo[1];
 
    // generate the bytecode for the program and return it, along with the program info
    var bytecode = bcode-make-seq(compiledRequires.concat(compiledDefinitions, compiledExpressions));
    return [bcode-make-compilation-top(0, toplevel-prefix, bytecode), pinfo];
 }
 /////////////////////
 /* Export Bindings */
 /////////////////////
 window.analyze = analyze;
 window.compile = compile;
 window.desugar = desugarProgram;
})();

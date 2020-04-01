#lang scribble/manual

@title{closure-compile: Compile and compress JavaScript source with
the Google Closure Compiler}

@(require planet/scribble
          planet/version
          planet/resolver
          scribble/eval
          racket/sandbox
          racket/runtime-path
          (for-label racket/base)
          (for-label (this-package-in main)))


@(define-runtime-path main.rkt "main.rkt")

@(define my-evaluator
   (call-with-trusted-sandbox-configuration 
    (lambda ()
      (parameterize ([sandbox-output 'string]
                     [sandbox-error-output 'string])
        (make-evaluator 
         'racket/base
         #:requires
         (list main.rkt))))))

@;@(define my-evaluator
@;   (let ([p (resolve-planet-path `(planet , (this-package-version-symbol main)))])
@;     ((make-eval-factory (list `(file ,(path->string p)))))))
    
     
This library exposes the Google
@link["http://closure-compiler.googlecode.com"]{Closure compiler} to
Racket.

The module requires runtime access to Java; 
the value of @racket[(find-executable-path "java")] should point to a valid Java executable.


@defmodule/this-package[main]
@defproc[(closure-compile [code string?]
                          [compilation-level (or/c 'whitespace 'simple 'advanced) 'simple])
         string?]{
                  @racket[closure-compile] takes the given @racket[code] and passes it to the Closure compiler.  It should return a minified version of @racket[code].  @racket[compilation-level] adjusts the optimization that the Closure compiler will perform.
                   
                   If anything bad happens, it will raise an @racket[exn:fail] and hold the error message in the exception's @racket[exn-message].

                   @examples[#:eval my-evaluator 
                   (closure-compile "alert('hello ' + 'world');")
                   (closure-compile "{this should raise an error")
                   (closure-compile "alert('hello, I see: ' + (3 + 4) + '!');"
                                    'whitespace)
                   (closure-compile "alert('hello, I see: ' + (3 + 4) + '!');"
                                    'simple)
                   (closure-compile "
                       var f = function(x) { 
                           return x * x; 
                       };
                       alert( f(3) );")
                   (closure-compile "
                       var f = function(x) { 
                           return x * x; 
                       };
                       alert( f(3) );"
                                    'advanced)]
                   }


@section{Extended example}

Here's an extended example of a script that uses the package to
closure-compile all the @filepath{.js} files in a directory.

@codeblock|{
#lang racket/base
(require racket/path
         racket/file
         racket/cmdline
         (planet dyoo/closure-compile))

;; This program compresses all of the JavaScript files using Closure Compiler,
;; with simple optimizations.  All ".js" files (excluding the -min.js files)
;; get compressed here.
(define path (command-line #:args (p) p))

(define js-files (find-files
                  (lambda (p)
                    (and (file-exists? p)
                         (regexp-match #px".js$" (path->string (file-name-from-path p)))
                         (not (regexp-match #px"-min.js$" (path->string (file-name-from-path p))))))
                  (simplify-path path)))

;; out-of-date?: path path -> boolean
;; Returns true if the target file looks at least as new as the source file.
(define (out-of-date? source-file target-file)
  (cond
   [(not (file-exists? target-file))
    #t]
   [else
    (>= (file-or-directory-modify-seconds source-file)
        (file-or-directory-modify-seconds target-file))]))
     
(for ([file js-files])
   (define new-path (regexp-replace #px".js$" (path->string file) "-min.js"))
   (cond [(out-of-date? file new-path)
          (printf "Compressing ~s\n" (path->string file))
          (define text (file->string file))
          (define compressed (closure-compile text))
          (call-with-output-file new-path (lambda (op) (display compressed op)) #:exists 'replace)]
         [else
          (printf "Skipping ~s: up to date\n" file)]))
}|
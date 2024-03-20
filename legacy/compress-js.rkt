#!/usr/bin/env racket
#lang racket/base
(require racket/path
         racket/file
         racket/cmdline
         "main.rkt")

;; This program compresses all of the JavaScript files using Closure Compiler,
;; with simple optimizations.  All ".js" files (excluding the -min.js files)
;; get compressed here.

(define permissive? #f)
(define quiet? #f)
(define path (command-line #:once-each
                           [("-q" "--quiet") "Quiet mode" (set! quiet? #t)]
                           [("-p" "--permissive") "Permissive mode" (set! permissive? #t)]
                           #:args (path) path))

(define (notify . args)
  (unless quiet?
    (apply printf args)))

;; out-of-date?: path path -> boolean
;; Returns true if the target file looks at least as new as the source file.
(define (out-of-date? source-file target-file)
  (cond
   [(not (file-exists? target-file))
    #t]
   [else
    (>= (file-or-directory-modify-seconds source-file)
        (file-or-directory-modify-seconds target-file))]))


;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

(notify "Collecting files...\n")
(define js-files
  (find-files
   (lambda (p)
     (and (file-exists? p)
          (regexp-match #px".js$" (path->string (file-name-from-path p)))
          (not (regexp-match #px"[.-]min.js$" (path->string (file-name-from-path p))))
          ;; probably a more efficient way to do this, but I'm no regexp pro
          ;; we ONLY care about codemirror2/lib - nothing else
          (or (not (regexp-match #px"codemirror2" (path->string p)))
                   (regexp-match #px"codemirror2.lib" (path->string p)))))
   (simplify-path path)))

(for ([file js-files])
  (with-handlers ([exn:fail?
                   (lambda (exn)
                     (cond [permissive?
                            (notify "Exception while handling ~a:\n---\n~a\n---\n"
                                    (path->string file)
                                    (exn-message exn))]
                           [else
                            (raise exn)]))])    
    (define new-path (regexp-replace #px".js$" (path->string file) "-min.js"))
    (cond [(out-of-date? file new-path)
           (notify "Compressing ~s\n" (path->string file))
           (define text (file->string file))
           (define compressed (closure-compile text))
           (call-with-output-file new-path (lambda (op)
                                             (display compressed op))
                                  #:exists 'replace)]
          [else
           (notify "Skipping ~s: up to date\n" file)])))


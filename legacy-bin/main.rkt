#lang racket/base
(require racket/contract
         racket/runtime-path
         racket/port)

(provide/contract
 [closure-compile ((string?) 
                   ((one-of/c 'whitespace
                              'simple
                              'advanced)) . ->* . string?)])

(define (closure-compile code [compilation-level "simple"])
  (let ([marks (current-continuation-marks)]
        [compiled-code-port (open-output-string)]
        [error-port (open-output-string)])
    (raw-compile-js (open-input-string code)
                    compiled-code-port
                    error-port
                    #:compilation-level compilation-level)
    (let ([compiled (get-output-string compiled-code-port)])
      (cond
        [(maybe-erroneous? compiled)
         (let ([errors (get-output-string error-port)])
           (cond [(string=? errors "")
                  compiled]
                 [else
                  (raise (make-exn:fail (format "closure-compile: ~a" errors)
                                        marks))]))]
        [else
         compiled]))))


(define (maybe-erroneous? result)
  (string=? result ""))

(define (raw-compile-js ip op err
                        #:compilation-level (compilation-level "simple"))
  (let-values
      ([(subp inp outp errp)
    (subprocess #f #f #f
        "/usr/local/bin/node" "./node_modules/google-closure-compiler/cli.js" 
        "--compilation_level" compilation-level
        "--strict_mode_input" "false")])

    (thread (lambda ()
              (copy-port ip outp)
              (close-output-port outp)))
    (thread (lambda ()
              (copy-port inp op)))
    (thread (lambda ()
              (copy-port errp err)))
    (subprocess-wait subp)))

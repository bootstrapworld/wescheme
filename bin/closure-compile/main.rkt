#lang racket/base
(require racket/contract
         racket/runtime-path
         racket/port)

;; TODO: use the information in 
;;
;; http://closure-compiler.googlecode.com/svn/trunk/javadoc/index.html
;; and 
;; http://www.ioncannon.net/programming/1447/using-the-google-closure-compiler-in-java/
;;
;; so we don't have to fork java on each compilation request.  We should use a long-running
;; Java process to do this.


(define java-path (find-executable-path "java"))
(define-runtime-path jar-path "compiler.jar")


(provide/contract
 [closure-compile ((string?) 
                   ((one-of/c 'whitespace
                              'simple
                              'advanced)) . ->* . string?)])


;; Let's make sure to error out predictably if Java doesn't exist.
(unless (path? java-path)
  (error 'closure-compile "Unable to find Java in the current PATH."))




(define (closure-compile code [compilation-level 'simple])
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


;; Optimization levels.
;; compilation-level->string: symbol -> string
(define (compilation-level->string level)
  (case level
    [(whitespace) "WHITESPACE_ONLY"]
    [(simple) "SIMPLE_OPTIMIZATIONS"]
    [(advanced) "ADVANCED_OPTIMIZATIONS"]))


(define (raw-compile-js ip op err
                        #:compilation-level (compilation-level 'simple))
  (let-values
      ([(subp inp outp errp)
        (subprocess #f #f #f
                    java-path "-jar" jar-path
                    "--strict_mode_input=false"
                    "--compilation_level" (compilation-level->string
                                           compilation-level))])
    (thread (lambda ()
              (copy-port ip outp)
              (close-output-port outp)))
    (thread (lambda ()
              (copy-port inp op)))
    (thread (lambda ()
              (copy-port errp err)))
    (subprocess-wait subp)))

#lang setup/infotab

(define scribblings '(("manual.scrbl")))
(define name "closure-compile")
(define primary-file "main.rkt")
(define categories '(devtools))
(define can-be-loaded-with 'all)
(define required-core-version "5.1.1")
(define version "1.3")
(define repositories '("4.x"))
(define blurb 
  '("Compile and compress JavaScript source with the Google Closure Compiler."))
(define release-notes
  '((p "Updated compiler.jar file to more recent version.")))

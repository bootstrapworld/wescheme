#!/usr/bin/env racket
#lang racket/base
(require racket/file
         racket/runtime-path
         racket/path
         racket/port
         net/url
         (for-syntax racket/base))

;; out-of-date?: path path -> boolean
;; Returns true if the target file looks at least as new as the source file.
(define (out-of-date? source-file target-file)
  (cond
   [(not (file-exists? target-file))
    #t]
   [else
    (>= (file-or-directory-modify-seconds source-file)
        (file-or-directory-modify-seconds target-file))]))

;; an abstraction over making system calls
(define (call-system #:pipe-input-from (pipe-input-from #f)
                     #:pipe-output-to (pipe-output-to #f)
                     cmd . args)
  (define stdin (if pipe-input-from
                    (open-input-file pipe-input-from)
                    (current-input-port)))
  (define stdout (if pipe-output-to
                     (begin
                       (unless (let-values ([(base path dir?) (split-path pipe-output-to)])
                                 (eq? base 'relative))
                         (make-directory* (path-only pipe-output-to)))
                       (open-output-file pipe-output-to #:exists 'replace))
                     (current-output-port)))

  (define resolved-cmd-standard
    (if (file-exists? cmd) cmd
      (find-executable-path cmd)))

  (define resolved-cmd-windows
    (and (equal? (system-type) 'windows)
         (and (string? cmd)
              (find-executable-path (string-append cmd ".exe")))))

  (define resolved-cmd
    (or resolved-cmd-standard resolved-cmd-windows))

  (unless resolved-cmd
    (error 'build (format "I could not find ~s in your PATH" cmd)))

  (define-values (a-subprocess subprocess-in subprocess-out subprocess-err)
    (apply subprocess stdout stdin (current-error-port) resolved-cmd args))

  (subprocess-wait a-subprocess)


  (unless (equal? (subprocess-status a-subprocess) 0)
      (error 'build (format "I could not launch ~s" cmd)))


  (when pipe-input-from
    (close-input-port stdin))
  (when pipe-output-to
    (close-output-port stdout)))


;; run the closure compiler with all of js-src and the closure library as possible dependencies,
;; using the passed src file as the entry point. Prune dependencies and quiet warnings about strict mode
;; NOTE: there are some [JSC_UNREACHABLE_CODE] warnings that we are silencing
(define (build src dest)
  (make-directory* (path-only (string-append "static/js/" dest "-new.js")))
  ;(fprintf (current-error-port) (string-append "about to call closure compiler on ./js-src/" src "\n"))
  (call-system "zsh" "-c"
    (string-append "node ./node_modules/google-closure-compiler/cli.js \
      --js js-src/**/*.js \
      --js node_modules/google-closure-library/**/*.js  \
      --dependency_mode PRUNE \
      --strict_mode_input false \
      --warning_level QUIET \
      --entry_point ./js-src/" src)
    #:pipe-output-to (string-append "static/js/" dest "-new.js"))

  (update-compiled-libs! (string-append "static/js/" dest "-new.js")
                        (string-append "static/js/" dest ".js")))

(define (generate-js-runtime!)
  (call-system "bash" "./legacy/generate-js-runtime.sh"))

;; move a fresh copy of CM - and the addons we need - to ./static/codemirror/lib
(define (update-codemirror-lib!)
  (call-system "mkdir" "-p" "./static/codemirror")
  (call-system "cp" "-r" "./node_modules/codemirror/lib/" "./static/codemirror/")
  (call-system "mkdir" "-p" "./static/codemirror/addon")
  (call-system "cp" "-r" "./node_modules/codemirror/addon/edit/" "./static/codemirror/addon/edit")
  (call-system "cp" "-r" "./node_modules/codemirror/addon/runmode/" "./static/codemirror/addon/runmode"))

(define (nodelibs-installed?)
  (and (directory-exists? (build-path "node_modules" "codemirror"))
       (directory-exists? (build-path "node_modules" "google-closure-library"))
       (directory-exists? (build-path "node_modules" "google-closure-compiler"))))

(define (ensure-nodelibs-installed!)
  (unless (nodelibs-installed?)
    (fprintf (current-error-port) "At least one node dependency is missing.\n  Trying to run: npm install...\n")
    (call-system "npm" "install")

    (unless (nodelibs-installed?)
      (fprintf (current-error-port) "Node dependencies could not be installed.  Exiting.\n")
      (exit 0))))


(define (update-compiled-libs! new-path old-path)
  (call-system "bash" "./legacy/update-compiled-files.sh" new-path old-path))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(ensure-nodelibs-installed!)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(generate-js-runtime!)
(update-compiled-libs!  "static/mzscheme-vm/support-new.js"
                        "static/mzscheme-vm/support.js")

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(if (out-of-date? "./node_modules/codemirror/lib/codemirror.js"
                  "./static/codemirror/lib/codemirror.js")
  (begin
    (printf "Updating CodeMirror and copying lib\n")
    (update-codemirror-lib!))
  (printf "CodeMirror is up to date\n"))

;; ######################################################################
(printf "Building splash\n")
(build "splash.js" "splash-calc")

(printf "Building console\n")
(build "console.js" "console-calc")

(printf "Building view\n")
(build "view.js" "view-calc")

(printf "Building run\n")
(build "run.js" "run-calc")

(printf "Building editor\n")
(build "openEditor/index.js" "openEditor/openEditor-calc")

(printf "Building compiler\n")
(build "compiler/index.js" "compiler/compiler-calc")

;; ######################################################################
(printf "Compressing JavaScript libraries.  This may take a few minutes, depending if this is the first time this has been run.\n")
(call-system "racket" "legacy/compress-js.rkt" #;"--quiet" "--permissive" "static")

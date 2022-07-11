#!/usr/bin/env racket
#lang racket/base
(require racket/file
         racket/runtime-path
         racket/path
         racket/port
         net/url
         (for-syntax racket/base))

(define-runtime-path closure-dir (build-path "node_modules" "google-closure-library" "closure" "goog" ))
(define-runtime-path codemirror-src-dir (build-path "node_modules" "codemirror"))
(define-runtime-path codemirror-dest-dir (build-path "war" "js" "codemirror"))

(define appengine-version "1.9.60")
(define appengine-url
  (format "https://storage.googleapis.com/appengine-sdks/featured/appengine-java-sdk-~a.zip" appengine-version))
(define appengine-zip-path
  (build-path "externals" (format "appengine-java-sdk-~a.zip" appengine-version)))
(define appengine-dir
  (build-path "lib" (format "appengine-java-sdk-~a" appengine-version)))

(define googauth-version "1.34.1")
;; We don't download a specific client, we download an assembly zip which has some double-versioning labeling convention
(define googauth-assembly-version 
  (format "~a-~a" googauth-version googauth-version))
(define googauth-url
;; ie:     https://repo1.maven.org/maven2/com/google/oauth-client/google-oauth-client-assembly/1.34.1/google-oauth-client-assembly-1.34.1-1.34.1.zip
  (format "https://repo1.maven.org/maven2/com/google/oauth-client/google-oauth-client-assembly/~a/google-oauth-client-assembly-~a.zip" googauth-version googauth-assembly-version))
(define googauth-assembly-zip-path
  (build-path "externals" (format "google-oauth-client-assembly-~a.zip" googauth-assembly-version )))
(define googauth-dir
  (build-path "lib" "google-oauth-java-client"))

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


;; run the closure compiler with all of war-src and the closure library as possible dependencies,
;; using the passed src file as the entry point. Prune dependencies and quiet warnings about strict mode
(define (build src dest)
  (make-directory* (path-only (string-append "war/" dest "-new.js")))
  (fprintf (current-error-port) (string-append "about to call closure compiler on ./war-src/js/" src "\n"))
  (call-system "zsh" "-c"
    (string-append "node ./node_modules/google-closure-compiler/cli.js \
      --js war-src/js/**/*.js \
      --js node_modules/google-closure-library/**/*.js  \
      --dependency_mode PRUNE \
      --strict_mode_input false \
      --warning_level QUIET \
      --entry_point ./war-src/js/" src)
    #:pipe-output-to (string-append "war/js/" dest "-new.js"))

  (update-compiled-libs! (string-append "war/js/" dest "-new.js")
                        (string-append "war/js/" dest ".js")))

(define (generate-js-runtime!)
  (call-system "bash" "./generate-js-runtime.sh"))

;; cd into CM, build a fresh copy, then move it to war/js/codemirror/lib
(define (update-codemirror-lib!)
  (current-directory "war-src/js/codemirror/")
  (current-directory "../../../")
  (unless (directory-exists? codemirror-dest-dir)
    (make-directory* codemirror-dest-dir))
  (call-system "cp" "-r" "./node_modules/codemirror/lib" "./war/js/codemirror/")
  (call-system "mkdir" "-p" "./war/js/codemirror/addon")
  (call-system "cp" "-r" "./node_modules/codemirror/addon/edit/" "./war/js/codemirror/addon/edit")
  (call-system "cp" "-r" "./node_modules/codemirror/addon/runmode/" "./war/js/codemirror/addon/runmode"))

(define (ensure-codemirror-installed!)
  (unless (directory-exists? codemirror-src-dir)
    (fprintf (current-error-port) "The node dependency 'Codemirror' hasn't been installed.\n  Trying to run: npm install...\n")
    (call-system "npm" "install")

    (unless (directory-exists? codemirror-src-dir)
      (fprintf (current-error-port) "Codemirror could not be installed.  Exiting.\n")
      (exit 0)))

  (unless (file-exists? "./node_modules/codemirror/lib/codemirror.js")
    (fprintf (current-error-port) "Codemirror hasn't built.\n  Trying to run: npm install now...\n")
    (call-system "npm" "install")))

(define (ensure-appengine-installed!)
  (unless (directory-exists? appengine-dir)
    (fprintf (current-error-port)
             "The Google AppEngine API hasn't been installed yet.\n")
    (cond [(file-exists? appengine-zip-path)
           (void)]
          [else
           (fprintf (current-error-port)
                    "Trying to download it now... saving to ~s\n" appengine-zip-path)
           (fprintf (current-error-port)
           ;; NOTE: I think it might be larger than 90 MB now... Might want to change this
                    "(This will take a while; the API download is about 90 MB.)\n")
           (call-with-output-file appengine-zip-path
             (lambda (op)
               (define ip (get-pure-port (string->url appengine-url)))
               (copy-port ip op)
               (close-input-port ip)
               (close-output-port op)))])
    (fprintf (current-error-port)
             "The API will be installed in: ~s" appengine-dir)
    (sleep 5)
    (unless (directory-exists? (build-path appengine-dir 'up))
      (make-directory* (build-path appengine-dir 'up)))
    (let ([zip-path (normalize-path appengine-zip-path)])
      (parameterize ([current-directory (build-path appengine-dir 'up)])
        (call-system "unzip" (path->string zip-path))))
    (unless (directory-exists? appengine-dir)
      (fprintf (current-error-port) "The Google AppEngine library could not be installed; please check.\n")
      (exit 0))
    (fprintf (current-error-port)
             "Google AppEngine API installed.\n")))

(define (ensure-googauth-installed!)
  (unless (directory-exists? googauth-dir)
    (fprintf (current-error-port)
             "The Google OAuth Java Client hasn't been installed yet.\n")
    (cond [(file-exists? googauth-assembly-zip-path)
           (void)]
          [else
           (fprintf (current-error-port)
                    "Trying to download it now... saving to ~s\n" googauth-assembly-zip-path)
           (fprintf (current-error-port)
                    "(This might take a while; the API download is about 10 MB.)\n")
           (call-with-output-file googauth-assembly-zip-path
             (lambda (op)
               (define ip (get-pure-port (string->url googauth-url)))
               (copy-port ip op)
               (close-input-port ip)
               (close-output-port op)))])
    (fprintf (current-error-port)
             "Google OAuth will be installed in: ~s" googauth-dir)
    (sleep 5)
    (unless (directory-exists? (build-path googauth-dir 'up))
      (make-directory* (build-path googauth-dir 'up)))
    (let ([zip-path (normalize-path googauth-assembly-zip-path)])
      (parameterize ([current-directory (build-path googauth-dir 'up)])
        (call-system "unzip" (path->string zip-path))))
    (unless (directory-exists? googauth-dir)
      (fprintf (current-error-port) "Google OAuth library could not be installed; please check.\n")
      (exit 0))
    (fprintf (current-error-port)
             "Google OAuth library installed.\n")))

(define (update-compiled-libs! new-path old-path)
  (call-system "bash" "./update-compiled-files.sh" new-path old-path))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(ensure-codemirror-installed!)
(ensure-appengine-installed!)
(ensure-googauth-installed!)

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(generate-js-runtime!)
(update-compiled-libs!  "war/js/mzscheme-vm/support-new.js"
                        "war/js/mzscheme-vm/support.js")

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(if (out-of-date? "./node_modules/codemirror/lib/codemirror.js"
                  "./war/js/codemirror/lib/codemirror.js")
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
(call-system "racket" "bin/compress-js.rkt" #;"--quiet" "--permissive" "war")

#!/usr/bin/env racket
#lang racket/base
(require racket/file
         racket/runtime-path
         racket/path
         racket/port
         net/url
         (for-syntax racket/base))


;; Assumes closure-library is under externals/closure.

(define-runtime-path closure-dir (build-path "war-src" "closure"))
;(define-runtime-path closure-zip-path (build-path "externals" "closure-library-20111110-r1376.zip"))

(define-runtime-path codemirror-src-dir (build-path "node_modules" "codemirror"))
(define-runtime-path codemirror-dest-dir (build-path "war" "js" "codemirror"))

(define appengine-version "1.9.60")
(define appengine-url
  (format "https://storage.googleapis.com/appengine-sdks/featured/appengine-java-sdk-~a.zip" appengine-version))
(define appengine-zip-path
  (build-path "externals" (format "appengine-java-sdk-~a.zip" appengine-version)))
(define appengine-dir
  (build-path "lib" (format "appengine-java-sdk-~a" appengine-version)))

;; out-of-date?: path path -> boolean
;; Returns true if the target file looks at least as new as the source file.
(define (out-of-date? source-file target-file)
  (cond
   [(not (file-exists? target-file))
    #t]
   [else
    (>= (file-or-directory-modify-seconds source-file)
        (file-or-directory-modify-seconds target-file))]))

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


(define (build src dest)
  (make-directory* (path-only (string-append "war/" dest "-new.js")))
  (call-system "node"
               "node_modules/calcdeps/bin/calcdeps"
               "-i" (string-append "war-src/js/" src)
               "-p" (path->string closure-dir)
               "-p" "war-src/js"
               "-o" "script"
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

#|
(define (ensure-closure-library-installed!)
  (unless (directory-exists? closure-dir)
    (fprintf (current-error-port) "The Closure library has not been installed yet.\n")
    (fprintf (current-error-port) "Trying to unpack it into 'war-src/closure'.\n")
    (let ([zip-path (normalize-path closure-zip-path)])
      (parameterize ([current-directory (build-path closure-dir 'up)])
        (call-system "unzip" (path->string zip-path))))
    (unless (directory-exists? closure-dir)
      (fprintf (current-error-port) "The Closure library could not be installed; please check.\n")
      (exit 0))))
|#
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


(define (update-compiled-libs! new-path old-path)
  (call-system "bash" "./update-compiled-files.sh" new-path old-path))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(ensure-codemirror-installed!)
;(ensure-closure-library-installed!)
(ensure-appengine-installed!)


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

#|
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(printf "Writing dependency file for Google Closure library\n")
(parameterize ([current-directory "war-src"])
  (call-system "node"
               "../node_modules/calcdeps/bin/calcdeps"
               "--dep" "closure"
               "--path" "js"
               "--output_mode" "deps"
               #:pipe-output-to "deps.js"))
|#


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

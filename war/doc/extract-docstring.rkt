#lang racket/base
(require setup/xref
         scribble/xref
         racket/match
         racket/path
         racket/promise
         racket/runtime-path
         xml
         "tree-cursor.rkt")


(provide extract-doc-sexp/id
         extract-doc-sexp/tag
         doc-sexp->string)

(define-runtime-path lifted-images "lifted-images")

(unless (directory-exists? lifted-images)
  (make-directory lifted-images))



;; lift-image: path -> path
;; Relocates the image relative to the lifted-images directory of this program.
(define lift-image-counter 0)
(define (lift-image path)
  (define-values (base name dir?) (split-path path))
  (set! lift-image-counter (add1 lift-image-counter))
  (define lifted-path (build-path lifted-images
                                  (string-append
                                   (number->string lift-image-counter)
                                   "_"
                                   (path->string name))))
  (copy-file path lifted-path #t)

  (build-path "lifted-images"
              (string-append
               (number->string lift-image-counter)
               "_"
               (path->string name))))

  



(define XREF-promise (delay (load-collections-xref)))

(define cache (make-weak-hash))


(define (extract-doc-sexp/id id #:phase (phase #f)
                                #:xref (xref (force XREF-promise)))
  (define a-tag (xref-binding->definition-tag xref id phase))  
  (unless a-tag
    (error 'extract-docstring "Unable to locate documentation for ~s" id))

  (extract-doc-sexp/tag a-tag #:xref xref))

(define (xexpr->xexp e)
  (match e
    [`(,tag () ,content ...) `(,tag ,@(map xexpr->xexp content))]
    [`(,tag (,attrs ...) ,content ...) `(,tag (@ ,@attrs) ,@(map xexpr->xexp content))]
    [(or `nbsp) `(& ,e)]
    [(? number? n) (integer->char n)]
    [e e]))

(define (extract-doc-sexp/tag a-tag #:xref (xref (force XREF-promise)))  
  (define-values (path anchor)
    (xref-tag->path+anchor xref a-tag))

  (unless (and path anchor)
    (error 'extract-docstring "Unable to find specific-enough documentation"))
    
  ;; KLUDGE AHEAD
  ;; I would love to know if there's a better way to extract the documentation.
  ;; As it is, I'm treating the HTML output as ground truth.
  
  ;; Here's the basic idea: we find the anchor, rewind to the last known SIntrapara,
  ;; then play things forward until we hit the next anchor (or we hit the end of the document).
  ;; It's atrocious, but I don't think I have a good
  ;; alternative at this time.
  
  (define sxml (hash-ref! cache path (lambda ()
    (xexpr->xexp (xml->xexpr (document-element
      (call-with-input-file path read-xml)))))))
  (define my-cursor (sexp->cursor sxml))
  (define cursor-at-anchor
    (navigate-to-anchor my-cursor anchor))
  (unless cursor-at-anchor
    (error 'extract-docstring "Unable to locate documentation for ~s" a-tag))
  
  (define-values (content-up-to-anchor at-docs) 
    (up-to-sintrapara-or-svinsetflow anchor cursor-at-anchor))

  ;; At this point, we just walk right, starting from the signature,
  ;; past the docs, till we hit another anchored node.
  (normalize-image-srcs
   (cons 'div
        (append content-up-to-anchor
   
                (cond [(or (cursor-right? at-docs) (cursor-after? at-docs))
                       (let loop ([c (if (cursor-right? at-docs)
                                         (cursor-right at-docs)
                                         (cursor-after at-docs))])
                         (cond
                           [(has-anchor? (cursor-node c))
                            '()]
                           [(cursor-right? c)
                            (cons (cursor-node c)
                                  (loop (cursor-right c)))]
                           [(cursor-after? c)
                            (loop (cursor-after c))]
                           [else
                            (list (cursor-node c))]))]
                      [else
                       '()])))
   (path-only path)))

;;(define (cursor-after? c)
;;  (and (cursor-down?

;; finds the points where the signature and the documentation begin.
(define (up-to-sintrapara-or-svinsetflow anchor c)
  (define at-documentation-start (let loop ([c c])
                                   (match (cursor-node c)
                                     [(list 'div (list '@ (list 'class "SIntrapara"))
                                            elts ...)
                                      c]
                                     [(list 'blockquote (list '@ (list 'class "SVInsetFlow"))
                                            elts ...)
                                      c]
                                     [(list 'p elts ...)
                                      c]
                                     [else
                                      (loop (cursor-succ c))])))
  ;; We want to capture the material at the anchor as well.
  (define content-up-to-anchor
    (reverse
     (let loop ([c at-documentation-start])
       (cond [(has-anchor? (cursor-node c) anchor)
              (list (cursor-node c))]
             [else
              (cons (cursor-node c)
                    (loop (cursor-left c)))]))))
  (values content-up-to-anchor at-documentation-start))


;; Focuses the cursor or the anchor with the given name.
(define (navigate-to-anchor c anchor)
  (match (cursor-node c)
    [(list 'a (list '@  (list 'name (? (lambda (x)
                                         (equal? anchor x))))))
     c]
    [else
     (cond [(cursor-succ? c)
            (navigate-to-anchor (cursor-succ c) anchor)]
           [else
            #f])]))


;; Produces true if we've got an anchor.
(define (has-anchor? sexp (-name #f))
  (let loop ([cursor (sexp->cursor sexp)])
    (match (cursor-node cursor)
      [(list 'a (list '@  (list 'name (and name
                                           (? (lambda (name)
                                                (if -name
                                                    (equal? name -name)
                                                    #t)))))))
       #t]
      [else
       (cond [(cursor-succ? cursor)
              (loop (cursor-succ cursor))]
             [else
              #f])])))

(define (normalize-image-srcs sexp base-path)
  (define (calc-src src)
    (cond
      [(regexp-match? #px"(http:|https:)" src) src]
      [else (path->string (lift-image (simple-form-path
              (build-path base-path src))))]))
  (let loop ([sexp sexp])
    (match sexp
      [(or `(,(and name 'object) (@ ,pre ... (,(and field 'data) ,src) ,post ...) ,rest ...)
           `(,(and name 'img)    (@ ,pre ... (,(and field 'src)  ,src) ,post ...) ,rest ...))
       `(,name (@ ,@pre (,field ,(calc-src src)) ,@post) ,@(map loop rest))]
      [(list tag rest ...)
       (cons tag (map loop rest))]
      [(? string?)
       sexp]
      [(? char?)
       sexp]
      [(? symbol?)
       sexp]
      [else
       (error 'normalize-image-srcs "Unexpected value: ~s" sexp)])))




(define (doc-sexp->string sexp)
  (define op (open-output-string))
  (let loop ([sexp sexp])
    (match sexp
      [(list 'tr  body ...)
       (for-each loop body)
       (newline op)]
      [(list 'th body ...)
       (for-each loop body)
       (newline op)]
      [(list 'div body ...)
       (for-each loop body)
       (newline op)]
      [(list '@ rest ...)
       (void)]
      [(list element-name body ...)
       (for-each loop body)]
      [(? string?)
       (display sexp op)]
      [(? char?)
       (display sexp op)]
      [(? symbol?)
       (display (translate-symbol sexp) op)]
      [else
       (error 'doc-sexp->string "Unexpected value: ~s" sexp)]))
  (get-output-string op))
    


(define (translate-symbol sexp)
  (case sexp
    [(nbsp) " "]
    [(rarr) "->"]
    [(rsquo) "'"]
    [(ldquo) "``"]
    [(rdquo) "''"]
    [(ndash) "-"]
    [else
     (error 'translate-symbol "Don't know how to translate ~s" sexp)]))

;#lang scheme/gui
;
;(require (lib "world.ss" "htdp")
;         (lib "prim.ss" "lang")
;         lang/prim
;         htdp/world
;         htdp/image
;         (except-in htdp/testing test)
;         (for-syntax scheme/base))
;(provide circle triangle rectangle ellipse star line text place-image empty-scene EXAMPLE)
;
;(provide-higher-order-primitive start (rocket-height))

(provide start)


; dimensions: 
(define WIDTH  200)
(define HEIGHT 600)
(define IMAGE0 (empty-scene WIDTH HEIGHT))

(define source (bitmap/url "http://www.wescheme.org/images/teachpacks2012/rocket.png"))
(define ROCKET source)

;; -----------------------------------------------------------------------------
;; draw-world: Number -> Image 
;; create an image that represents the world 
(define (draw-world w)
  (text-add (car w) ((cdr w) (car w)) (rocket-add w IMAGE0)))

;; text-add : Number Image -> Image
;; add the height of the rocket and the time elapsed to the image
(define (text-add time height IMAGE0)
  (place-image (text (string-append "Time: " (number->string time)) 14 (make-color 41 128 38))
               60
               15 
               (place-image (text (string-append "Height: " (number->string height)) 14 (make-color 38 38 128))
                            60
                            30
                            IMAGE0)))

;; rocket-add : Number Image -> Image 
;; add the satellite to the image assuming w seconds since start of simulation
(define (rocket-add w IMAGE0)
  (place-image ROCKET 100 (- (- HEIGHT ((cdr w) (car w))) (/ (image-height source) 2)) IMAGE0))


;; (Number (Number -> Number)) Symbol -> (Number (Number -> Number))
;; add 1 to the current time
(define (tock w ke)
  (cond
    [(key=? ke #\space) (cons (+ 1 (car w)) (cdr w))]
    [else w]))

(define (start rocket-height)
  (big-bang (cons 0 rocket-height)
	    (on-key tock)
	    (on-redraw draw-world)))


;; a `test' macro that is a synonym for `check-expect', catches expansion
;; errors and pretends that they come from `test'.
;(require (for-syntax syntax/kerncase))
;(define-syntax (EXAMPLE stx)
;  (syntax-case stx ()
;    [(_ x ...)
;     (with-handlers ([exn? (lambda (e)
;                             (raise (make-exn
;                                     (regexp-replace*
;                                      #rx"check-expect"
;                                      (exn-message e)
;                                      "test")
;                                     (exn-continuation-marks e))))])
;       (local-expand (syntax/loc stx (check-expect x ...))
;                     (syntax-local-context)
;                     (kernel-form-identifier-list)))]))















(provide  sq sine cosine tangent
          pick subset? in?
          type
          ;; (dyoo: warn disabled because WeScheme doesn't properly
          ;;  handle vararity functions yet)
          ;; warn
          number->image string->image boolean->string boolean->image overlay-at
          clipart/url color->alpha)

;; warn : any* -> any, and a side effect.
;; display all arguments and return the last one.
                                        ;(define (warn . args)
                                        ;(begin
                                        ;  (map display args)
                                        ;  (newline)
                                        ;  (last args)))

;; type : any -> String
(define (type obj)
  (cond
   [(procedure? obj) "Function"]
   [(number? obj) "Number"]
   [(string? obj) "String"]
   [(image? obj) "Image"]
   [(boolean? obj) "Boolean"]
   [(posn? obj) "Position"]
   [(symbol? obj) "Symbol"]
   [(list? obj) "List"]
   [(pair? obj) "Pair"]
   [(struct? obj) "Structure"]
   [else "I don't know."]))


;;; color-object->color-struct Color% -> Color
                                        ;(define (color-object->color-struct c)
                                        ;  (if ((is-a?/c color%) c)
                                        ;      (make-color (send c red) (send c green) (send c blue) 255)
                                        ;      c))

;; color-near? : Color Color Number -> Boolean
;; Is the first color within tolerance of the second?
(define (color-near? a b tolerance)
  (and (< (abs (- (color-red   a) (color-red   b))) tolerance)
       (< (abs (- (color-green a) (color-green b))) tolerance)
       (< (abs (- (color-blue  a) (color-blue  b))) tolerance)
       (< (abs (- (color-alpha a) (color-alpha b))) tolerance)))

;; color=? : Color Color -> Boolean
;; Is the first color the same as the second?
(define (color=? a b)
  (and (equal? (color-red   a) (color-red   b))
       (equal? (color-green a) (color-green b))
       (equal? (color-blue  a) (color-blue  b))
       (equal? (color-alpha a) (color-alpha b))))



;; find-color : String/Color -> Color
;; If the given color is expressed as a string or a color% object, turn it 
;; into a color struct, otherwise use it as is.
                                        ;(define (find-color color-name)
                                        ;  (color-object->color-struct
                                        ;   (if (string? color-name)
                                        ;       (send the-color-database find-color color-name)
                                        ;       color-name)))

(define (find-color x)
  (cond
   [(string? x)
    (name->color x)]
   [else
    x]))


(define (imgvec-location x y w h)
  (+ (* y w) x))

(define (imgvec-adjacent-points imgvec loc width height)
  (let ((x (remainder loc width))
        (y (floor (/ loc width)))
        (loc (lambda (x y) (imgvec-location x y width height))))
    (append
     (if (< 0 x) (list (loc (- x 1) y)) '())
     (if (< 0 y) (list (loc x (- y 1))) '())
     (if (< x (- width 1)) (list (loc (+ x 1) y)) '())
     (if (< y (- height 1)) (list (loc x (+ y 1))) '()))))

(define (color-connected-points imgvec width height start-x start-y start-color tolerance)
  (let ((queue (list (imgvec-location start-x start-y width height)))
        (seen (make-hash))
        (good '()))
    (begin
      (letrec ([loop
                (lambda ()
                  (when (not (empty? queue))
                    (let ((it (car queue)))
                      (begin
                        (set! queue (cdr queue))
                        (when (not (hash-ref seen it #f))
                          (begin
                            (hash-set! seen it #t)
                            (set! good (cons it good))
                            (set! queue 
                                  (append queue
                                          (filter (lambda (loc) 
                                                    (color-near? (vector-ref imgvec loc) start-color tolerance))
                                                  (imgvec-adjacent-points imgvec it width height))))))
                        (loop)))))])
        (loop))
      good)))

(define (fill-from-point! img start-x start-y source-color destination-color tolerance dust-size)
  (let* ((v (list->vector (image->color-list img)))
         (width (image-width img))
         (height (image-height img))
         (c (if source-color 
                (find-color source-color)
                (vector-ref v (imgvec-location start-x start-y width height))))
         (d (find-color destination-color)))
    (begin
      (when (not (color=? c d))
        (for-each (lambda (loc) (vector-set! v loc d))
                  (color-connected-points v width height start-x start-y c tolerance)))
      (color-list->bitmap (vector->list v) width height))))

(define (transparent-from-corner img tolerance)
  (fill-from-point! img 0 0 #f (make-color 0 0 0 0) tolerance 0))
(define (transparent-from-corners img tolerance)
  (let ((xprt (make-color 0 0 0 0))
        (start-color #f)
        (jaggies 0)
        (w-1 (- (image-width img) 1))
        (h-1 (- (image-height img) 1)))
    (fill-from-point! 
     (fill-from-point!
      (fill-from-point!
       (fill-from-point! img 0 0 start-color xprt tolerance jaggies)
       w-1 0 start-color xprt tolerance jaggies)
      0 h-1 start-color xprt tolerance jaggies)
     w-1 h-1 start-color xprt tolerance jaggies)))

;; replace-color : Image Color Color Number -> Image
;; In the given image, replace the source color (with the given tolerance) 
;; by the destination color
(define (replace-color img source-color destination-color tolerance)
  (let ((src (find-color source-color))
        (dst (find-color destination-color)))
    (color-list->bitmap
     (map (lambda (c)
            (if (color-near? c src tolerance)
                dst
                c))
          (image->color-list img))
     (image-width img)
     (image-height img))))
;; color->alpha : Image Color Number -> Image
;; in the given image, transform the given color to transparency.
(define (color->alpha img target-color tolerance)
  (replace-color img target-color (make-color 0 0 0 0) tolerance))

;; clipart-url : String -> Image
;; try to grab the provided url and turn it into an image assuming a solid white background
(define (clipart/url url)
  (transparent-from-corners (bitmap/url url) 30))

;; save-clipart : Image String -> Boolean
(define (save-clipart img path)
  (save-image img (string-append path ".png") (image-width img)))




;; boolean->string : Boolean -> String
;; convert the given boolean to a string.
(define (boolean->string b)
  (if b "true" "false"))

;; boolean->image : Boolean -> Image
;; convert a boolean into an image of its string representation.
(define (boolean->image b)
  (string->image (boolean->string b)))



;; string->image : String -> Image
;; convert the given string to an image.
(define (string->image s)
  (text s 14 'black))

;; number->image : Number -> Image
;; convert the given number to an image.
(define (number->image n)
  (string->image (number->string n)))


;; overlay-at : Image Number Number Image -> Image
;; Place the foreground on the background at x y 
;; (in positive-y point space) relative to the center
(define (overlay-at background x y foreground)
  (overlay/xy background x (- 0 y) foreground))

                                        ; sq : Number -> Number
(define (sq x) (* x x))
;; sine : Degrees -> Number
;; For a right triangle with non-right angle x in degrees,
;; find the ratio of the length of the opposite leg to the 
;; length of the hypotenuse.      sin = opposite / hypotenuse
(define (sine x) (sin (* x (/ pi 180))))
;; cosine : Degrees -> Number
;; For a right triangle with non-right angle x in degrees,
;; find the ratio of the length of the adjacent leg to the 
;; length of the hypotenuse.      cos = adjacent / hypotenuse
(define (cosine x) (cos (* x (/ pi 180))))
;; tangent : Degrees -> Number
;; For a right triangle with non-right angle x in degrees,
;; find the ratio of the length of the opposite leg to the
;; length of the adjacent leg.    tan = opposite / adjacent
(define (tangent x) (tan (* x (/ pi 180))))

;; pick : List -> Element
;; pick a random element from the list
(define (pick lst)
  (list-ref lst (random (length lst))))

;; subset? : List List -> Boolean
;; return true if list a is a (proper or improper) subset of b
(define (subset? a b) 
  (andmap
   (lambda (ele) (member ele b))
   a))

(define (in? a b)
  (if (list? a) (subset? a b) (if (eq? (member a b) #f) #f #t)))


(define (on-blue img)
  (overlay img (rectangle (image-width img) (image-height img) "solid" "blue")))

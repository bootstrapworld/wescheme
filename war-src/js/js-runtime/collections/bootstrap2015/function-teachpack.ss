(provide start start space graph everything fibonacci factorial)

; dimensions: 
(define ROCKET (scale 1/2 (bitmap/url "http://www.wescheme.org/images/teachpacks2012/rocket.png")))
(define BACKGROUND (bitmap/url "http://imgs.xkcd.com/comics/height.png"))
(define UNIVERSE-HEIGHT 4.35e+26)
(define LOG-UNIVERSE-HEIGHT 61.33738)
(define UNIVERSE-ZERO-PX 150)
(define BACKGROUND-PX-ABOVE-GROUND (- (image-height BACKGROUND) UNIVERSE-ZERO-PX))
(define CENTER (/ (image-width BACKGROUND) 2))
(define HEIGHT 550)

(define (time-text str)
  (text str 14 (make-color 41 128 38)))
(define (height-text str)
  (text str 14 (make-color 38 38 128)))
(define (speed-text str)
  (text str 14 "purple"))

;; (Number (Number -> Number)) Symbol -> (Number (Number -> Number))
;; add 1 to the current time
(define (tock w ke)
  (cond
    [(key=? ke " ") (cons (+ (car w) 1) (cdr w))]
    [(key=? ke "b") (cons (- (car w) 1) (cdr w))]
    [else w]))

;; legend : (time . height-fn) -> Image
;; The time, height, and speed.
(define (legend w)
  (let* ((time (car w))
         (hfn (cdr w))
         (height (hfn time))
         (speed (- (hfn (+ time 1)) height))
         (ttime (beside (time-text
                         (string-append "Time: " (number->string time) (if (= 1 time) " second" " seconds")))
                        (scale 1.2 (time-text "       [spacebar] adds one second.  [b] goes back!"))))
         (theight (height-text 
                   (string-append "Height: " (number->string height) (if (= 1 height) " meter" " meters"))))
         (tspeed (speed-text 
                  (string-append "Speed: " (number->string speed) (if (= 1 speed) " meter/second" " meters/second")
                                 (if (> (abs speed) 299792458) 
                                     "  That's faster than light!!!" 
                                     "")))))
    (above/align "left" ttime theight tspeed)))



(define PLAIN-WIDTH 200)
(define (plain-draw t fn)
  (place-image
   ROCKET 
   (/ PLAIN-WIDTH 2)
   (- HEIGHT (fn t))
   (foldr (lambda (mark bg) 
            (let ((i (height-text (number->string mark))))
              (place-image i (/ (image-width i) 2) (- HEIGHT mark 15) bg)))
          (empty-scene PLAIN-WIDTH HEIGHT)
          (marks 0 HEIGHT 50))))

;; draw-world: Number -> Image 
;; create an image that represents the world 
(define (rocket-draw-world w)
  (rocket-add w (rectangle (image-width BACKGROUND) HEIGHT "solid" "white")))

(define (universe-pix h) 
  (cond 
    [(<= h 0) h]
    [else (* (/ (log (+ 1.1 h)) LOG-UNIVERSE-HEIGHT) BACKGROUND-PX-ABOVE-GROUND)]))

(define (rocket-scale height)
  (max 1/25
       (let* ((k 40)
              (h (+ 2 (abs height)))
              (d (log (* k h))))
         (/ (- d (log h)) d))))

;; rocket-add : Number Image -> Image 
;; add the rocket to the image assuming w seconds since start of simulation
(define (rocket-add w window)
  (let* ((hfn (cdr w))
         (time (car w))
         (height (hfn time))
         (rocket (scale (rocket-scale height) ROCKET))
         (rocket-pixh (universe-pix (hfn time)))
         (usable-rocket-space (- HEIGHT UNIVERSE-ZERO-PX))
         (winh% (- 1 (/ (- BACKGROUND-PX-ABOVE-GROUND rocket-pixh) BACKGROUND-PX-ABOVE-GROUND)))
         (ydt (- 0 (* winh% usable-rocket-space)))
         (y (+ usable-rocket-space ydt))
         (bgy (+ rocket-pixh ydt (- HEIGHT (/ (image-height BACKGROUND) 2))))
         )
    (place-image rocket CENTER y (place-image BACKGROUND CENTER bgy window))))


(define (marks start end step)
  (if (< start end)
      (cons start (marks (+ start step) end step))
      (list end)))
(define (plus-marks-internal start end step)
  (if (< start end)
      (cons start (marks (+ start step) end step))
      (list end (+ end step))))
(define (plus-marks start end step)
  (cons (- start step) (plus-marks-internal start end step)))

(define GRAPH-SIZE 400)
(define NUM-MARKS 15)
(define GRAPH-LEGEND-SIZE 20)
(define (graph-draw-world w)
  (let* ((seconds (car w))
         (fn (cdr w))
         (x-step (max 1 (round (/ (abs seconds) NUM-MARKS))))
         (x-seconds (marks (min 0 seconds) (max 0 seconds) x-step))
         ;(dbg0 (begin (display "x-seconds") (display x-seconds) (newline)))
         (y-outputs (map fn x-seconds))
         ;(dbg1 (begin (display "y-outputs") (display y-outputs) (newline)))
         (y-step (max 1 (round (/ (- (apply max y-outputs) (apply min y-outputs)) NUM-MARKS))))
         ;(dbg3 (begin (display "y-step") (display y-step) (newline)))
         (y-meters (plus-marks (apply min y-outputs) (apply max y-outputs) y-step))
         ;(dbg3 (begin (display "y-meters") (display y-meters) (newline)))
         (max-seconds (apply max x-seconds))
         (min-seconds (apply min x-seconds))
         (x-range (max 1 (- max-seconds min-seconds)))
         (max-meters (apply max y-meters))
         (min-meters (apply min y-meters))
         (y-range (max 1 (- max-meters min-meters)))
         (x-pixel-position (lambda (seconds) (* (- GRAPH-SIZE GRAPH-LEGEND-SIZE) (/ (- seconds min-seconds) x-range))))
         (y-pixel-position (lambda (meters) (- GRAPH-SIZE (* (- GRAPH-SIZE GRAPH-LEGEND-SIZE) (/ (- meters min-meters) y-range)))))
         ;(dbg4 (begin (display "rockets") (newline)))
         (rockets (foldr (lambda (seconds bg)
                           (place-image
                            (scale 1/5 ROCKET)
                            (x-pixel-position seconds)
                            (y-pixel-position (fn seconds))
                            bg))
                         (rectangle GRAPH-SIZE GRAPH-SIZE "outline" "black")
                         x-seconds))
         ;(dbg5 (begin (display "x-legend") (newline)))
         (x-legend (above
                    (foldr (lambda (seconds bg)
                             (place-image (time-text (number->string seconds)) (x-pixel-position seconds) (/ GRAPH-LEGEND-SIZE 2) bg))
                           (rectangle GRAPH-SIZE GRAPH-LEGEND-SIZE "solid" "white")
                           x-seconds)
                    (time-text "seconds")))
         ;(dbg6 (begin (display "y-legend") (newline)))
         (y-legend (beside
                    (rotate 90 (height-text "meters"))
                    (foldr (lambda (meters bg)
                             (place-image (height-text (number->string meters)) (* 2.5 GRAPH-LEGEND-SIZE) (y-pixel-position meters) bg))
                           (rectangle (* 5 GRAPH-LEGEND-SIZE) GRAPH-SIZE "solid" "white")
                           y-meters))))
    (beside/align "top" y-legend (above/align "right" rockets x-legend))))
                          
(define (combined-draw-world w)
  (above/align "left"
               (beside
                (plain-draw (car w) (cdr w))
                (rocket-draw-world w)
                (graph-draw-world w))
               (legend w)
               (text "Thanks to Randall Munroe for the picture of the universe!  https://xkcd.com/482/" 14 "gray")))

;; Just the left panel
(define (start fn)
  (big-bang (cons 0 fn)
            (on-key tock)
            (to-draw (lambda (w) (above (plain-draw (car w) (cdr w)) (legend w))))))

;; Just the middle panel
(define (space fn)
  (big-bang (cons 0 fn)
            (on-key tock)
            (to-draw (lambda (w) (above (rocket-draw-world w) 
                                        (legend w)
                                        (text "Thanks to Randall Munroe for the picture of the universe!  https://xkcd.com/482/" 14 "gray"))))))

;; Just the right panel
(define (graph fn)
  (big-bang (cons 0 fn)
            (on-key tock) 
            (to-draw (lambda (w) (above (graph-draw-world w) (legend w))))))

;; Everything together
(define (everything fn)
  (big-bang (cons 0 fn)
            (on-key tock)
            (to-draw combined-draw-world)))                                                       

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Extras: 

  (define *factorials-in-the-sky* (make-hash))
  (hash-set! *factorials-in-the-sky* 0 1)
  ;; factorial : Number -> Number 
  ;; Compute n!, or n * (n-1) * (n-2) * ... * 1
  (define (factorial n) 
    (let ((cache (hash-ref *factorials-in-the-sky* n #f)))
      (begin 
        (when (not cache)
          (hash-set! *factorials-in-the-sky* n
                     (* n (factorial (if (> n 0) (- n 1) (+ n 1))))))
        (hash-ref *factorials-in-the-sky* n #f))))
  
  (define *fibonaccis-in-the-sky* (make-hash))
  (hash-set! *fibonaccis-in-the-sky* 0 0)
  (hash-set! *fibonaccis-in-the-sky* 1 1)
  ;; fibonacci : Number -> Number
  (define (fibonacci n)
    (let ((cache (hash-ref *fibonaccis-in-the-sky* n #f)))
      (begin 
        (when (not cache)
          (hash-set! *fibonaccis-in-the-sky* n
                     (if (> n 0)
                         (+ (fibonacci (- n 1)) (fibonacci (- n 2)))
                         (- (fibonacci (+ n 2)) (fibonacci (+ n 1))))))
        (hash-ref *fibonaccis-in-the-sky* n #f))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Sanity checks (difficult to write actual tests for draw functions)

(define (sanity-checks)
  (apply 
   above/align "left" 
   (map 
    (lambda (fn) 
      (apply beside (map
                     (lambda (t) (scale 1/8 (combined-draw-world (cons t fn))))
                     '(-10 -1 0 1 2 3 5 10 30 80 200))))
    (list (lambda (s) 0)  ;; starting
          (lambda (s) 100) ;; higher
          (lambda (s) 100000) ;; really high
          (lambda (s) (* s 7))  ;; first design recipe
          (lambda (s) (* s 17))  ;; faster
          (lambda (s) (* s .7))  ;; slower
          (lambda (s) (* s -7))  ;; backwards
          (lambda (s) (/ s 3))   ;; strange
          (lambda (s) (+ 500 (* s -7))) ;; dropping from the sky
          sqr  ;; the first one into space, usually
          (lambda (s) (expt s 5))  ;;  getting somewhere
          (lambda (s) (expt pi s))  ;; now we're moving!
          ;(lambda (s) (expt s -5))  ;; kid playing around, doesn't know stuff isn't possible, gets /0 error for no apparent reason.
          (lambda (s) (expt (+ (abs s) 1) -5))  ;; because (expt 0 -5) dies badly.
          (lambda (s) (expt -2 s))  ;; jumpy!
          ;; out of this world:
          (lambda (s) (expt s 7))
          (lambda (s) (expt 10 s))
          fibonacci
          factorial
          ))))

(define (rocket-height x) (* 7 x))
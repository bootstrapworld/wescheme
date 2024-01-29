#lang scribble/manual

@(require "scribble-helper.rkt")
@(require (for-label 2htdp/image
                     "mock-bindings.rkt"
                     (only-in htdp/image
                              image=?
                              color-list->image)
                     (only-in racket/base
                              pair?)

                     (only-in lang/htdp-advanced
                              check-expect
                              * + - / < <= = =~
                              > >= abs acos add1
                              and andmap angle append
                              asin atan boolean=?
                              boolean? build-list
                              caaar caadr caar cadar cadddr
                              caddr cadr car cdaar cdadr
                              cdar cddar cdddr
                              cddr cdr
                              ceiling char->integer
                              char-alphabetic?
                              char-ci<=?
                              char-ci<?
                              char-ci=?
                              char-ci>=?
                              char-ci>?
                              char-downcase
                              char-lower-case?
                              char-numeric?
                              char-upcase
                              char-upper-case?
                              char-whitespace?
                              char<=?
                              char<?
                              char=?
                              char>=?
                              char>?
                              char?
                              complex?
                              conjugate
                              cons
                              cons?
                              cos
                              cosh
                              current-seconds
                              denominator
                              e
                              eighth
                              empty
                              empty?
                              eof
                              eof-object?
                              eq?
                              equal?
                              equal~?
                              eqv?
                              error
                              even?
                              exact->inexact
                              exp
                              expt
                              false
                              false?
                              fifth
                              first
                              floor
                              foldl
                              format
                              fourth
                              gcd
                              identity
                              imag-part
                              inexact->exact
                              inexact?
                              integer->char
                              integer?
                              lcm
                              length
                              list
                              list*
                              list->string
                              list-ref
                              log
                              magnitude
                              make-posn
                              make-string
                              map
                              max
                              member
                              memq
                              memv
                              min
                              modulo
                              negative?
                              not
                              null
                              null?
                              number->string
                              number?
                              numerator
                              odd?
                              or
                              ormap
                              pi
                              positive?
                              posn-x
                              posn-y
                              posn?
                              quotient
                              random
                              rational?
                              real-part
                              real?
                              remainder
                              rest
                              reverse
                              round
                              second
                              seventh
                              sgn
                              sin
                              sinh
                              sixth
                              sqr
                              sqrt
                              string
                              string->list
                              string->number
                              string->symbol
                              string-append
                              string-ci<=?
                              string-ci<?
                              string-ci=?
                              string-ci>=?
                              string-ci>?
                              string-copy
                              string-length
                              string-ref
                              string<=?
                              string<?
                              string=?
                              string>=?
                              string>?
                              string?
                              struct?
                              sub1
                              substring
                              symbol->string
                              symbol=?
                              symbol?
                              tan
                              third
                              true
                              zero?)))



@inject-css{extra.css}



@title{WeScheme}

@hyperlink["http://www.wescheme.org"]{WeScheme} is a web-based
programming environment that allows us to write, run, and share
programs on the web.  Programs written in WeScheme should be available
from any computer with a capable JavaScript-enabled web browser.  The
editing environment, the compiler, and the associated runtime
libraries are all hosted on WeScheme, eliminating installation
hassles.  WeScheme allows us to easily share programs by creating
share URLs; these share URLs can be used to run a program or, if the
author permits it, allow anyone to view the source to that program.

Web programs are typically interactive, so WeScheme provides special
support for World programs that can interact with timer ticks,
keyboard events, and images.


@section{Example programs}

Here are a few example programs that can give an idea of the kinds
of things you can do in WeScheme.  You can:

@itemlist[

@item{@link["http://www.wescheme.org/view?publicId=LBXSQ2aKKG"]{... make shapes and pictures,}}

@item{@link["http://www.wescheme.org/view?publicId=5bhqZiqdQ5"]{... or a meme generator,}}

@item{@link["http://www.wescheme.org/view?publicId=GgAAxozEtt"]{... animate a ballooning circle,}}

@item{@link["http://www.wescheme.org/view?publicId=ggCaWzRgWK"]{... or land a UFO,}}

@item{@link["http://www.wescheme.org/view?publicId=uGd1iMzAFg"]{... or have it chase after cows!}}
]


@section{The environment}

Let's jump in and explore WeScheme by running a few programs.

Open up a web browser to @url{http://www.wescheme.org}.  Press the
@emph{Start Coding} button.  The following editor page should be
divided into a top @emph{definitions} section, and a bottom
@emph{interactions} section.  Click onto the @emph{definitions} top
half of the window and enter in the following text, quotes and all:

@racketblock[
"hello world"
]

Next, press the @emph{Run} button at the toolbar at the top.  If all
goes well, we should see a @racket["hello world"] appear on the bottom
window.


Next, add another line in the @emph{definitions} window:

@racketblock[
(bitmap/url "http://racket-lang.org/logo.png")
]

Press the @emph{Run} button again.  We should now see an image in the
@emph{Interactions} window as well.

Web images are values, as are strings, numbers, booleans, and
structures.  You can even apply algebra on them.  Try:
@racketblock[
(rotate 45 (bitmap/url "http://racket-lang.org/logo.png"))
]
or
@racketblock[
(overlay (bitmap/url "http://racket-lang.org/logo.png")
         (bitmap/url "http://www.wescheme.org/css/images/BigLogo.png"))
]
for example.  Many more image functions are built-into WeScheme; you
can explore the functions in @secref["sec:world-image-api"].




@section[#:tag "sec:world-image-api"]{World programming and Images API}
@declare-exporting["mock-bindings.rkt"]


@defproc[(big-bang [w world]
                   [h big-bang-handler] ...) world]{
Start a big bang computation.  The @racket[big-bang] consumes an initial world,
as well as several handlers to configure it, described in this section:
}



@defproc*[(((on-tick [tick-f ([w world] -> world)] [delay real]) big-bang-handler)
           ((on-tick [tick-f ([w world] -> world)]) big-bang-handler))]{
Tells @racket[big-bang] to update the world during clock ticks.

By default, this will send a clock tick 28 times a second, but if
given @racket[delay], it will use that instead.
@codeblock|{
;; The world is a number
;; tick: world -> world
(define (tick world)
  (add1 world))

(big-bang 0
          (on-tick tick 2)) ;; tick every two seconds
}|
}



@defproc[(on-key [key-f ([w world] [k key] -> world)]) big-bang-handler]{
Tells @racket[big-bang] to update the world when a key is pressed.  The @racket[key-f]
function will be called with the particular key being pressed.

@codeblock|{
;; The world is a number.

;; handle-key: world key -> image
(define (handle-key w k)
  (cond [(key=? k "up")
         (add1 w)]
        [(key=? k "down")
         (sub1 w)]
        [else 
         w]))
(big-bang 0
          (on-key handle-key))
}|
}

@defproc[(key=? [a-key key] [a-string string]) boolean]{
Returns true if @racket[a-key] is equal to @racket[a-string].
}



@defproc[(to-draw [draw-f ([w world] -> image)]) big-bang-handler]{
Tells @racket[big-bang] how to update what the world looks like.  The draw
function will be called every time an event occurs.

@codeblock|{
;; The world is a number.

;; draw: world -> image
(define (draw world)
  (circle world "solid" "blue"))

(big-bang 20
          (to-draw draw))
}|

}




@defproc[(stop-when [stop? ([w world] ->  boolean)]) big-bang-handler]{
Tells @racket[big-bang] when to stop.
@codeblock|{
;; the world is a number

;; stop?: world -> boolean
(define (stop? world)
  (> world 10))

(big-bang 0
          (stop-when stop?)
          (on-tick add1 1))
}|
}





Here is a listing of the functions you can use to make images.

@racket-inject-docs[make-color
                    empty-scene
                    scene+line
                    place-image
                    place-image/align
                    circle
                    star
                    radial-star
                    star-polygon
                    polygon
                    rectangle
                    regular-polygon
                    rhombus
                    square
                    triangle
                    right-triangle
                    isosceles-triangle
                    ellipse
                    line
                    add-line
                    overlay
                    overlay/xy
                    overlay/align
                    underlay
                    underlay/xy
                    underlay/align
                    beside
                    beside/align
                    above
                    above/align
                    rotate
                    scale
                    scale/xy
                    crop
                    frame
                    flip-horizontal
                    flip-vertical
                    text
                    text/font
                    bitmap/url
                    image?
                    image=?
                    image-width
                    image-height

                    image->color-list
                    color-list->image

                    image-baseline
                    mode?
                    image-color?
                    x-place?
                    y-place?
                    angle?
                    side-count?
                    step-count?]


@section{Basic operations}
@racket-inject-docs[check-expect]
As a convenience, the name @racket[EXAMPLE] is an alias for
@racket[check-expect].
@racketblock[
(EXAMPLE (+ 1 2) 3)
]



@racket-inject-docs[
                              * + - / < <= = =~
                              > >= abs acos add1
                              and andmap angle append
                              asin atan boolean=?
                              boolean? build-list
                              ceiling char->integer
                              char-alphabetic?
                              char-ci<=?
                              char-ci<?
                              char-ci=?
                              char-ci>=?
                              char-ci>?
                              char-downcase
                              char-lower-case?
                              char-numeric?
                              char-upcase
                              char-upper-case?
                              char-whitespace?
                              char<=?
                              char<?
                              char=?
                              char>=?
                              char>?
                              char?
                              complex?
                              conjugate
                              cons
                              cons?
                              cos
                              cosh
                              current-seconds
                              denominator
                              e
                              eighth
                              empty
                              empty?
                              eof
                              eof-object?
                              eq?
                              equal?
                              equal~?
                              eqv?
                              error
                              even?
                              exact->inexact
                              exp
                              expt
                              false
                              false?
                              fifth
                              first
                              floor
                              foldl
                              format
                              fourth
                              gcd
                              identity
                              imag-part
                              inexact->exact
                              inexact?
                              integer->char
                              integer?
                              lcm
                              length
                              list
                              pair?
                              list*
                              list->string
                              list-ref
                              log
                              magnitude
                              make-posn
                              make-string
                              map
                              max
                              member
                              memq
                              memv
                              min
                              modulo
                              negative?
                              not
                              null
                              null?
                              number->string
                              number?
                              numerator
                              odd?
                              or
                              ormap
                              pi
                              positive?
                              posn-x
                              posn-y
                              posn?
                              quotient
                              random
                              rational?
                              real-part
                              real?
                              remainder
                              rest
                              reverse
                              round
                              second
                              seventh
                              sgn
                              sin
                              sinh
                              sixth
                              sqr
                              sqrt
                              string
                              string->list
                              string->number
                              string->symbol
                              string-append
                              string-ci<=?
                              string-ci<?
                              string-ci=?
                              string-ci>=?
                              string-ci>?
                              string-copy
                              string-length
                              string-ref
                              string<=?
                              string<?
                              string=?
                              string>=?
                              string>?
                              string?
                              struct?
                              sub1
                              substring
                              symbol->string
                              symbol=?
                              symbol?
                              tan
                              third
                              true
                              zero?
]

@section{Keyboard shortcuts}

The following keyboard shortcuts are available in WeScheme:
@itemlist[
     @item{@emph{Tab} - Will auto-indent the active line, based on the previous line's indentation.}
     @item{@emph{Ctrl-I} - Will auto-indent the entire definitions window (Cmd-I on Apple).}
     @item{@emph{F7} - Shortcut for the "Run" button.}
     @item{@emph{F8} - Shortcut for the "Stop" button.}
     @item{@emph{F9} - Shortcut for the "Share" button".}
     @item{@emph{Ctrl-S} - If logged in, will save the current file (Cmd-S on Apple).}
     @item{@emph{Alt-Up} - In the Interactions Area, insert the previous entry.}
     @item{@emph{Alt-Down} - In the Interactions Area, insert the next entry.}

]


@section{Acknowledgements}


WeScheme uses code and utilities from the following external projects:
@itemlist[
@item{jshashtable (@url{http://www.timdown.co.uk/jshashtable/})}
@item{js-numbers (@url{http://github.com/dyoo/js-numbers/})}
@item{JSON (@url{http://www.json.org/js.html})}
@item{jquery (@url{http://jquery.com/})}
@item{Google Closure Compiler (@url{http://code.google.com/p/closure-compiler/})}
@item{excanvas (@url{http://excanvas.sourceforge.net/})}
@item{canvas-text (@url{http://code.google.com/p/canvas-text/source/browse/trunk})} 
]

The following folks have helped tremendously in the implementation of
WeScheme by implementing libraries, giving guidance, reporting bugs,
and suggesting improvements.

@;;;;
@; in alphabetical order
@;;;;
@(apply itemlist
   (map item (sort (list
   "Danny Yoo"         ;; the godfather
   "Ethan Cecchetti"   ;; runtime library work
   "Scott Newman"      ;; runtime library work 
   "Will Zimrin"       ;; CodeMirror 2 stuff
   "Brendan Hickley"   ;; AppEngine, security stuff
   "Zhe Zhang"         ;; runtime library
   "Alex Laurent"
   "Guillaume Marceau"      ;; general help, upcoming error messages
   "Shriram Krishnamurthi"  ;; of course... :)
   "Kathi Fisler"           ;; ditto!
   "Emmanuel Schanzer"      ;; runtime library, local compilation
   "Robby Findler"
   "Matthew Flatt"
   "Sorawee Porncharoenwase"
   "Sina Bahram"       ;; a11y

   ;; The members of the Mongolian Horde working on the colored error messages:
   "Michael Rowland"
   "Daniel Kocoj"
   "Andrew Tian"
) string<?))
)


Please send any bug reports to Emmanuel Schanzer (@tt["contact@bootstrapworld.org"]).
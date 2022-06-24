/* jshint esversion: 9 */
let debug = true
import { blur } from "./blur.js"
import { resize,Text } from "./gl.js"

class LyricLine {
    constructor(time, text = "Empty line", y, height, canvas, exittime, curves) {
        this.time = time
        this.text = text
        this.height = height
        this.canvas = canvas
        this.ctx = canvas.getContext("2d")
        this.exittime = exittime
        this.y = y
        this.curves = curves

        this.renderedText = Text(text, height)
        this.renderResult = this.renderedText

        this.blurCache = {}
        this.animations = []
        this.targetMove = 0

        /*For y, we take downwards as positive and upwards as negative.*/


        this.create_blurcache()

        if (debug) {
            let ll = this
        }
    }
    move(t, dt) {
        this.animations.forEach(animation => {
            animation(t, dt)
        });
    }
    render() {
        if (this.y < this.canvas.height && this.y > -this.renderResult.height) {
            let blurred = this.blurCache[Math.trunc(this.curves.r(this.y))]
            let resize_to = this.curves.size(this.y),
                resized = resize(blurred, blurred.width * resize_to, blurred.height * resize_to)
            this.ctx.putImageData(resized, this.canvas.width / 2 - resized.width / 2, this.y)
        }
    }
    create_blurcache() {
        for (let i = 0; i <= 10; i++) {
            this.blurCache[i] = blur(this.renderedText, i)
        }
    }
}

export class LyricPlayer {
    constructor(canvas, lyrics_string, lyric_height = 80, space = 80, u = 100, g = 10) {
        /*
    param space: The space between lines
    */
        this.canvas = canvas
        this.ctx = this.canvas.getContext("2d")
        this.lyrics_string = lyrics_string
        this.willplay_index = 1
        this.u = u
        this.g = g
        this.objects = []
        this.h = lyric_height
        this.space = lyric_height + space
        this.playing = false

        let size = resizeCurve.getCurve(this.canvas.height, 1)
        let r = blurRadiusCurve.getCurve(this.canvas.height, 10)

        this.objects.push(new LyricLine(0, "· · ·", 0, this.h, this.canvas, 0, { size: size, r: r }))
        /*This space is different. It's the difference of y of each lyric line. */
        let lines = lyrics_string.split("\n\n")[1].split("\n")
        for (let line_index = 0; line_index < lines.length; line_index++) {
            let lyric_line_raw = lines[line_index],
                [time_raw, lyric_line_content] = lyric_line_raw.split(']'),
                time_string = time_raw.substring(1),
                [minute_string, second_string] = time_string.split(':'),
                [minute, second] = [Number(minute_string), Number(second_string)],
                time = minute * 60 + second
            this.objects[line_index + 1] = new LyricLine(time, lyric_line_content, this.space * (line_index + 1) + 50, this.h, this.canvas, time, {
                size: size,
                r: r
            })
        }
        //TODO: support exittime
        //TODO: support multi-line lyrics (line height will vary, and this.space should vary)
    }

    move(t, dt) {
        //t: time since started playing, in seconds
        let l = this.objects[this.willplay_index]
        if (t >= l.time) {
            let duration = 0.5, maxv = 2 * this.space / duration,
                player = this, starttime = t,
                v = function (x) {
                    if (x <= duration / 2) return 2 * maxv * x / duration
                    else return 2 * maxv * (duration - x) / duration
                }
            for (let i = this.willplay_index - 1;
                i < this.objects.length;
                i++) {
                let onScreenIndex = i - (player.willplay_index - 1)
                let targetMove=this.space
                let a = function (t, dt) {
                    //dt: time since last frame ( or, last call of this function )
                    let xt = t - onScreenIndex * 0.02 - starttime // Time since animation start
                    //xt-dt/2: speed at medium time is the average speed
                    let x = v(xt - dt / 2) * dt
                    if (xt > 0 && xt <= duration) {
                        player.objects[i].y -= x
                        targetMove-=x
                    }
                    else if (xt > 0) {
                        player.objects[i].y-=targetMove
                        for (let o = 0; o < player.objects[i].animations.length; o++) {
                            if (player.objects[i].animations[o] == a) {
                                delete player.objects[i].animations[o]
                            }
                        }
                    }
                    //else if xt<=0: stay still
                }
                player.objects[i].animations.push(a)
            }
            this.willplay_index++;
            if (this.willplay_index >= this.objects.length) this.playing = false
        }

        for (let i = 0; i < this.objects.length; i++) {
            this.objects[i].move(t, dt)
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        for (let i of this.objects) i.render()
    }

    play(time = 0) {
        /*
        param time: start playing from where?
        in seconds.

        Internally, we use ms.
        When passing things to move(), we use seconds, which can have decimal.
        */
        this.starttime = (new Date()).getTime() - time * 1000
        this.lasttime = 0
        let player = this
        let move_wrapper = function (timestamp) {
            let ms = (new Date()).getTime() - player.starttime,
                t = ms / 1000,
                dt = t - player.lasttime
            player.lasttime = t

            player.move(t, dt)
            player.render()

            if (player.playing) window.requestAnimationFrame(move_wrapper)
        }
        this.playing = true
        window.requestAnimationFrame(move_wrapper)
    }

}



class Curve {
    constructor(prototypeFunction) {
        /*
        A Curve consists of prototypeFunction, definition domain and value domain.
        The definition domain and value domain of prototypeFunction must be [0,1].
        Then we'll scale according to, say, screensize.
        */
        this.prototypeFunction = prototypeFunction
    }
    getCurve(x, y) {
        /*
        param x: target definition domain
        param y: target value domain
        */
        let pr = this.prototypeFunction
        let curve = function (input) {
            let xx = input / x
            let res = pr(xx)
            let ret = res * y
            return ret
        }
        return curve
    }
}


let resizeCurve = new Curve(function (x) {
    let a = x - 0.05
    let b = 20 * a
    let c = -(b ** 2)
    let d = 2 ** c
    let e = 0.1 * d + 0.9
    return e
})
let blurRadiusCurve = new Curve(function (x) {
    let a = x - 0.1
    let b = -17 * a
    let c = -(2 ** b)
    let d = c + 1
    let e = Math.max(d, 0)
    return e
})


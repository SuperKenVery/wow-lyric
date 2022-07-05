/* jshint esversion: 9 */
let debug = true
import { blur } from "./blur.js"
import { resize, Text } from "./gl.js"
const LineStates = {
    future: 0,
    current: 1,
    goingHistory: 2,
    history: 3
}
const lyric_line_blur_radius = 20
class LyricLine {
    constructor(time, text = "Empty line", y, height, canvas, exittime, curves) {
        this.renderedText = Text(text, height, canvas.width * 0.7)

        this.time = time
        this.text = text
        this.height = this.renderedText.height
        this.canvas = canvas
        this.ctx = canvas.getContext("2d")
        this.exittime = exittime
        this.y = y
        this.curves = curves

        this.blurCache = {}
        this.animations = []
        this.state = LineStates.future

        /*For y, we take downwards as positive and upwards as negative.*/
        this.create_blurcache()
    }
    move(t, dt) {
        if (this.state != LineStates.history) {
            this.animations.forEach(animation => {
                animation(t, dt)
            });
            /*if (this.state == LineStates.goingHistory && this.animations[this.animations.length - 1] == undefined) {
                this.y = -this.height
                this.state = LineStates.history
            }*/
        }
    }
    render() {
        if (this.y < this.canvas.height && this.y > -this.renderedText.height) {
            let blurred
            if (this.state != LineStates.current) {
                blurred = this.blurCache[Math.trunc(this.curves.r(this.y))]
            } else {
                blurred = this.renderedText
            }
            //let resize_to = this.curves.size(this.y),
            //    resized = resize(blurred, blurred.width * resize_to, blurred.height * resize_to)
            this.ctx.putImageData(blurred, this.canvas.width / 2 - blurred.width / 2, this.y)
        }
    }
    create_blurcache() {
        for (let i = 0; i <= lyric_line_blur_radius; i++) {
            this.blurCache[i] = blur(this.renderedText, i)
        }
    }
}

const default_lyric_height = 80 * window.devicePixelRatio
export class LyricPlayer {
    constructor(canvas, lyrics_string, lyric_height = default_lyric_height, space = default_lyric_height, u = 100, g = 10) {
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
        this.space = space
        this.playing = false

        let size = resizeCurve.getCurve(this.canvas.height, 1)
        let r = blurRadiusCurve.getCurve(this.canvas.height, lyric_line_blur_radius)

        this.objects.push(new LyricLine(0, "· · ·", this.space, this.h, this.canvas, 0, { size: size, r: r }))
        let lines = lyrics_string.split("\n\n")[1].split("\n")
        let y = this.objects[0].y
        for (let line_index = 0; line_index < lines.length; line_index++) {
            let lyric_line_raw = lines[line_index],
                [time_raw, lyric_line_content] = lyric_line_raw.split(']'),
                time_string = time_raw.substring(1),
                [minute_string, second_string] = time_string.split(':'),
                [minute, second] = [Number(minute_string), Number(second_string)],
                time = minute * 60 + second
            y += this.objects[line_index].height + this.space
            this.objects[line_index + 1] = new LyricLine(time, lyric_line_content, y, this.h, this.canvas, time, {
                size: size,
                r: r
            })
        }
        //TODO: support exittime
    }

    move(t, dt) {
        //t: time since started playing, in seconds
        const duration = 0.6
        const l = this.objects[this.willplay_index]
        if (t >= l.time - duration) {
            this.objects[this.willplay_index - 1].state = LineStates.goingHistory
            const targetMove = this.objects[this.willplay_index - 1].height + this.space,
                player = this, starttime = t
            for (let i = this.willplay_index - 1;
                i < this.objects.length;
                i++) {
                const onScreenIndex = i - (player.willplay_index - 1)
                const k = 2 * targetMove / (duration ** 2),
                    pos = positionCurve.getCurve(duration, targetMove)
                let lastxt = 0
                const a = function (t, dt) {
                    //dt: time since last frame ( or, last call of this function )
                    const xt = t - onScreenIndex * 0.03 - starttime // Time since animation start
                    if (xt > 0 && xt <= duration) {
                        const x = pos(xt) - pos(lastxt)
                        player.objects[i].y -= x
                        lastxt = xt
                    } else if (xt > duration) {
                        const x = pos(xt) - pos(lastxt)
                        player.objects[i].y -= x
                        for (let o = 0; o < player.objects[i].animations.length; o++) {
                            if (player.objects[i].animations[o] == a) {
                                delete player.objects[i].animations[o]
                            }
                        }
                        if (player.objects[i] == l) l.state = LineStates.current
                    }
                    //else if xt<=0: stay still
                }
                const b = function (t, dt) {
                    player.objects[i].y -= targetMove
                    for (let o = 0; o < player.objects[i].animations.length; o++) {
                        if (player.objects[i].animations[o] == b) {
                            delete player.objects[i].animations[o]
                        }
                    }
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
            const ms = (new Date()).getTime() - player.starttime,
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
let positionCurve = new Curve(function (x) {
    if (x <= 0) return 0
    else if (x <= 0.5) return 16 * x ** 5
    else if (x <= 1) return 1 - 16 * (1 - x) ** 5
    else return 1
})


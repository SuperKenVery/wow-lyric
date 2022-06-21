/* jshint esversion: 9 */
let debug = true

class LyricLine {
    constructor(time, text = "Empty line", y, height, canvas, exittime) {
        this.time = time
        this.text = text
        this.height = height
        this.canvas = canvas
        this.ctx = canvas.getContext("2d")
        this.exittime = exittime
        this.y = y

        this.renderedText = Text(text, height)
        this.renderResult = this.renderedText

        this.blurCache = {}
        this.animations = []

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
            let r = function (y, H) {
                let yy = Math.max(y, 0)
                let ratio = yy / H
                let res = ratio * 10
                return Math.trunc(res)
            }
            let blurred = this.blurCache[r(this.y, this.canvas.height)]
            let size = function (y, h) {
                let a = 0.01 * (y - 0.5 * h)
                let b = -(a ** 2)
                let c = 0.1 * 2 ** b
                let d = 0.9 + c
                return d
            }
            let resize_to = size(this.y, this.height),
                resized = resize(blurred, blurred.width * resize_to, blurred.height * resize_to)
            let result = resized
            this.ctx.putImageData(result, this.canvas.width / 2 - result.width / 2, this.y)
        }
    }
    create_blurcache() {
        for (let i = 0; i <= 10; i++) {
            this.blurCache[i] = blur(this.renderedText, i)
        }
    }
}


class LyricPlayer {
    constructor(canvas, lyrics_string, lyric_height = 100, space = 80, u = 100, g = 10) {
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
        this.objects.push(new LyricLine(0, "", 0, this.h, this.canvas, 0))
        /*This space is different. It's the difference of y of each lyric line. */
        let lines = lyrics_string.split("\n\n")[1].split("\n")
        for (let line_index = 0; line_index < lines.length; line_index++) {
            let lyric_line_raw = lines[line_index],
                [time_raw, lyric_line_content] = lyric_line_raw.split(']'),
                time_string = time_raw.substring(1),
                [minute_string, second_string] = time_string.split(':'),
                [minute, second] = [Number(minute_string), Number(second_string)],
                time = minute * 60 + second
            this.objects[line_index + 1] = new LyricLine(time, lyric_line_content, this.space * line_index+50, this.h, this.canvas, time)
        }
        //TODO: support exittime
        //TODO: support multi-line lyrics (line height will vary, and this.space should vary)
    }

    move(t, dt) {
        //t: time since started playing, in seconds
        let l = this.objects[this.willplay_index]
        if (t >= l.time) {
            console.log("turn for ", l)
            let duration = 0.5, maxv = 2 * this.space / duration,
                player = this, starttime = t
            for (let i = this.willplay_index;
                i < this.objects.length;
                i++) {
                let index = player.objects[i].animations.length,
                    onScreenIndex = i - player.willplay_index
                player.objects[i].animations.push(function (t, dt) {
                    //dt: time since last frame ( or, last call of this function )
                    let xt = t - onScreenIndex * 0.03 - starttime // Time since animation start
                    let v = function (x) {
                        if (x <= duration / 2) return 2 * maxv * x / duration
                        else return 2 * maxv * (duration - x) / duration
                    }
                    if (xt > 0 && xt <= duration) player.objects[i].y -= v(xt) * dt
                    else if (xt > 0) {
                        player.objects[i].animations.splice(index, 1)
                    }
                    //else if xt<=0: stay still
                })
            }
            this.willplay_index++;
            if (this.willplay_index >= this.objects.length) this.playing = false
        }

        for (let i = this.willplay_index - 1; i < this.objects.length; i++) {
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




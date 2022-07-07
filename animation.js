/* jshint esversion: 9 */
import { getGaussiumWeightMatrix, textureBlur, put } from "./blur.js"
import { Text } from "./gl.js"
import * as twgl from './twgl-full.module.js'
const LineStates = {
    future: 0,
    current: 1,
    goingHistory: 2,
    history: 3
}
export const lyric_line_blur_radius = 20
class LyricLine {
    constructor(time, text, y, height, exittime, curves, player) {
        this.gl = player.gl
        this.canvas = this.gl.canvas
        this.renderedTextImageData = Text(text, height, this.canvas.width * 0.7)
        this.time = time
        this.text = text
        this.height = this.renderedTextImageData.height
        this.width = this.renderedTextImageData.width
        this.exittime = exittime
        this.y = y
        /*For y, we take downwards as positive and upwards as negative.*/
        this.curves = curves
        this.player = player

        this.animations = []
        this.state = LineStates.future
    }
    initWebglResources() {
        //Some code in this block requires this.player.blurTmpFb, which can't be created until we know the max width/height of all the lyric lines, which is calculated in the initialization process of each lyric line. So we can't do this at initialization.
        const texture = twgl.createTexture(this.gl, { src: this.renderedTextImageData })
        this.textFb = twgl.createFramebufferInfo(this.gl, [
            {
                attachment: texture
            }
        ])
        const xr = this.width / this.player.blurTmpFb.width, yr = this.height / this.player.blurTmpFb.height //x ratio, y ratio
        const textureCoordinateData = [
            0, 1,
            0, 1 - yr,
            xr, 1,
            xr, 1 - yr
        ]
        this.webglResources = {
            blur: {
                y_textureCoordinateData: textureCoordinateData,
                bufferInfos: {
                    x: twgl.createBufferInfoFromArrays(this.gl, {
                        a_position: {
                            numComponents: 2,
                            data: [
                                -1, 1,
                                -1, 1 - 2 * yr,
                                -1 + 2 * xr, 1,
                                -1 + 2 * xr, 1 - 2 * yr
                            ]
                        },
                        a_textureCoordinate: {
                            numComponents: 2,
                            data: [
                                0, 1,
                                0, 0,
                                1, 1,
                                1, 0
                            ],
                        }
                    }),
                    y: twgl.createBufferInfoFromArrays(this.gl, {
                        a_position: {
                            numComponents: 2,
                            data: [
                                -1, 1,
                                -1, 1 - 2 * yr,
                                -1 + 2 * xr, 1,
                                -1 + 2 * xr, 1 - 2 * yr
                            ]
                        },
                        a_textureCoordinate: {
                            numComponents: 2,
                            data: textureCoordinateData
                        }
                    })
                }
            }
        }


    }
    move(t, dt) {
        if (this.state != LineStates.history) {
            this.animations.forEach(animation => {
                animation(t, dt)
            });
        }
    }
    render() {
        if (this.y < this.canvas.height && this.y > -this.renderedTextImageData.height) {
            const r = Math.trunc(this.curves.r(Math.abs(this.y - this.player.space)))
            const resize_to = this.curves.size(Math.abs(this.y - this.player.space)), alpha = this.curves.alpha(Math.abs(this.y - this.player.space))
            const left = this.gl.drawingBufferWidth / 2 - this.width * resize_to / 2,
                right = this.gl.drawingBufferWidth / 2 + this.width * resize_to / 2,
                h = this.gl.canvas.height
            const targetPositions = [
                left, h - (this.y + this.height * resize_to),
                left, h - this.y,
                right, h - (this.y + this.height * resize_to),
                right, h - this.y,
            ]
            const srcPos = this.webglResources.blur.y_textureCoordinateData
            if (r > 0) {
                const uniform = {
                    u_image: 0, //To be filled by textureBlur
                    u_textureSize: [0, 0], //To be filled by textureBlur
                    matrix: this.player.matrixTextures[r],
                    matrix_sum: this.player.matrixSums[r]
                }
                const uniforms = {
                    x: uniform,
                    y: uniform
                }
                textureBlur(this.gl, this.textFb, this.player.blurTmpFb, this.player.blurredFb, this.webglResources.blur.bufferInfos, uniforms, r)
                put(this.gl, targetPositions, this.player.blurredFb, null, alpha, srcPos)
            } else {
                put(this.gl, targetPositions, this.textFb, null, alpha)
            }


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
        this.gl = this.canvas.getContext("webgl")
        this.lyrics_string = lyrics_string
        this.willplay_index = 1
        this.u = u
        this.g = g
        this.lyricLines = []
        this.h = lyric_height
        this.space = space
        this.playing = false

        const curves = {
            size: resizeCurve.getCurve(this.canvas.height, 1),
            r: blurRadiusCurve.getCurve(this.canvas.height, lyric_line_blur_radius),
            alpha: alphaCurve.getCurve(this.canvas.height, lyric_line_blur_radius)
        }

        const firstLine = new LyricLine(0, "· · ·", this.space, this.h, 0, curves, this)
        let y = firstLine.y + firstLine.height + this.space
        this.lyricLines.push(firstLine)
        let maxHeight = firstLine.height, maxWidth = firstLine.width
        const lines = lyrics_string.split("\n\n")[1].split("\n")
        for (let line_index = 0; line_index < lines.length; line_index++) {
            try {
                const lyric_line_raw = lines[line_index],
                    [time_raw, lyric_line_content] = lyric_line_raw.split(']'),
                    time_string = time_raw.substring(1),
                    [minute_string, second_string] = time_string.split(':'),
                    [minute, second] = [Number(minute_string), Number(second_string)],
                    time = minute * 60 + second
                for (let i in [lyric_line_raw, time_raw, lyric_line_content, minute_string, second_string]) {
                    if (i == undefined) {
                        throw "Invalid lyric line"
                    }
                }
                const newLine = new LyricLine(time, lyric_line_content, y, this.h, time, curves, this)
                y += newLine.height + this.space
                this.lyricLines.push(newLine)
                maxHeight = Math.max(newLine.height, maxHeight); maxWidth = Math.max(newLine.width, maxWidth)
            } catch (err) {
            }
        }
        this.blurTmpFb = twgl.createFramebufferInfo(this.gl, [{ format: this.gl.RGBA }], maxWidth, maxHeight)
        this.blurredFb = twgl.createFramebufferInfo(this.gl, [{ format: this.gl.RGBA }], maxWidth, maxHeight)

        this.matrixTextures = []
        this.matrixSums = []
        for (let r = 1; r <= lyric_line_blur_radius; r++) {
            const matrix = getGaussiumWeightMatrix(r)
            this.matrixTextures[r] = twgl.createTexture(this.gl, {
                format: this.gl.LUMINANCE,
                src: matrix.matrix,
                width: 2 * r + 1
            })
            this.matrixSums[r] = matrix.sum
        }
        for (let line of this.lyricLines) {
            line.initWebglResources()
        }

        //TODO: support exittime
    }

    move(t, dt) {
        //t: time since started playing, in seconds
        const duration = 0.6
        const l = this.lyricLines[this.willplay_index]
        if (t >= l.time - duration) {
            this.lyricLines[this.willplay_index - 1].state = LineStates.goingHistory
            const targetMove = this.lyricLines[this.willplay_index - 1].height + this.space,
                player = this, starttime = t
            for (let i = this.willplay_index - 1;
                i < this.lyricLines.length;
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
                        player.lyricLines[i].y -= x
                        lastxt = xt
                    } else if (xt > duration) {
                        const x = pos(xt) - pos(lastxt)
                        player.lyricLines[i].y -= x
                        for (let o = 0; o < player.lyricLines[i].animations.length; o++) {
                            if (player.lyricLines[i].animations[o] == a) {
                                delete player.lyricLines[i].animations[o]
                            }
                        }
                        if (player.lyricLines[i] == l) l.state = LineStates.current
                    }
                    //else if xt<=0: stay still
                }
                const b = function (t, dt) {
                    player.lyricLines[i].y -= targetMove
                    for (let o = 0; o < player.lyricLines[i].animations.length; o++) {
                        if (player.lyricLines[i].animations[o] == b) {
                            delete player.lyricLines[i].animations[o]
                        }
                    }
                }
                player.lyricLines[i].animations.push(a)
            }
            this.willplay_index++;
            if (this.willplay_index >= this.lyricLines.length) this.playing = false
        }

        for (let i = 0; i < this.lyricLines.length; i++) {
            this.lyricLines[i].move(t, dt)
        }
    }

    render() {
        this.gl.clearColor(0, 0, 0, 0)
        this.gl.clear(this.gl.COLOR_BUFFER_BIT)
        for (let i of this.lyricLines) i.render()
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

//Draw these curves on geogebra.org, and you'll know what are they.
let resizeCurve = new Curve(function (x) {
    const a = -0.5 * x ** 2,
        b = 2 ** a
    return b
})
let alphaCurve = new Curve(function (x) {
    const a = x ** 2,
        b = -100 * a,
        c = 2 ** b
    return c
})
let blurRadiusCurve = new Curve(function (x) {
    const k = 1 / Math.log2(11)
    return k * Math.log2(10 * x + 1)
})
let positionCurve = new Curve(function (x) {
    if (x <= 0) return 0
    else if (x <= 0.5) return 16 * x ** 5
    else if (x <= 1) return 1 - 16 * (1 - x) ** 5
    else return 1
})


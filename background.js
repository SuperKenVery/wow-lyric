/* jshint esversion: 9 */
import { blur } from "./blur.js"
import { resize } from "./gl.js"
function random(min, max) {
    let span = max - min
    let r = Math.random() * span + min
    return r
}
function getSpinCenterOfBackground(out = 0) {
    let y = random(-out, 1 + out), x = random(-out, 1 + out)
    return [x, y]
}
function getSpinCenterOfImage() {
    let x = random(0, 1), y = random(0, 1)
    return [x, y]
}

class Spinner {
    constructor(image, canvasCtx) {
        /*
        image: imagedata
        */
        const canvas = canvasCtx.canvas
        const w = canvas.width, h = canvas.height
        this.image = image
        this.canvasCtx = canvasCtx
        const bgsc = getSpinCenterOfBackground()
        this.bgSpinCenter = [bgsc[0] * w, bgsc[1] * h]
        const zoom = w / this.image.width
        this.scale = random(zoom * 0.7, zoom * 1.2)
        {
            const scaledImageCanvas = document.createElement("canvas")
            const scaledImgaeContext = scaledImageCanvas.getContext('2d')
            const sw = this.scale * image.width, sh = this.scale * image.height
            scaledImageCanvas.width = sw; scaledImageCanvas.height = sh;
            const scaledImageData = resize(image, sw, sh)
            scaledImgaeContext.putImageData(scaledImageData, 0, 0)
            this.scaledImageCanvas = scaledImageCanvas
        }
        const imgsc = getSpinCenterOfImage()
        const imgSpinCenter = [imgsc[0] * this.scaledImageCanvas.width, imgsc[1] * this.scaledImageCanvas.height]
        this.drawPos = [-imgSpinCenter[0], -imgSpinCenter[1]]
        this.angle = 0
        this.v = random(Math.PI * 2 / 800, Math.PI * 2 / 400)
    }
    move(t, dt) {
        this.angle += this.v * dt
    }
    render() {
        const ctx = this.canvasCtx
        ctx.save()
        ctx.translate(this.bgSpinCenter[0], this.bgSpinCenter[1])
        ctx.rotate(this.angle)
        //We are not using imagedata but canvas and drawImage() here,
        //because putImageData isn't affected by transformations.
        //That is, we can't rotate the image.
        ctx.drawImage(this.scaledImageCanvas, this.drawPos[0], this.drawPos[1])
        ctx.restore()
    }
}

export class Background {
    constructor(image, bgCanvasCtx) {
        /*
        image: imagedata
        */
        //Cut the image
        this.playing = false

        let ul, ur, bl, br
        {
            const w = image.width, h = image.height
            const canvas = document.createElement("canvas")
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext("2d")
            ctx.putImageData(image, 0, 0)


            //upper left, upper right, bottom left, bottom right
            ul = ctx.getImageData(0, 0, w / 2, h / 2); ur = ctx.getImageData(w / 2, 0, w, h / 2)
            bl = ctx.getImageData(0, h / 2, w / 2, h); br = ctx.getImageData(w / 2, h / 2, w, h)
            canvas.remove()
        }

        //Scale for background
        {
            const ratio = Math.max(bgCanvasCtx.canvas.width / image.width, bgCanvasCtx.canvas.height / image.height)
            this.scaledImage = resize(image, ratio * image.width, ratio * image.height)
        }
        //Canvas before blur
        this.noBlurCanvas = document.createElement("canvas")
        this.noBlurCanvas.width = bgCanvasCtx.canvas.width
        this.noBlurCanvas.height = bgCanvasCtx.canvas.height
        //this.noBlurCanvas = document.getElementById("lyric")
        this.noBlurCtx = this.noBlurCanvas.getContext("2d")

        //Create Spinners
        this.bgCanvasCtx = bgCanvasCtx
        this.spinners = [
            new Spinner(ul, this.noBlurCtx), new Spinner(ur, this.noBlurCtx),
            new Spinner(bl, this.noBlurCtx), new Spinner(br, this.noBlurCtx),
        ]
    }
    move(t, dt) {
        for (let i of this.spinners) {
            i.move(t, dt)
        }
    }
    render() {
        this.noBlurCtx.putImageData(this.scaledImage, 0, 0)
        for (let i of this.spinners) {
            i.render()
        }

        const noBlur = this.noBlurCtx.getImageData(0, 0, this.noBlurCanvas.width, this.noBlurCanvas.height)
        let blurred = blur(noBlur, 100)
        this.bgCanvasCtx.putImageData(blurred, 0, 0)
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
        let bg = this
        let move_wrapper = function (timestamp) {
            let ms = (new Date()).getTime() - bg.starttime,
                t = ms / 1000,
                dt = t - bg.lasttime
            bg.lasttime = t

            bg.move(t, dt)
            bg.render()
            //window.requestAnimationFrame(move_wrapper)
        }
        //window.requestAnimationFrame(move_wrapper)
        const fps=2
        this.intervalId=setInterval(move_wrapper,1000/fps)
        move_wrapper()
    }
}

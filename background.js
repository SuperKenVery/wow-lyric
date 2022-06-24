/* jshint esversion: 9 */
import { blur } from "./blur.js"
function random(min, max) {
    let span = max - min
    let r = Math.random() * span + min
    return r
}
function getSpinCenterOfBackground(out = 0.5) {
    let y = random(-out, 1 + out), x = 0
    if (y <= 0 || (y > 1 && y <= 1 + out)) {
        x = random(-out, 1 + out)
    } else if (y > 0 && y <= 1) {
        let xx = random(-out, out)
        if (xx > 0) xx += 1
        x = xx
    } else {
        throw "randomGeneratorError"
    }
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
        {
            const scaledImageCanvas = document.createElement("canvas")
            scaledImageCanvas.width = w
            scaledImageCanvas.height = h
            const scaledImgaeContext = scaledImageCanvas.getContext('2d')
            scaledImgaeContext.scale(this.scale, this.scale)
            scaledImgaeContext.putImageData(image, 0, 0)
            this.scaledImageCanvas = scaledImageCanvas
        }
        const imgsc = getSpinCenterOfImage()
        const imgSpinCenter = [imgsc[0] * this.scaledImageCanvas.width, imgsc[1] * this.scaledImageCanvas.height]
        this.drawPos = [-imgSpinCenter[0], -imgSpinCenter[1]]
        this.angle = 0
        this.v = random(Math.PI * 2 / 1600, Math.PI * 2 / 800)
        const zoom = 1 / (this.image.width / w)
        this.scale = random(zoom * 8, zoom * 15)


    }
    move(t, dt) {
        this.angle += this.v //* dt
        //The animation requires too much GPU power...
        //Maybe we should make sure that it doesn't move too much
        //between frames, when it's 1 fps.
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
            const canvas = document.createElement("canvas")
            const ratio = Math.max(bgCanvasCtx.canvas.width / image.width, bgCanvasCtx.canvas.height / image.height)
            canvas.width = image.width * ratio
            canvas.height = image.height * ratio
            const ctx = canvas.getContext("2d")
            ctx.scale(ratio, ratio)
            ctx.putImageData(image, 0, 0)
            this.scaledImage = ctx.getImageData(0, 0, canvas.width, canvas.height)
            canvas.remove()
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


        }
        const fps=1/3
        this.intervalId=setInterval(move_wrapper,1000/fps)
        move_wrapper()
    }
}

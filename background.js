/* jshint esversion: 9 */
import { getGaussiumWeightMatrix, textureBlur, put } from "./gl.js"
import * as twgl from './twgl-full.module.js'
import { LyricPlayer } from "./lyrics.js"
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
function spin(a, s, c) {
    /*
    @param a: the vector
    @param s: sin value of the angle
    @param c: cos value of the angle
    */
    let x, y
    [x, y] = a
    return [x * c - y * s, y * c + x * s]
}

class Spinner {
    constructor(image, put, gl, part) {
        /*
        image: ImageData
        */
        const w = gl.canvas.width, h = gl.canvas.height
        this.image = image
        this.put = put
        this.part = part

        const bgsc = getSpinCenterOfBackground() //The spin center's position on the background
        this.bgSpinCenter = [bgsc[0] * w, bgsc[1] * h]
        const zoom = w / this.image.width
        this.scale = random(zoom * 0.7, zoom * 1.2)
        this.srcSize = [image.width * this.scale, image.height * this.scale]

        const imgsc = getSpinCenterOfImage() //The spin center's position on this image
        this.imgSpinCenter = [imgsc[0] * image.width * this.scale, imgsc[1] * image.height * this.scale]
        this.angle = 0
        this.v = random(Math.PI * 2 / 800, Math.PI * 2 / 400)
    }
    move(t, dt) {
        this.angle += this.v * dt
    }
    render() {
        this.put(this.angle, this.bgSpinCenter, this.imgSpinCenter, this.part, this.srcSize)
    }
}

export class Background {
    constructor(image, gl) {
        /*
        image: imagedata
        */
        //const gl = document.getElementById("background").getContext("webgl")
        this.gl = gl
        this.playing = false

        //Cut the image
        let ul, ur, bl, br
        {
            const w = image.width, h = image.height
            const canvas = document.createElement("canvas")
            canvas.id = "tmp canvas for cutting the alum artwork"
            canvas.width = w
            canvas.height = h
            const ctx = canvas.getContext("2d")
            ctx.putImageData(image, 0, 0)


            //upper left, upper right, bottom left, bottom right
            ul = ctx.getImageData(0, 0, w / 2, h / 2); ur = ctx.getImageData(w / 2, 0, w / 2, h / 2)
            bl = ctx.getImageData(0, h / 2, w / 2, h / 2); br = ctx.getImageData(w / 2, h / 2, w / 2, h / 2)
            canvas.remove()
        }

        //Scale for background
        {
            const ratio = Math.max(gl.drawingBufferWidth / image.width, gl.drawingBufferHeight / image.height)
            this.srcSize = [ratio * image.width, ratio * image.height]
        }

        //WebGL put
        const shrink = 20 //the noBlurFb could be smaller
        let spinAndPut, noBlurFb
        {
            const putProgramInfo = twgl.createProgramInfo(gl, [
                `
                attribute vec2 a_targetPos; //pixel space
                attribute vec2 a_srcPos; //clip space
                uniform vec2 targetSize;
                varying vec2 srcPos; //clip space

                void main(){
                    gl_Position=vec4(a_targetPos/targetSize*2.0-1.0,0,1);

                    srcPos=a_srcPos;
                }
                `,
                `
                precision mediump float;

                varying vec2 srcPos; //clip space
                uniform sampler2D srcImage;

                void main(){
                    gl_FragColor=texture2D(srcImage,srcPos);
                }
                `
            ])

            const textures = twgl.createTextures(gl, {
                ul: {
                    src: ul
                },
                ur: {
                    src: ur
                },
                bl: {
                    src: bl
                },
                br: {
                    src: br
                },
                bg: {
                    src: image
                },
            })
            const fbs = {
                ul: twgl.createFramebufferInfo(gl, [{ attachment: textures.ul }]),
                ur: twgl.createFramebufferInfo(gl, [{ attachment: textures.ur }]),
                bl: twgl.createFramebufferInfo(gl, [{ attachment: textures.bl }]),
                br: twgl.createFramebufferInfo(gl, [{ attachment: textures.br }]),
                bg: twgl.createFramebufferInfo(gl, [{ attachment: textures.bg }])
            }

            noBlurFb = twgl.createFramebufferInfo(gl, [
                {
                    format: gl.RGBA
                }
            ], gl.canvas.width / shrink, gl.canvas.height / shrink)

            spinAndPut = function (angle, bgPos, imgPos, part, srcSize) {
                const w = srcSize[0], h = srcSize[1], c = Math.cos(angle), s = Math.sin(angle)
                const rawPos = [
                    [-imgPos[0], h - imgPos[1]],
                    [-imgPos[0], -imgPos[1]],
                    [w - imgPos[0], h - imgPos[1]],
                    [w - imgPos[0], -imgPos[1]],
                ]
                let rotatedPos = []
                for (let pos of rawPos) {
                    rotatedPos.push(spin(pos, s, c))
                }
                let targetPos = []
                for (let pos of rotatedPos) {
                    targetPos.push([pos[0] + bgPos[0], pos[1] + bgPos[1]])
                }
                let targetPositions = []
                for (let pos of targetPos) {
                    targetPositions.push(pos[0])
                    targetPositions.push(pos[1])
                }
                put(gl, targetPositions, fbs[part], noBlurFb)

            }
        }
        this.spinAndPut = spinAndPut

        //WebGL blur
        let blur
        {
            const blur_radius = 500 / shrink
            const secondary_radius = 10
            //FrameBuffer
            const blurTmpFb = twgl.createFramebufferInfo(gl, [{ format: gl.RGBA }], gl.canvas.width, gl.canvas.height),
                blurTmpShrinkedFb = twgl.createFramebufferInfo(gl, [{ format: gl.RGBA }], gl.canvas.width / shrink, gl.canvas.height / shrink),
                blurredShrinkedFb = twgl.createFramebufferInfo(gl, [{ format: gl.RGBA }], gl.canvas.width / shrink, gl.canvas.height / shrink)
            //Attributes
            const arrays = {
                a_position: {
                    numComponents: 2,
                    data: [
                        -1, -1,
                        -1, 1,
                        1, -1,
                        1, 1
                    ],
                },
                a_textureCoordinate: {
                    numComponents: 2,
                    data: [
                        0, 0,
                        0, 1,
                        1, 0,
                        1, 1
                    ],
                }
            }
            const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)
            const bufferInfos = {
                x: bufferInfo,
                y: bufferInfo
            }
            //Textures
            const matrix = getGaussiumWeightMatrix(blur_radius)
            const textures = twgl.createTextures(gl, {
                matrix: {
                    src: matrix.matrix,
                    format: gl.LUMINANCE,
                    width: 2 * blur_radius + 1,
                }
            })
            const secondary_matrix = getGaussiumWeightMatrix(secondary_radius)
            const secondary_textures = twgl.createTextures(gl, {
                matrix: {
                    src: secondary_matrix.matrix,
                    format: gl.LUMINANCE,
                    width: 2 * secondary_radius + 1,
                }
            })
            //Uniforms
            //u_image and u_textureSize will be updated in blur_once
            const uniform = {
                u_image: 0,
                u_textureSize: [0, 0],
                matrix: textures.matrix,
                matrix_sum: matrix.sum
            }
            const uniforms = {
                x: uniform,
                y: uniform
            }
            const secondary_uniform = {
                u_image: 0,
                u_textureSize: [0, 0],
                matrix: secondary_textures.matrix,
                matrix_sum: secondary_matrix.sum
            }
            const secondary_uniforms = {
                x: secondary_uniform,
                y: secondary_uniform
            }

            blur = function () {
                textureBlur(gl, noBlurFb, blurTmpShrinkedFb, blurredShrinkedFb, bufferInfos, uniforms, blur_radius)
                textureBlur(gl, blurredShrinkedFb, blurTmpFb, null, bufferInfos, secondary_uniforms, secondary_radius)
            }
        }
        this.blur = blur


        //Create Spinners
        this.spinners = [
            new Spinner(ul, this.spinAndPut, gl, 'ul'), new Spinner(ur, this.spinAndPut, gl, 'ur'),
            new Spinner(bl, this.spinAndPut, gl, 'bl'), new Spinner(br, this.spinAndPut, gl, 'br'),
        ]
    }
    move(t, dt) {
        for (let i of this.spinners) {
            i.move(t, dt)
        }
    }
    render() {
        this.spinAndPut(0, [0, 0], [0, 0], 'bg', this.srcSize)
        for (let i of this.spinners) {
            i.render()
        }
        this.blur()
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
        this.playing = true
        let bg = this
        let move_wrapper = function (timestamp) {
            let ms = (new Date()).getTime() - bg.starttime,
                t = ms / 1000,
                dt = t - bg.lasttime
            bg.lasttime = t

            bg.move(t, dt)
            bg.render()
            if (bg.playing) {
                //window.requestAnimationFrame(move_wrapper)
            }
        }
        //window.requestAnimationFrame(move_wrapper)

        //It's not 60 fps on iOS anyway
        //So the performance is something Apple can't even tackle with
        //So I'm better off not messing with that
        const fps = 10
        this.intervalId = setInterval(move_wrapper, 1000 / fps)
        move_wrapper()
    }
}


//background.js uses a custom blur program, because the source image is a texture
//and the target is simply the canvas.
//That's quite different from blur.js:blur which uses ImageData as input/output


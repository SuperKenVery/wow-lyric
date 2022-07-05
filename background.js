/* jshint esversion: 9 */
import { resize } from "./gl.js"
import { getGaussiumWeightMatrix, textureBlur } from "./blur.js"
import * as twgl from './twgl-full.module.js'
import { LyricPlayer } from "./animation.js"
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
            canvas.id="tmp canvas for cutting the alum artwork"
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
        let put, noBlurFb
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

            noBlurFb = twgl.createFramebufferInfo(gl, [
                {
                    format: gl.RGBA
                }
            ], gl.canvas.width / shrink, gl.canvas.height / shrink)

            put = function (angle, bgPos, imgPos, part, srcSize) {
                const t = textures[part]
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
                const arrays = {
                    a_targetPos: {
                        numComponents: 2,
                        data: targetPositions,
                    },
                    a_srcPos: {
                        numComponents: 2,
                        data: [
                            0, 0,
                            0, 1,
                            1, 0,
                            1, 1,
                        ]
                    }
                }
                const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)
                const uniforms = {
                    targetSize: [gl.drawingBufferWidth, gl.drawingBufferHeight],
                    srcImage: t,
                }

                twgl.bindFramebufferInfo(gl, noBlurFb)
                //twgl.bindFramebufferInfo(gl)
                //gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
                gl.useProgram(putProgramInfo.program)
                twgl.setBuffersAndAttributes(gl, putProgramInfo, bufferInfo)
                twgl.setUniforms(putProgramInfo, uniforms)
                twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP)
                gl.deleteBuffer(bufferInfo.a_targetPos)
                gl.deleteBuffer(bufferInfo.a_srcPos)

            }
        }
        this.put = put

        //WebGL blur
        let blur
        {
            const blur_radius = 500 / shrink
            const secondary_radius = 5
            //Program
            const xProgram = twgl.createProgramInfo(gl, [
                `
                //vertex shader
                attribute vec2 a_position;
                attribute vec2 a_textureCoordinate;

                uniform int r;

                varying vec2 v_textureCoordinate;
                void main(){
                    gl_Position=vec4(a_position,0,1);

                    //For fragment shader
                    v_textureCoordinate=a_textureCoordinate;
                }
                `,
                `
                precision mediump float;
                precision highp int;

                uniform sampler2D u_image;
                uniform vec2 u_textureSize;
                uniform sampler2D matrix;//Must be (2*maxR+1)x(2*maxR+1), type LUMINANCE
                uniform float matrix_sum;//Used after adding up the sum. Devide by it.

                varying vec2 v_textureCoordinate;

                void main(){
                    vec2 onePixel=vec2(1,1)/u_textureSize;//a pixel of image
                    vec2 onePlace=vec2(1,1)/vec2(2*${blur_radius}+1,2*${blur_radius}+1);//a place of matrix
                    vec4 pixelSum=vec4(0,0,0,0);
                    //Blur here!
                    for(int matrix_x=-${blur_radius};matrix_x<=${blur_radius};matrix_x++){
                        float weight=texture2D(matrix,vec2(0.5,0.5)+onePlace*vec2(matrix_x,0))[0];
                        vec4 pixel=texture2D(u_image,v_textureCoordinate+onePixel*vec2(matrix_x,0));
                        pixelSum+=pixel*(weight/matrix_sum);
                        //we can't pass float but only int in texture
                        //so devide in advance to prevent overflow
                    }
                    gl_FragColor=pixelSum;
                }
                `
            ])
            const yProgram = twgl.createProgramInfo(gl, [
                `
                //vertex shader
                attribute vec2 a_position;
                attribute vec2 a_textureCoordinate;

                uniform int r;

                varying vec2 v_textureCoordinate;
                void main(){
                    gl_Position=vec4(a_position,0,1);

                    //For fragment shader
                    v_textureCoordinate=a_textureCoordinate;
                }
                `,
                `
                precision mediump float;
                precision highp int;

                uniform sampler2D u_image;
                uniform vec2 u_textureSize;
                uniform sampler2D matrix;//Must be (2*maxR+1)x(2*maxR+1), type LUMINANCE
                uniform float matrix_sum;//Used after adding up the sum. Devide by it.

                varying vec2 v_textureCoordinate;

                void main(){
                    vec2 onePixel=vec2(1,1)/u_textureSize;//a pixel of image
                    vec2 onePlace=vec2(1,1)/vec2(2*${blur_radius}+1,2*${blur_radius}+1);//a place of matrix
                    vec4 pixelSum=vec4(0,0,0,0);
                    //Blur here!
                    for(int matrix_y=-${blur_radius};matrix_y<=${blur_radius};matrix_y++){
                        float weight=texture2D(matrix,vec2(0.5,0.5)+onePlace*vec2(matrix_y,0))[0];
                        vec4 pixel=texture2D(u_image,v_textureCoordinate+onePixel*vec2(0,matrix_y));
                        pixelSum+=pixel*(weight/matrix_sum);
                        //we can't pass float but only int in texture
                        //so devide in advance to prevent overflow
                    }
                    gl_FragColor=pixelSum;
                }
                `
            ])
            //FrameBuffer
            const blurTmpFb = twgl.createFramebufferInfo(gl, [
                {
                    format: gl.RGBA
                }
            ], gl.canvas.width, gl.canvas.height),
                blurTmpShrinkedFb = twgl.createFramebufferInfo(gl, [
                    {
                        format: gl.RGBA
                    }
                ], gl.canvas.width / shrink, gl.canvas.height / shrink),
                blurredShrinkedFb = twgl.createFramebufferInfo(gl, [
                    {
                        format: gl.RGBA
                    }
                ], gl.canvas.width / shrink, gl.canvas.height / shrink)
            //Attributes
            const arraysx = {
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
            const bufferInfox = twgl.createBufferInfoFromArrays(gl, arraysx)
            const arraysy = {
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
            const bufferInfoy = twgl.createBufferInfoFromArrays(gl, arraysy)
            const bufferInfos = {
                x: bufferInfox,
                y: bufferInfoy
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
            const uniforms = {
                x: {
                    u_image: 0,
                    u_textureSize: [0, 0],
                    matrix: textures.matrix,
                    matrix_sum: matrix.sum
                },
                y: {
                    u_image: 0,
                    u_textureSize: [0, 0],
                    matrix: textures.matrix,
                    matrix_sum: matrix.sum
                }
            }
            const secondary_uniforms = {
                x: {
                    u_image: 0,
                    u_textureSize: [0, 0],
                    matrix: secondary_textures.matrix,
                    matrix_sum: secondary_matrix.sum
                },
                y: {
                    u_image: 0,
                    u_textureSize: [0, 0],
                    matrix: secondary_textures.matrix,
                    matrix_sum: secondary_matrix.sum
                }
            }

            blur = function () {
                textureBlur(gl, noBlurFb, blurTmpShrinkedFb, blurredShrinkedFb, bufferInfos, uniforms, blur_radius)
                textureBlur(gl, blurredShrinkedFb, blurTmpFb, null, bufferInfos, secondary_uniforms, secondary_radius)
            }
        }
        this.blur = blur


        //Create Spinners
        this.spinners = [
            new Spinner(ul, put, gl, 'ul'), new Spinner(ur, put, gl, 'ur'),
            new Spinner(bl, put, gl, 'bl'), new Spinner(br, put, gl, 'br'),
        ]
    }
    move(t, dt) {
        for (let i of this.spinners) {
            i.move(t, dt)
        }
    }
    render() {
        this.put(0, [0, 0], [0, 0], 'bg', this.srcSize)
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
        this.playing=true
        let bg = this
        let move_wrapper = function (timestamp) {
            let ms = (new Date()).getTime() - bg.starttime,
                t = ms / 1000,
                dt = t - bg.lasttime
            bg.lasttime = t

            bg.move(t, dt)
            bg.render()
            if(bg.playing){
                window.requestAnimationFrame(move_wrapper)
            }
        }
        window.requestAnimationFrame(move_wrapper)
        /*const fps = 2
        this.intervalId = setInterval(move_wrapper, 1000 / fps)
        move_wrapper()*/
    }
}


//background.js uses a custom blur program, because the source image is a texture
//and the target is simply the canvas.
//That's quite different from blur.js:blur which uses ImageData as input/output


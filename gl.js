/* jshint esversion: 9 */
import * as twgl from './twgl-full.module.js'
const ggl = document.createElement("canvas").getContext("webgl") //global gl
ggl.canvas.id = "global canvas for blur.js"
//const gl=document.getElementById("lyric").getContext("webgl")

//Gaussium blur
export let textureBlur, getGaussiumWeightMatrix
{
    let blurProgramInfos = {}
    const getBlurProgram = function (r, gl) {
        /*Relies on gl.canvas.id to distinguish different gl contexts
        So remember to set the id when you create a canvas!
        */

        if (blurProgramInfos[gl.canvas.id] == undefined) {
            blurProgramInfos[gl.canvas.id] = []
        }
        const glBlurPIs = blurProgramInfos[gl.canvas.id]
        if (glBlurPIs[r] == undefined) {
            const xProgramInfo = twgl.createProgramInfo(gl, [
                `
                //vertex shader
                attribute vec2 a_position;
                attribute vec2 a_textureCoordinate;

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
                    vec2 onePlace=vec2(1,1)/vec2(2*${r}+1,2*${r}+1);//a place of matrix
                    vec4 pixelSum=vec4(0,0,0,0);
                    //Blur here!
                    for(int matrix_x=-${r};matrix_x<=${r};matrix_x++){
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
            const yProgramInfo = twgl.createProgramInfo(gl, [
                `
                //vertex shader
                attribute vec2 a_position;
                attribute vec2 a_textureCoordinate;

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
                    vec2 onePlace=vec2(1,1)/vec2(2*${r}+1,2*${r}+1);//a place of matrix
                    vec4 pixelSum=vec4(0,0,0,0);
                    //Blur here!
                    for(int matrix_y=-${r};matrix_y<=${r};matrix_y++){
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
            glBlurPIs[r] = {
                x: xProgramInfo,
                y: yProgramInfo,
            }
        }

        return glBlurPIs[r]

    }
    textureBlur = function (gl, src, tmp, dst, bufferInfos, uniforms, r) {
        /* A blur that happens totally inside GPU
        Image source and blur destinations are textures

        src, tmp, dst: twgl.FrameBufferInfo

        bufferInfo={
            x: twgl.createBufferInfoFromArrays(...),
            y: twgl.createBufferInfoFromArrays(...)
        }
        uniforms={
            x:{
                uniform: value
            },
            y:{
                uniform:value
            }
        }
        */
        const blurProgram = getBlurProgram(r, gl)

        twgl.bindFramebufferInfo(gl, tmp)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.useProgram(blurProgram.x.program)
        twgl.setBuffersAndAttributes(gl, blurProgram.x, bufferInfos.x)
        uniforms.x.u_image = src.attachments[0]
        uniforms.x.u_textureSize = [src.width, src.height]
        twgl.setUniforms(blurProgram.x, uniforms.x)
        twgl.drawBufferInfo(gl, bufferInfos.x, gl.TRIANGLE_STRIP)

        twgl.bindFramebufferInfo(gl, dst)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.useProgram(blurProgram.y.program)
        twgl.setBuffersAndAttributes(gl, blurProgram.y, bufferInfos.y)
        uniforms.y.u_image = tmp.attachments[0]
        uniforms.y.u_textureSize = [tmp.width, tmp.height]
        twgl.setUniforms(blurProgram.y, uniforms.y)
        twgl.drawBufferInfo(gl, bufferInfos.y, gl.TRIANGLE_STRIP)
    }

    let gaussiumWeightMatrixCache = []
    getGaussiumWeightMatrix = function (radius) {
        let gaussiumWeight = null, gaussiumWeightSum = 0
        if (gaussiumWeightMatrixCache[radius] != undefined) {
            gaussiumWeight = gaussiumWeightMatrixCache[radius].gaussiumWeight
            gaussiumWeightSum = gaussiumWeightMatrixCache[radius].gaussiumWeightSum
        } else {
            gaussiumWeight = new Float32Array(2 * radius + 1)
            gaussiumWeightSum = 0
            const p = 0, r = radius, rr = r ** 2, A = 1 - p ** 2, B = 1 / (2 * Math.PI * rr * A ** 0.5), C = -1 / (2 * A)
            let t = 0, f = 0
            for (let x = -r; x <= r; x++) {
                //y=0
                t = C * (x ** 2) / rr
                f = B * Math.exp(t)
                gaussiumWeight[x + r] = f * 255 //will be devided by 255 in texture2d
                gaussiumWeightSum += f
            }
            let max_val = gaussiumWeight[r]
            let multiply = 255 / max_val
            for (let i = 0; i < gaussiumWeight.length; i++) {
                gaussiumWeight[i] *= multiply
            }
            gaussiumWeightSum *= multiply
            gaussiumWeight = new Uint8Array(gaussiumWeight)
            gaussiumWeightMatrixCache[radius] = {
                gaussiumWeight: gaussiumWeight,
                gaussiumWeightSum: gaussiumWeightSum,
            }
        }
        return {
            matrix: gaussiumWeight,
            sum: gaussiumWeightSum
        }
    }
}

//Put
export let put
{
    let putProgramInfos = {}
    const putProgramSrc = [
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
        uniform float alpha_mul;

        void main(){
            gl_FragColor=texture2D(srcImage,srcPos);
            gl_FragColor.a*=alpha_mul;
        }
        `
    ]
    const defaultSrcPos = [
        0, 1,
        0, 0,
        1, 1,
        1, 0,
    ]
    put = function (gl, targetPositions, src, dst, alpha = 1, srcPos = defaultSrcPos) {
        /*
        @param src: FrameBufferInfo
        @param dst: FrameBufferInfo
        @param targetPositions: Array, length=8 (4 dots), in order:
            (1)  (3)
            (2)  (4)
        */
        if (putProgramInfos[gl.canvas.id] == undefined) {
            putProgramInfos[gl.canvas.id] = twgl.createProgramInfo(gl, putProgramSrc)
        }
        const putProgramInfo = putProgramInfos[gl.canvas.id]
        const arrays = {
            a_targetPos: {
                numComponents: 2,
                data: targetPositions
            },
            a_srcPos: {
                numComponents: 2,
                data: srcPos
            }
        }
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)
        const uniforms = {
            targetSize: [gl.drawingBufferWidth, gl.drawingBufferHeight],
            srcImage: src.attachments[0],
            alpha_mul: alpha
        }
        twgl.bindFramebufferInfo(gl, dst)
        gl.useProgram(putProgramInfo.program)
        twgl.setBuffersAndAttributes(gl, putProgramInfo, bufferInfo)
        twgl.setUniforms(putProgramInfo, uniforms)
        twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP)
        gl.deleteBuffer(bufferInfo.attribs.a_targetPos.buffer)
        gl.deleteBuffer(bufferInfo.attribs.a_srcPos.buffer)
    }
}


function getImageData(gl) {
    let pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4)
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let clampedPixels = new Uint8ClampedArray(pixels)
    let imagedata = new ImageData(clampedPixels, gl.drawingBufferWidth, gl.drawingBufferHeight)
    return imagedata
}

/* jshint esversion: 9 */
import * as twgl from './twgl-full.module.js'
const gl = document.createElement("canvas").getContext("webgl")
//const gl=document.getElementById("lyric").getContext("webgl")


function createBlurProgram(r) {
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

    return {
        x: xProgram,
        y: yProgram,
    }

}

let blurProgramInfos = []

export function blur(sourceImage, r) {
    gl.canvas.width = sourceImage.width + 2 * r
    gl.canvas.height = sourceImage.height + 2 * r

    if (blurProgramInfos[r] == undefined) {
        blurProgramInfos[r] = createBlurProgram(r)
    }
    const blurProgramInfo = blurProgramInfos[r]

    const xfb = twgl.createFramebufferInfo(gl, [
        {
            format: gl.RGBA
        }
    ], sourceImage.width + 2 * r, sourceImage.height)
    //Attributes
    let overflowx = r / sourceImage.width, overflowy = r / sourceImage.height
    const arraysx = {
        a_position: {
            numComponents: 2,
            data: [-1, -1,
            -1, 1,
                1, -1,
                1, 1],
        },
        a_textureCoordinate: {
            numComponents: 2,
            data: [-overflowx, 0, -overflowx, 1, 1 + overflowx, 0, 1 + overflowx, 1],
        }
    }
    const bufferInfox = twgl.createBufferInfoFromArrays(gl, arraysx)
    const arraysy = {
        a_position: {
            numComponents: 2,
            data: [-1, -1,
            -1, 1,
                1, -1,
                1, 1],
        },
        a_textureCoordinate: {
            numComponents: 2,
            data: [-overflowx, -overflowy, -overflowx, 1 + overflowy, 1 + overflowx, -overflowy, 1 + overflowx, 1 + overflowy],
        }
    }
    const bufferInfoy = twgl.createBufferInfoFromArrays(gl, arraysy)

    //Textures
    let matrix = getGaussiumWeightMatrix(r)
    let textures = twgl.createTextures(gl, {
        srcImage: {
            src: sourceImage,
        },
        gaussiumWeightMatrix: {
            src: matrix.matrix,
            format: gl.LUMINANCE,
            width: 2 * r + 1,
        }
    })


    //Uniforms
    const uniformsx = {
        u_image: textures.srcImage,
        u_textureSize: [sourceImage.width, sourceImage.height],
        matrix: textures.gaussiumWeightMatrix,
        matrix_sum: matrix.sum
    }
    const uniformsy = {
        u_image: xfb.attachments[0],
        u_textureSize: [sourceImage.width, sourceImage.height],
        matrix: textures.gaussiumWeightMatrix,
        matrix_sum: matrix.sum
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    twgl.bindFramebufferInfo(gl, xfb)
    gl.useProgram(blurProgramInfo.x.program)
    twgl.setBuffersAndAttributes(gl, blurProgramInfo.x, bufferInfox)
    twgl.setUniforms(blurProgramInfo.x, uniformsx)
    twgl.drawBufferInfo(gl, bufferInfox, gl.TRIANGLE_STRIP)

    twgl.bindFramebufferInfo(gl, null)
    gl.useProgram(blurProgramInfo.y.program)
    twgl.setBuffersAndAttributes(gl, blurProgramInfo.y, bufferInfoy)
    twgl.setUniforms(blurProgramInfo.y, uniformsy)
    twgl.drawBufferInfo(gl, bufferInfoy, gl.TRIANGLE_STRIP)

    const result = getImageData(gl)

    {
        gl.deleteBuffer(bufferInfox.attribs.a_position.buffer)
        gl.deleteBuffer(bufferInfox.attribs.a_textureCoordinate.buffer)
        gl.deleteBuffer(bufferInfoy.attribs.a_position.buffer)
        gl.deleteBuffer(bufferInfoy.attribs.a_textureCoordinate.buffer)
        gl.deleteTexture(textures.srcImage)
        gl.deleteTexture(textures.gaussiumWeightMatrix)
        gl.deleteTexture(xfb.attachments[0])
        gl.deleteFramebuffer(xfb.framebuffer)
    }

    return result
}


let gaussiumWeightMatrixCache = []
function getGaussiumWeightMatrix(radius) {
    let gaussiumWeight = null, gaussiumWeightSum = 0
    if (gaussiumWeightMatrixCache[radius] != undefined) {
        gaussiumWeight = gaussiumWeightMatrixCache[radius].gaussiumWeight
        gaussiumWeightSum = gaussiumWeightMatrixCache[radius].gaussiumWeightSum
    } else {
        gaussiumWeight = new Float32Array(2 * radius + 1)
        gaussiumWeightSum = 0
        let p = 0, r = radius, rr = r ** 2, A = 1 - p ** 2, B = 1 / (2 * Math.PI * rr * A ** 0.5), C = -1 / (2 * A)
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

function getImageData(gl) {
    let pixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4)
    gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let clampedPixels = new Uint8ClampedArray(pixels)
    let imagedata = new ImageData(clampedPixels, gl.canvas.width, gl.canvas.height)
    return imagedata
}

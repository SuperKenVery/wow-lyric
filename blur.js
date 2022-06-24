/* jshint esversion: 9 */
import * as twgl from './twgl-full.module.js'
const gl = document.createElement("canvas").getContext("webgl")
//const gl=document.getElementById("lyric").getContext("webgl")


function createBlurProgram(r) {
    const blurProgram = twgl.createProgramInfo(gl, [
        `
        //vertex shader
        attribute vec2 a_position;
        attribute vec2 a_textureCoordinate;

        uniform vec2 u_resolution;
        uniform int r;

        varying vec2 v_textureCoordinate;
        void main(){
            gl_Position=vec4(a_position,0,1);

            //For fragment shader
            vec2 pixelSpace=a_textureCoordinate*(u_resolution+float(2*r));
            vec2 targetPixelSpace=pixelSpace+vec2(float(-r),float(-r));
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
                for(int matrix_y=-${r};matrix_y<=${r};matrix_y++){
                    float weight=texture2D(matrix,vec2(0.5,0.5)+onePlace*vec2(matrix_x,matrix_y))[0];
                    vec4 pixel=texture2D(u_image,v_textureCoordinate+onePixel*vec2(matrix_x,matrix_y));
                    pixelSum+=pixel*(weight/matrix_sum);
                    //we can't pass float but only int in texture
                    //so devide in advance to prevent overflow
                }
            }
            gl_FragColor=pixelSum;
        }
        `
    ])

    return blurProgram

}

let blurProgramInfos = []

export function blur(sourceImage, r) {
    gl.canvas.width=sourceImage.width+2*r
    gl.canvas.height=sourceImage.height+2*r

    if (blurProgramInfos[r] == undefined) {
        blurProgramInfos[r] = createBlurProgram(r)
    }
    let blurProgramInfo = blurProgramInfos[r]
    //Attributes
    let overflowx = r / sourceImage.width, overflowy = r / sourceImage.height
    const arrays = {
        a_position: {
            numComponents: 2,
            data: [-1, -1,
            -1, 1,
                1, -1,
                1, 1],
        },
        a_textureCoordinate: {
            numComponents: 2,
            //data: [-overflowx, -overflowy, -overflowx, 1 + overflowy, 1 + overflowx, -overflowy, 1 + overflowx, 1 + overflowy],
            data: [0,0,0,1,1,0,1,1]
        }
    }

    const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)
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
    const uniforms = {
        u_resolution: [sourceImage.width, sourceImage.height],
        u_image: textures.srcImage,
        u_textureSize: [sourceImage.width, sourceImage.height],
        matrix: textures.gaussiumWeightMatrix,
        matrix_sum: matrix.sum

    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.useProgram(blurProgramInfo.program)
    twgl.setBuffersAndAttributes(gl, blurProgramInfo, bufferInfo)
    twgl.setUniforms(blurProgramInfo, uniforms)
    twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP)

    const result=getImageData(gl)

    {
        gl.deleteTexture(textures.srcImage)
        gl.deleteTexture(textures.gaussiumWeightMatrix)
    }

    return result
}


let gaussiumWeightMatrixCache = []
function getGaussiumWeightMatrix(radius) {
    var gaussiumWeight = null, gaussiumWeightSum = 0
    if (gaussiumWeightMatrixCache[radius] != undefined) {
        gaussiumWeight = gaussiumWeightMatrixCache[radius].gaussiumWeight
        gaussiumWeightSum = gaussiumWeightMatrixCache[radius].gaussiumWeightSum
    } else {
        gaussiumWeight = new Float32Array((2 * radius + 1) ** 2)
        gaussiumWeightSum = 0
        let p = 0, r = radius, rr = r ** 2, A = 1 - p ** 2, B = 1 / (2 * Math.PI * rr * A ** 0.5), C = -1 / (2 * A)
        var t = 0, f = 0
        for (var x = -r; x <= r; x++) {
            for (var y = -r; y <= r; y++) {
                t = C * (x ** 2 + y ** 2 - p * x * y) / rr
                f = B * Math.exp(t)
                gaussiumWeight[(x + r) * (2 * r + 1) + (y + r)] = f * 255 //will be devided by 255 in texture2d
                gaussiumWeightSum += f
            }
        }
        var max_val = gaussiumWeight[r * (2 * r + 1) + r]
        var multiply = 255 / max_val
        for (var i = 0; i < gaussiumWeight.length; i++) {
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
    var pixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4)
    gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    var clampedPixels = new Uint8ClampedArray(pixels)
    var imagedata = new ImageData(clampedPixels, gl.canvas.width, gl.canvas.height)
    return imagedata
}

/* jshint esversion: 9 */
import * as twgl from './twgl-full.module.js'
const gl = document.createElement("canvas").getContext("webgl")
//const gl=document.getElementById("lyric").getContext("webgl")


function createComposeProgram(r) {
    const composeProgram = twgl.createProgramInfo(gl, [
        `
        attribute vec2 vertexPosition;
        attribute vec2 a_srcPosition; //in pixels, position in source image

        varying vec2 srcPosition;
        void main(){
            gl_Position=vec4(vertexPosition,0,1);

            //For fragment shader
            srcPosition=a_srcPosition;
        }
        `,
        `
        precision mediump float;

        uniform sampler2D weighedCache;
        uniform vec2 wcSize;

        varying vec2 srcPosition; //in pixels, position in source image

        int abs(int x){
            if(x>=0) return x;
            else return -x;
        }

        vec2 blur2cache(vec2 blurPosition){
            const float cwidth=float(int(${r}/2)+1); //the width in cache corresponding to one pixel
            if(blurPosition[0]>=cwidth){
                blurPosition[0]=${r}.0-1.0-blurPosition[0];
                blurPosition[1]=${r}.0-blurPosition[1];
            }
            //blurPosition is now cache position
            return blurPosition;
        }

        void main(){
            vec4 pixelSum=vec4(0,0,0,0);
            const vec2 csize=vec2(int(${r}/2)+1,${r});

            for(int matrix_x=-${r};matrix_x<=${r};matrix_x++){
                for(int matrix_y=-${r};matrix_y<=${r};matrix_y++){
                    vec2 blurPosition=vec2(abs(matrix_x),abs(matrix_y));
                    vec2 cachePosition=blur2cache(blurPosition);
                    vec2 pixelPosition=vec2((srcPosition[0]+float(matrix_x))*csize[0],(srcPosition[1]+float(matrix_y))*csize[1]);
                    vec2 targetPosition=pixelPosition+cachePosition;
                    pixelSum+=texture2D(weighedCache,targetPosition/wcSize);
                }
            }
            gl_FragColor=pixelSum;
        }
        `
    ])
    return composeProgram
}

function createCacheProgram(r) {
    const cacheProgram = twgl.createProgramInfo(gl, [
        `
        attribute vec2 a_position;
        attribute vec2 a_targetPosition;//in pixels

        varying vec2 targetPosition;
        void main(){
            gl_Position=vec4(a_position,0,1);

            targetPosition=a_targetPosition;
        }
        `,
        `
        precision mediump float;

        uniform sampler2D src_img;
        uniform vec2 img_size;
        uniform sampler2D matrix;
        uniform float matrix_sum;

        varying vec2 targetPosition;//in pixels,int

        void main(){
            const vec2 csize=vec2(int(${r}/2)+1,${r});   //the size in cache corresponding to one pixel
            //See Optimizing Gaussian blur.pdf
            vec2 srcPosition=   vec2( int(targetPosition[0]/csize[0]), int(targetPosition[1]/csize[1]) );
            vec2 cachePosition= vec2( targetPosition[0]-srcPosition[0]*csize[0], targetPosition[1]-srcPosition[1]*csize[1] );
            vec2 blurPosition=cachePosition;
            if(cachePosition[1]<cachePosition[0]){
                blurPosition=vec2(${r}.0-cachePosition[0],${r}.0-1.0-cachePosition[1]);
            }

            vec2 onePlace=vec2(1,1)/vec2(2*${r}+1,2*${r}+1);//a place of matrix
            float weight=texture2D(matrix,vec2(0.5,0.5)+onePlace*blurPosition)[0]/matrix_sum;
            vec4 srcPixel=texture2D(src_img,srcPosition/img_size);

            gl_FragColor=srcPixel*weight;
        }
        `
    ])
    return cacheProgram
}

function createBlurProgram(r) {
    return {
        cache: createCacheProgram(r),
        compose: createComposeProgram(r)
    }
}

let blurProgramInfos = []

export function blur(sourceImage, r) {
    if (r == 0) {
        return sourceImage;
    }

    if (blurProgramInfos[r] == undefined) {
        blurProgramInfos[r] = createBlurProgram(r)
    }
    let blurProgramInfo = blurProgramInfos[r]

    let weighed_cache_fb
    //weighed_cache size: int(r/2)+1,r
    const wcx = (Math.trunc(r / 2) + 1) * sourceImage.width, wcy = r * sourceImage.height //weighed_cache_{x,y}

    //Cache
    {
        //Set up framebuffer
        weighed_cache_fb = twgl.createFramebufferInfo(gl, [{ format: gl.RGBA }], wcx, wcy)
        twgl.bindFramebufferInfo(gl, weighed_cache_fb, gl.FRAMEBUFFER)
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
            throw ["Frame buffer error", gl.checkFramebufferStatus(gl.FRAMEBUFFER)]
        }

        //Attributes
        const arrays = {
            a_position: {
                numComponents: 2,
                data: [-1, -1,
                -1, 1,
                    1, -1,
                    1, 1],
            },
            a_targetPosition: {
                numComponents: 2,
                data: [0, 0,
                    0, sourceImage.height,
                    sourceImage.width, 0,
                    sourceImage.width, sourceImage.height],
            }
        }
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)


        //Textures
        const matrix = getGaussiumWeightMatrix(r)
        const textures = twgl.createTextures(gl, {
            src_img: {
                src: sourceImage,
            },
            matrix: {
                src: matrix.matrix,
                format: gl.LUMINANCE,
                width: 2 * r + 1,
            }
        })

        //Uniforms
        const uniforms = {
            src_img: textures.src_img,
            img_size: [sourceImage.width, sourceImage.height],
            matrix: textures.matrix,
            matrix_sum: matrix.sum,
        }

        gl.viewport(0, 0, wcx, wcy)
        gl.clearColor(0, 0, 0, 0)
        gl.useProgram(blurProgramInfo.cache.program)

        twgl.setBuffersAndAttributes(gl, blurProgramInfo.cache, bufferInfo)
        twgl.setUniforms(blurProgramInfo.cache, uniforms)

        twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP)

        {
            gl.deleteBuffer(bufferInfo.attribs.a_position.buffer)
            gl.deleteBuffer(bufferInfo.attribs.a_targetPosition.buffer)
            gl.deleteTexture(textures.src_img)
            gl.deleteTexture(textures.matrix)
        }
        //Result stored in weighed_cache_fb (twgl.frameBufferInfo)
    }

    //Compose
    {
        twgl.bindFramebufferInfo(gl, null, gl.FRAMEBUFFER)
        //Attributes
        const arrays = {
            vertexPosition: {
                numComponents: 2,
                data: [-1, -1,
                -1, 1,
                    1, -1,
                    1, 1],
            },
            a_srcPosition: {
                numComponents: 2,
                data: [-r, -r,
                -r, sourceImage.height + r,
                sourceImage.width + r, -r,
                sourceImage.width + r, sourceImage.height + r],
            }
        }
        const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays)

        //Textures: use results from weighed_cache_fb

        //Uniforms
        const uniforms = {
            weighedCache: weighed_cache_fb.attachments[0],
            wcSize: [wcx, wcy],
        }

        gl.canvas.width = sourceImage.width + 2 * r; gl.canvas.height = sourceImage.height + 2 * r
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.useProgram(blurProgramInfo.compose.program)

        twgl.setBuffersAndAttributes(gl, blurProgramInfo.compose, bufferInfo)
        twgl.setUniforms(blurProgramInfo.compose, uniforms)

        twgl.drawBufferInfo(gl, bufferInfo, gl.TRIANGLE_STRIP)

        const result = getImageData(gl)

        {
            gl.deleteBuffer(bufferInfo.attribs.vertexPosition.buffer)
            gl.deleteBuffer(bufferInfo.attribs.a_srcPosition.buffer)
            gl.deleteTexture(weighed_cache_fb.attachments[0])
            gl.deleteFramebuffer(weighed_cache_fb.framebuffer)
        }
        return result
    }


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

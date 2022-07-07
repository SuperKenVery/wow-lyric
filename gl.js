/* jshint esversion: 9 */
/* Thanks a lot to webglfundamentals.org !!
 * It really helped he a lot in learning webgl.
 * It tells everything so clearly.
 *
 * MDN failed to teach me this time, as it didn't
 * descript how to connect buffers, locations and
 * variables in shader sources well.
 */
import { lyric_line_blur_radius } from "./animation.js"
export function Text(text, fontsize, width) {
    let tmp_canvas = document.createElement('canvas')
    tmp_canvas.id = "tmp canvas for Text()"
    let ctx = tmp_canvas.getContext('2d')
    const setStyle = function () {
        const font = "700 " + String(fontsize) + "px Arial"
        ctx.textBaseline = 'top'
        ctx.font = font
        ctx.fillStyle = "white"
        ctx.textAlign = 'center'
    }

    tmp_canvas.width = width + 2 * lyric_line_blur_radius
    const lines = wrap(text, ctx, setStyle)
    setStyle()
    const measure = ctx.measureText(text)
    const height = measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent + 20 + 2 * lyric_line_blur_radius //The distance between each line's top line
    tmp_canvas.height = lines.length * height

    setStyle()
    const x = width / 2
    for (let line_index = 0; line_index < lines.length; line_index++) {
        const line = lines[line_index]
        ctx.fillText(line, x, height * line_index + measure.actualBoundingBoxAscent + lyric_line_blur_radius)
    }

    return ctx.getImageData(0, 0, tmp_canvas.width, tmp_canvas.height)
}

function wrap(text, ctx, styleSetter) {
    const width = ctx.canvas.width,
        measure = function (txt) {
            styleSetter()
            const metric = ctx.measureText(txt)
            const width = metric.actualBoundingBoxLeft + metric.actualBoundingBoxRight
            return width
        },
        words = text.split(" ")
    let lines = [], l = "", tl = l//l: line tl: test line
    for (let i = 0; i < words.length; i++) {
        tl += words[i]
        if (measure(tl) <= width) {
            tl += " "
            l = tl
        } else {
            if (l == "") {
                //The new line is empty
                //The word is longer than a whole line
                let nl //next line
                [l, nl] = splitAtWidth(words[i], measure, width)
                words.splice(i + 1, 0, nl)
            } else {
                i--
            }
            lines.push(l)
            l = ""
            tl = ""
        }
    }
    if (l != "") lines.push(l)
    return lines
}
function splitAtWidth(text, measure, width) {
    if (measure(text) <= width) {
        return [text, ""]
    } else {
        let a = "", ta = a//ta: test a
        for (let i = 0; i < text.length; i++) {
            ta += text[i]
            if (measure(ta) <= width) a = ta
            else {
                return [a, text.slice(i)]
            }
        }
    }

}

function createShader(gl, type, source) {
    let shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert("Failed compiling shader: " + gl.getShaderInfoLog(shader) + "\n" + source)
        gl.deleteShader(shader)
        return null
    }
    return shader
}

function createProgram(gl, vertexSource, fragmentSource) {
    let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource)
    let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)

    let shaderProgram = gl.createProgram()
    gl.attachShader(shaderProgram, vertexShader)
    gl.attachShader(shaderProgram, fragmentShader)
    gl.linkProgram(shaderProgram)

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Failed to link shader program: " + gl.getProgramInfoLog(shaderProgram))
        return null
    }

    return shaderProgram
}

function getImageData(gl) {
    let pixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4)
    gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let clampedPixels = new Uint8ClampedArray(pixels)
    let imagedata = new ImageData(clampedPixels, gl.canvas.width, gl.canvas.height)
    return imagedata
}

const maxR = 10
const blurProgramResource = {
    //vector shader
    vertex_shader_source: `
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
            //v_textureCoordinate=targetPixelSpace/u_resolution; //pass to fragment shader
        v_textureCoordinate=a_textureCoordinate;
        }
        `,
    //fragment shader
    fragment_shader_source: `
        precision mediump float;
    precision highp int;

        uniform sampler2D u_image;
        uniform vec2 u_textureSize;
    uniform sampler2D matrix;//Must be (2*maxR+1)x(2*maxR+1), type LUMINANCE
        uniform float matrix_sum;//Used after adding up the sum. Devide by it.

        varying vec2 v_textureCoordinate;

        void main(){
            vec2 onePixel=vec2(1,1)/u_textureSize;//a pixel of image
        vec2 onePlace=vec2(1,1)/vec2(2*${maxR}+1,2*${maxR}+1);//a place of matrix
            vec4 pixelSum=vec4(0,0,0,0);
            //Blur here!
            for(int matrix_x=-${maxR};matrix_x<=${maxR};matrix_x++){
                for(int matrix_y=-${maxR};matrix_y<=${maxR};matrix_y++){
            float weight=texture2D(matrix,vec2(0.5,0.5)+onePlace*vec2(matrix_x,matrix_y))[0];
            vec4 pixel=texture2D(u_image,v_textureCoordinate+onePixel*vec2(matrix_x,matrix_y));
                    pixelSum+=pixel*(weight/matrix_sum);
            //we can't pass float but only int in texture
            //so devide in advance to prevent overflow
                }
            }

            //gl_FragColor=pixelSum;
        //gl_FragColor=texture2D(matrix,v_textureCoordinate)/matrix_sum;
        gl_FragColor=pixelSum;
        //gl_FragColor=texture2D(u_image,v_textureCoordinate);

        }
        `,
    gaussiumMatrixCache: {},
    createBuffers: function (gl, imagedata, radius) {
        //canvas size
        gl.canvas.width = imagedata.width + 2 * radius
        gl.canvas.height = imagedata.height + 2 * radius
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
        //===Positions===
        let positionBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
        let positions = [
            1.0, 1.0,
            -1.0, 1.0,
            1.0, -1.0,
            -1.0, -1.0,
        ]
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(positions),
            gl.DYNAMIC_DRAW
        )
        //===position buffer is now positions

        //===Texture coordinates===
        let textureCoordinateBuffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordinateBuffer)
        let coordinates = [
            1.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            0.0, 0.0,
        ]
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(coordinates),
            gl.DYNAMIC_DRAW
        )
        //===textureCoordinateBuffer is now coordinates

        //===Gaussium weight matrix===
        //Generate gaussium weight matrix
        let gaussiumWeight = null, gaussiumWeightSum = 0
        if (this.gaussiumMatrixCache[radius] != undefined) {
            gaussiumWeight = this.gaussiumMatrixCache[radius].gaussiumWeight
            gaussiumWeightSum = this.gaussiumMatrixCache[radius].gaussiumWeightSum
        } else {
            gaussiumWeight = new Float32Array((2 * maxR + 1) ** 2)
            gaussiumWeightSum = 0
            let p = 0,
                r = radius,
                mr = maxR,
                rr = r ** 2,
                A = 1 - p ** 2,
                B = 1 / (2 * Math.PI * rr * A ** 0.5),
                C = -1 / (2 * A)
            let t = 0, f = 0
            for (let x = -r; x <= r; x++) {
                for (let y = -r; y <= r; y++) {
                    t = C * (x ** 2 + y ** 2 - p * x * y) / rr
                    f = B * Math.exp(t)
                    gaussiumWeight[(x + mr) * (2 * mr + 1) + (y + mr)] = f * 255 //will be devided by 255 in texture2d(?)
                    gaussiumWeightSum += f
                }
            }
            let max_val = gaussiumWeight[mr * (2 * mr + 1) + mr]
            let multiply = 255 / max_val
            for (let i = 0; i < gaussiumWeight.length; i++) {
                gaussiumWeight[i] *= multiply
            }
            gaussiumWeightSum *= multiply
            gaussiumWeight = new Uint8Array(gaussiumWeight)
            this.gaussiumMatrixCache[radius] = {
                gaussiumWeight: gaussiumWeight,
                gaussiumWeightSum: gaussiumWeightSum,
            }
        }



        let matrixBuffer = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, matrixBuffer)
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 2 * maxR + 1, 2 * maxR + 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, gaussiumWeight)


        let imageBuffer = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, imageBuffer)
        //enable image of any size
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imagedata)
        //===imageBuffer is now image

        //===Gaussium weight sum===
        //Already calculated before
        this.buffers = {
            positions: positionBuffer,
            texCoords: textureCoordinateBuffer,
            gaussiumMatrix: matrixBuffer,
            gaussiumSum: gaussiumWeightSum,
            image: imageBuffer,
        }
    },
    deleteBuffers: function (gl) {
        gl.deleteBuffer(this.buffers.positions)
        gl.deleteBuffer(this.buffers.texCoords)
        gl.deleteTexture(this.buffers.gaussiumMatrix)
        gl.deleteTexture(this.buffers.image)
    },
    connect: function (gl, imagedata, radius) {
        //Vertex Attrib vec2 a_position
        {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.positions)
            let size = 2,
                type = gl.FLOAT,
                normalize = false,
                stride = 0,
                offset = 0
            gl.vertexAttribPointer(
                this.programInfo.attribLocations.vertexLocation,
                size, type, normalize, stride, offset
            )
            gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexLocation)
        }

        //Vertex Attrib vec2 a_textureCoordinate
        {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoords)
            let size = 2,
                type = gl.FLOAT,
                normalize = false,
                stride = 0,
                offset = 0
            gl.vertexAttribPointer(
                this.programInfo.attribLocations.texCoordLocation,
                size, type, normalize, stride, offset
            )
            gl.enableVertexAttribArray(this.programInfo.attribLocations.texCoordLocation)
        }

        //Uniform vec2 u_resolution
        gl.uniform2f(this.programInfo.uniformLocations.resolutionLocation, imagedata.width, imagedata.height)

        //Uniform sampler2D u_image
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.buffers.image)
        gl.uniform1i(this.programInfo.uniformLocations.imageLocation, 0)

        //Uniform sampler2D matrix
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.buffers.gaussiumMatrix)
        gl.uniform1i(this.programInfo.uniformLocations.matrixLocation, 1)
        //Uniform vec2 u_textureSize
        gl.uniform2f(this.programInfo.uniformLocations.textureSizeLocation, gl.canvas.width, gl.canvas.height)


        //Uniform float matrix_sum
        gl.uniform1f(this.programInfo.uniformLocations.matrixSumLocation, this.buffers.gaussiumSum)

        //Uniform int r
        gl.uniform1i(this.programInfo.uniformLocations.rLocation, radius)
    },
    prepare: function (gl) {
        this.program = createProgram(gl, this.vertex_shader_source, this.fragment_shader_source)
        //Why doesn't location getting belong to connect(...)?
        //Because getting location is considered slow, and should only be executed when initializing.
        this.programInfo = {
            program: blurProgramResource.program,
            attribLocations: {
                vertexLocation: gl.getAttribLocation(this.program, 'a_position'),
                texCoordLocation: gl.getAttribLocation(this.program, 'a_textureCoordinate')
            },
            uniformLocations: {
                imageLocation: gl.getUniformLocation(this.program, 'u_image'),
                textureSizeLocation: gl.getUniformLocation(this.program, 'u_textureSize'),
                resolutionLocation: gl.getUniformLocation(this.program, 'u_resolution'),
                matrixLocation: gl.getUniformLocation(this.program, 'matrix'),
                matrixSumLocation: gl.getUniformLocation(this.program, 'matrix_sum'),
                rLocation: gl.getUniformLocation(this.program, 'r'),
            }
        }
    }
}

const resizeProgramResource = {
    vertex_shader_source: `
        attribute vec2 a_position;
        attribute vec2 a_textureCoordinate;

        varying vec2 v_textureCoordinate;
        void main(){
            gl_Position=vec4(a_position,0,1);
            v_textureCoordinate=a_textureCoordinate;
        }
    `,
    fragment_shader_source: `
        precision mediump float;
        varying vec2 v_textureCoordinate;

        uniform sampler2D u_image;
        void main(){
            gl_FragColor=texture2D(u_image,v_textureCoordinate);
        }
    `,
    createBuffers: function (gl, sourceImageData, targetWidth, targetHeight) {
        //canvas size
        gl.canvas.width = targetWidth
        gl.canvas.height = targetHeight
        gl.viewport(0, 0, targetWidth, targetHeight)
        //Attrib vec2 a_position
        let a_position_buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, a_position_buffer)
        let a_positions = [
            -1, -1,
            -1, 1,
            1, -1,
            1, 1,
        ]
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(a_positions),
            gl.DYNAMIC_DRAW
        )

        //Attrib vec2 a_textureCoordinate
        let a_textureCoordinate_buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, a_textureCoordinate_buffer)
        let a_textureCoordinates = [
            0, 0,
            0, 1,
            1, 0,
            1, 1,
        ]
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(a_textureCoordinates),
            gl.DYNAMIC_DRAW
        )

        //Uniform sampler2D u_image's corresponding texture
        let u_image_buffer = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, u_image_buffer)

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImageData)

        this.buffers = {
            a_position_buffer: a_position_buffer,
            a_textureCoordinate_buffer: a_textureCoordinate_buffer,
            u_image_buffer: u_image_buffer,
        }
    },
    deleteBuffers: function (gl) {
        gl.deleteBuffer(this.buffers.a_position_buffer)
        gl.deleteBuffer(this.buffers.a_textureCoordinate_buffer)
        gl.deleteTexture(this.buffers.u_image_buffer)
    },
    connect: function (gl) {
        //Attrib vec2 a_position
        {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.a_position_buffer)
            let size = 2,
                type = gl.FLOAT,
                normalize = false,
                stride = 0,
                offset = 0
            gl.vertexAttribPointer(
                this.programInfo.attribLocations.a_position_location,
                size, type, normalize, stride, offset
            )
            gl.enableVertexAttribArray(this.programInfo.attribLocations.a_position_location)
        }

        //Attrib vec2 a_textureCoordinate
        {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.a_textureCoordinate_buffer)
            let size = 2,
                type = gl.FLOAT,
                normalize = false,
                stride = 0,
                offset = 0
            gl.vertexAttribPointer(
                this.programInfo.attribLocations.a_textureCoordinate_location,
                size, type, normalize, stride, offset
            )
            gl.enableVertexAttribArray(this.programInfo.attribLocations.a_textureCoordinate_location)
        }

        //Uniform sampler2D u_image
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.buffers.u_image_buffer)
        gl.uniform1i(this.programInfo.uniformLocations.u_image_location, 0)

    },
    prepare: function (gl) {
        this.program = createProgram(gl, this.vertex_shader_source, this.fragment_shader_source)
        this.programInfo = {
            program: this.program,
            attribLocations: {
                a_position_location: gl.getAttribLocation(this.program, 'a_position'),
                a_textureCoordinate_location: gl.getAttribLocation(this.program, 'a_textureCoordinate')
            },
            uniformLocations: {
                u_image_location: gl.getUniformLocation(this.program, 'u_image')
            },
        }
    }

}

function createEnvironment() {
    let tmp_canvas = document.createElement('canvas')
    //let tmp_canvas=document.getElementById("tmp")
    let gl = tmp_canvas.getContext('webgl')
    if (!gl) {
        console.log("Unable to get WebGL context. ")
        return null;
    }

    blurProgramResource.prepare(gl)
    resizeProgramResource.prepare(gl)

    gl.clearColor(0, 0, 0, 0)//黑色，透明
    //1是不透明
    gl.clear(gl.COLOR_BUFFER_BIT)

    return {
        gl: gl,
    }
}


let environment = createEnvironment()

/*function blur(imagedata, radius) {
    if (environment == null) {
        environment = createEnvironment()
    }
    if (radius > maxR) {
        console.log(`Radius too big. Max is ${maxR}. `)
        return null
    } else if (radius < 0) {
        console.log("Radius is negative!")
        return null
    } else if (radius == 0) {
        return imagedata
        //TODO:Have no idea why r=0 returns blank image
        //But we'll keep this for now
    }
    let gl = environment.gl
    gl.canvas.width = imagedata.width + 2 * radius + 1
    gl.canvas.height = imagedata.height + 2 * radius + 1

    blurProgramResource.createBuffers(environment.gl, imagedata, radius)
    gl.useProgram(blurProgramResource.program)
    blurProgramResource.connect(gl, imagedata, radius)
    let primitiveType = gl.TRIANGLE_STRIP,
        offset = 0,
        count = 4
    gl.drawArrays(primitiveType, offset, count)
    blurProgramResource.deleteBuffers(gl)
    return getImageData(gl)

}*/

export function resize(sourceImagedata, targetWidth, targetHeight) {
    if (environment == null) {
        environment = createEnvironment()
    }
    let gl = environment.gl

    resizeProgramResource.createBuffers(gl, sourceImagedata, targetWidth, targetHeight)
    gl.useProgram(resizeProgramResource.program)
    resizeProgramResource.connect(gl)
    let primitiveType = gl.TRIANGLE_STRIP,
        offset = 0,
        count = 4
    gl.drawArrays(primitiveType, offset, count)
    resizeProgramResource.deleteBuffers(gl)

    return getImageData(gl)
}


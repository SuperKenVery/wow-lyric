/* Thanks a lot to webglfundamentals.org !!
 * It really helped he a lot in learning webgl.
 * It tells everything so clearly.
 *
 * MDN failed to teach me this time, as it didn't
 * descript how to connect buffers, locations and
 * variables in shader sources well.
 */
console.log("blur.js")

//vector shader
const vertex_shader_source=`
attribute vec2 a_position;
attribute vec2 a_textureCoordinate;

uniform vec2 u_resolution;

varying vec2 v_textureCoordinate;
void main(){
    gl_Position=vec4(a_position,0,1);

    //For fragment shader
    vec2 pixelSpace=a_textureCoordinate*(u_resolution+20.0);
    vec2 targetPixelSpace=pixelSpace+vec2(-10.0,-10.0);
    v_textureCoordinate=targetPixelSpace/u_resolution; //pass to fragment shader
}
`
//fragment shader
const fragment_shader_source=`
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_textureSize;
uniform float matrix[21*21];//Max gaussium blur radius is 10
uniform float matrix_sum;//Used after adding up the sum. Devide it.
uniform int r; //radius

varying vec2 v_textureCoordinate;

void main(){
    vec2 onePixel=vec2(1,1)/u_textureSize;
    vec4 pixelSum=vec4(0,0,0,0);
    //Blur here!
    for(int matrix_x=-10;matrix_x<=10;matrix_x++){
        for(int matrix_y=-10;matrix_y<=10;matrix_y++){
            pixelSum+=texture2D(u_image,v_textureCoordinate+onePixel*vec2(matrix_x,matrix_y)) * matrix[(10+matrix_x)*21+(10+matrix_y)];
        }
    }
    gl_FragColor=pixelSum*(1.0/matrix_sum);
}
`

function createShader(gl,type,source){
    var shader=gl.createShader(type)
    gl.shaderSource(shader,source)
    gl.compileShader(shader)
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
        alert("Failed compiling shader: "+gl.getShaderInfoLog(shader)+"\n"+source)
        gl.deleteShader(shader)
        return null
    }
    return shader
}

function createProgram(gl,vertexSource,fragmentSource){
    var vertexShader=createShader(gl, gl.VERTEX_SHADER, vertexSource)
    var fragmentShader=createShader(gl,gl.FRAGMENT_SHADER, fragmentSource)

    var shaderProgram=gl.createProgram()
    gl.attachShader(shaderProgram,vertexShader)
    gl.attachShader(shaderProgram,fragmentShader)
    gl.linkProgram(shaderProgram)

    if(!gl.getProgramParameter(shaderProgram,gl.LINK_STATUS)){
        alert("Failed to link shader program: "+gl.getProgramInfoLog(shaderProgram))
        return null
    }

    return shaderProgram
}

var gaussiumMatrixCache={}
function createBuffers(gl,imagedata,radius){
    //===Positions===
    var positionBuffer=gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer)
    var positions=[
        1.0, 1.0,
        -1.0,1.0,
        1.0,-1.0,
        -1.0,-1.0,
    ]
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW
    )
    //===position buffer is now positions

    //===Texture coordinates===
    var textureCoordinateBuffer=gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER,textureCoordinateBuffer)
    var coordinates=[
        1.0, 1.0,
        0.0,1.0,
        1.0,0.0,
        0.0,0.0,
    ]
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(coordinates),
        gl.STATIC_DRAW
    )
    //===textureCoordinateBuffer is now coordinates

    //===Gaussium weight matrix===

    //Generate gaussium weight matrix
    if(radius>10){
        console.log("Gaussium blur radius musn't >=10. Abort. ")
        return null
    }
    var gaussiumWeight=null,gaussiumWeightSum=0
    if(gaussiumMatrixCache[radius]!=undefined){
        gaussiumWeight=gaussiumMatrixCache[radius].gaussiumWeight
        gaussiumWeightSum=gaussiumMatrixCache[radius].gaussiumWeightSum
    }else{
        gaussiumWeight=new Float32Array(21*21)
        gaussiumWeightSum=0
        let p=0.5,
            r=radius,
            rr=r**2,
            A=1-p**2,
            B=1/(2*Math.PI*rr*A**0.5),
            C=-1/(2*A)
        var t=0,f=0
        for(var x=-r;x<=r;x++){
            for(var y=-r;y<=r;y++){
                t=C*(x**2+y**2-p*x*y)/rr
                f=B*Math.exp(t)
                gaussiumWeight[(x+r)*21+(y+r)]=f
                gaussiumWeightSum+=f
            }
        }
        gaussiumMatrixCache[radius]={
            gaussiumWeight:gaussiumWeight,
            gaussiumWeightSum:gaussiumWeightSum,
        }
    }


    //===Image===
    var imageBuffer=gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, imageBuffer)

    //enable image of any size
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)

    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,imagedata)
    //===imageBuffer is now image

    //===Gaussium weight sum===
    //Already calculated before

    return {
        positions: positionBuffer,
        texCoords: textureCoordinateBuffer,
        gaussiumMatrix: gaussiumWeight,
        gaussiumSum: gaussiumWeightSum,
        image: imageBuffer,
    }
}
function connect(programInfo,buffers,imagedata,radius){
    let gl=environment.gl
    //Vertex Attrib vec2 a_position
    gl.bindBuffer(gl.ARRAY_BUFFER,buffers.positions)
    var size=2,
        type=gl.FLOAT,
        normalize=false,
        stride=0,
        offset=0
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexLocation,
        size,type,normalize,stride,offset
    )
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexLocation)

    //Vertex Attrib vec2 a_textureCoordinate
    gl.bindBuffer(gl.ARRAY_BUFFER,buffers.texCoords)
    var size=2,
        type=gl.FLOAT,
        normalize=false,
        stride=0,
        offset=0
    gl.vertexAttribPointer(
        programInfo.attribLocations.texCoordLocation,
        size,type,normalize,stride,offset
    )
    gl.enableVertexAttribArray(programInfo.attribLocations.texCoordLocation)

    //Uniform vec2 u_resolution
    gl.uniform2f(programInfo.uniformLocations.resolutionLocation,imagedata.width,imagedata.height)

    //Uniform sampler2D u_image
    gl.bindTexture(gl.TEXTURE_2D,buffers.image)
    gl.uniform1i(programInfo.uniformLocations.imageLocation,0)

    //Uniform vec2 u_textureSize
    gl.uniform2f(programInfo.uniformLocations.textureSizeLocation,gl.canvas.width,gl.canvas.height)

    //Uniform float matrix[21][21]
    for(var i=0;i<441;i++){
        gl.uniform1f(programInfo.uniformLocations.matrixLocation[i],buffers.gaussiumMatrix[i])
    }

    //Uniform float matrix_sum
    gl.uniform1f(programInfo.uniformLocations.matrixSumLocation,buffers.gaussiumSum)

    //Uniform int r
    gl.uniform1i(programInfo.uniformLocations.rLocation,buffers,radius)
}

function createEnvironment(){
    //var tmp_canvas=document.createElement('canvas')
    var tmp_canvas=document.getElementById("tmp")
    var gl=tmp_canvas.getContext('webgl')
    if(!gl){
        console.log("Unable to get WebGL context. ")
        return null;
    }

    var blurProgram=createProgram(gl,vertex_shader_source, fragment_shader_source)
    var programInfo={
        program: blurProgram,
        attribLocations: {
            vertexLocation: gl.getAttribLocation(blurProgram,'a_position'),
            texCoordLocation: gl.getAttribLocation(blurProgram, 'a_textureCoordinate')
        },
        uniformLocations: {
            imageLocation: gl.getUniformLocation(blurProgram, 'u_image'),
            textureSizeLocation: gl.getUniformLocation(blurProgram, 'u_textureSize'),
            resolutionLocation: gl.getUniformLocation(blurProgram,'u_resolution'),
            matrixLocation: [],//matrix will be filled one by one
            //matrixLocation[0~21*21-1] 21*21-1=440
            matrixSumLocation: gl.getUniformLocation(blurProgram, 'matrix_sum'),
            rLocation: gl.getUniformLocation(blurProgram, 'r'),
        }
    }
    for(var i=0;i<441;i++){
        programInfo.uniformLocations.matrixLocation[i]=gl.getUniformLocation(blurProgram, `matrix[${i}]`)
    }


    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(1, 0, 0, 1)//黑色，透明
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(blurProgram)

    return {
        gl:gl,
        programInfo:programInfo,
    }
}
var environment=null

function blur(imagedata,radius){
    if(environment==null){
        environment=createEnvironment()
    }
    let gl=environment.gl
    gl.canvas.width=imagedata.width+20
    gl.canvas.height=imagedata.height+20
    console.log(`Imagedata w=${imagedata.width},h=${imagedata.height}.`)
    gl.viewport(0,0,gl.canvas.width,gl.canvas.height)
    var buffers=createBuffers(environment.gl, imagedata, radius)
    connect(environment.programInfo, buffers, imagedata, radius)
    var primitiveType=gl.TRIANGLE_STRIP,
        offset=0,
        count=4
    gl.drawArrays(primitiveType, offset, count)

    var pixels=new Uint8Array(gl.canvas.width*gl.canvas.height*4)
    gl.readPixels(0,0,gl.canvas.width,gl.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels)
    /*let w=imagedata.width,h=imagedata.height
    var pixels=new Uint8Array(w*h*4)
    for(var x=0;x<imagedata.width;x++){
        for(var y=0;y<imagedata.height;y++){
            pixels[y*w*4+x*4]=morepixels[(y+10)*w*4+(x+10)*4]
            pixels[y*w*4+x*4+1]=morepixels[(y+10)*w*4+(x+10)*4+1]
            pixels[y*w*4+x*4+2]=morepixels[(y+10)*w*4+(x+10)*4+2]
            pixels[y*w*4+x*4+3]=morepixels[(y+10)*w*4+(x+10)*4+3]
        }
    }
    */
    var clampedPixels=new Uint8ClampedArray(pixels)
    var imagedata=new ImageData(clampedPixels,gl.canvas.width,gl.canvas.height)
    return imagedata
}


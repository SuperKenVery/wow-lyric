/* Thanks a lot to webglfundamentals.org !!
 * It really helped he a lot in learning webgl.
 * It tells everything so clearly.
 *
 * MDN failed to teach me this time, as it didn't
 * descript how to connect buffers, locations and
 * variables in shader sources well.
 */
console.log("blur.js")




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

function getImageData(gl){
    var pixels=new Uint8Array(gl.canvas.width*gl.canvas.height*4)
    gl.readPixels(0,0,gl.canvas.width,gl.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels)
    var clampedPixels=new Uint8ClampedArray(pixels)
    var imagedata=new ImageData(clampedPixels,gl.canvas.width,gl.canvas.height)
    return imagedata
}

let maxR=10
blurProgramResource={
    //vector shader
    vertex_shader_source:`
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
    fragment_shader_source:`
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
	    gl_FragColor=texture2D(matrix,v_textureCoordinate)/matrix_sum;

        }
        `,
    gaussiumMatrixCache:{},
    createBuffers:function(gl,imagedata,radius){
        //canvas size
        gl.canvas.width=imagedata.width+2*radius
        gl.canvas.height=imagedata.height+2*radius
        gl.viewport(0,0,gl.canvas.width,gl.canvas.height)
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
        var gaussiumWeight=null,gaussiumWeightSum=0
        if(this.gaussiumMatrixCache[radius]!=undefined){
            gaussiumWeight=this.gaussiumMatrixCache[radius].gaussiumWeight
            gaussiumWeightSum=this.gaussiumMatrixCache[radius].gaussiumWeightSum
        }else{
            gaussiumWeight=new Float32Array((2*maxR+1)**2)
            gaussiumWeightSum=0
            let p=0,
                r=radius,
		mr=maxR,
                rr=r**2,
                A=1-p**2,
                B=1/(2*Math.PI*rr*A**0.5),
                C=-1/(2*A)
            var t=0,f=0
            for(var x=-r;x<=r;x++){
                for(var y=-r;y<=r;y++){
                    t=C*(x**2+y**2-p*x*y)/rr
                    f=B*Math.exp(t)
                    gaussiumWeight[(x+mr)*(2*mr+1)+(y+mr)]=f*255 //will be devided by 255 in texture2d(?)
                    gaussiumWeightSum+=f
                }
            }
            var max_val=gaussiumWeight[mr*(2*mr+1)+mr]
	    var multiply=255/max_val
	    for(var i=0;i<gaussiumWeight.length;i++){
		gaussiumWeight[i]*=multiply
	    }
	    gaussiumWeightSum*=multiply
	    gaussiumWeight=new Uint8Array(gaussiumWeight)
		console.log("weight sum is ",gaussiumWeightSum,"radius is ", radius)
            this.gaussiumMatrixCache[radius]={
                gaussiumWeight:gaussiumWeight,
                gaussiumWeightSum:gaussiumWeightSum,
            }
        }
        


	var matrixBuffer=gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D,matrixBuffer)
	gl.pixelStorei(gl.UNPACK_ALIGNMENT,1)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,2*radius+1,2*radius+1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,gaussiumWeight)
	    console.log("weights ",gaussiumWeight)


        var imageBuffer=gl.createTexture()
	gl.bindTexture(gl.TEXTURE_2D,imageBuffer)
        //enable image of any size
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)

        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,imagedata)
        //===imageBuffer is now image

        //===Gaussium weight sum===
        //Already calculated before
        this.buffers={
            positions: positionBuffer,
            texCoords: textureCoordinateBuffer,
            gaussiumMatrix: matrixBuffer,
            gaussiumSum: gaussiumWeightSum,
            image: imageBuffer,
        }
    },
    connect:function(gl,imagedata,radius){
        //Vertex Attrib vec2 a_position
        gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers.positions)
        var size=2,
            type=gl.FLOAT,
            normalize=false,
            stride=0,
            offset=0
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.vertexLocation,
            size,type,normalize,stride,offset
        )
        gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexLocation)

        //Vertex Attrib vec2 a_textureCoordinate
        gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers.texCoords)
        var size=2,
            type=gl.FLOAT,
            normalize=false,
            stride=0,
            offset=0
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.texCoordLocation,
            size,type,normalize,stride,offset
        )
        gl.enableVertexAttribArray(this.programInfo.attribLocations.texCoordLocation)

        //Uniform vec2 u_resolution
        gl.uniform2f(this.programInfo.uniformLocations.resolutionLocation,imagedata.width,imagedata.height)

        //Uniform sampler2D u_image
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D,this.buffers.image)
        gl.uniform1i(this.programInfo.uniformLocations.imageLocation,0)

	//Uniform sampler2D matrix
	gl.activeTexture(gl.TEXTURE1)
	gl.bindTexture(gl.TEXTURE_2D,this.buffers.gaussiumMatrix)
	gl.uniform1i(this.programInfo.uniformLocations.matrixLocation,1)
        //Uniform vec2 u_textureSize
        gl.uniform2f(this.programInfo.uniformLocations.textureSizeLocation,gl.canvas.width,gl.canvas.height)


        //Uniform float matrix_sum
        gl.uniform1f(this.programInfo.uniformLocations.matrixSumLocation,this.buffers.gaussiumSum)

        //Uniform int r
        gl.uniform1i(this.programInfo.uniformLocations.rLocation,radius)
    },
    prepare:function(gl){
        this.program=createProgram(gl, this.vertex_shader_source, this.fragment_shader_source)
        //Why doesn't location getting belong to connect(...)?
        //Because getting location is considered slow, and should only be executed when initializing. 
        this.programInfo={
            program: blurProgramResource.program,
            attribLocations: {
                vertexLocation: gl.getAttribLocation(this.program,'a_position'),
                texCoordLocation: gl.getAttribLocation(this.program, 'a_textureCoordinate')
            },
            uniformLocations: {
                imageLocation: gl.getUniformLocation(this.program, 'u_image'),
                textureSizeLocation: gl.getUniformLocation(this.program, 'u_textureSize'),
                resolutionLocation: gl.getUniformLocation(this.program,'u_resolution'),
                matrixLocation: gl.getUniformLocation(this.program,'matrix'),
                matrixSumLocation: gl.getUniformLocation(this.program, 'matrix_sum'),
                rLocation: gl.getUniformLocation(this.program, 'r'),
            }
        }
    }
}

resizeProgramResource={
    vertex_shader_source:`
        attribute vec2 a_position;
        attribute vec2 a_textureCoordinate;

        varying vec2 v_textureCoordinate;
        void main(){
            gl_Position=vec4(a_position,0,1);
            v_textureCoordinate=a_textureCoordinate;
        }
    `,
    fragment_shader_source:`
        precision mediump float;
        varying vec2 v_textureCoordinate;

        uniform sampler2D u_image;
        void main(){
            gl_FragColor=texture2D(u_image,v_textureCoordinate);
        }
    `,
    createBuffers:function(gl,sourceImageData,targetWidth,targetHeight){
        //canvas size
        gl.canvas.width=targetWidth
        gl.canvas.height=targetHeight
        gl.viewport(0,0,targetWidth,targetHeight)
        //Attrib vec2 a_position
        var a_position_buffer=gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER,a_position_buffer)
        var a_positions=[
            -1,-1,
            -1,1,
            1,-1,
            1,1,
        ]
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(a_positions),
            gl.STATIC_DRAW
        )

        //Attrib vec2 a_textureCoordinate
        var a_textureCoordinate_buffer=gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER,a_textureCoordinate_buffer)
        var a_textureCoordinates=[
            0,0,
            0,1,
            1,0,
            1,1,
        ]
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(a_textureCoordinates),
            gl.STATIC_DRAW
        )

        //Uniform sampler2D u_image's corresponding texture
        var u_image_buffer=gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D,u_image_buffer)

        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sourceImageData)

        this.buffers={
            a_position_buffer:a_position_buffer,
            a_textureCoordinate_buffer:a_textureCoordinate_buffer,
            u_image_buffer:u_image_buffer,
        }
    },
    connect:function(gl){
        //Attrib vec2 a_position
        gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers.a_position_buffer)
        var size=2,
            type=gl.FLOAT,
            normalize=false,
            stride=0,
            offset=0
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.a_position_location,
            size,type,normalize,stride,offset
        )
        gl.enableVertexAttribArray(this.programInfo.attribLocations.a_position_location)

        //Attrib vec2 a_textureCoordinate
        gl.bindBuffer(gl.ARRAY_BUFFER,this.buffers.a_textureCoordinate_buffer)
        var size=2,
            type=gl.FLOAT,
            normalize=false,
            stride=0,
            offset=0
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.a_textureCoordinate_location,
            size,type,normalize,stride,offset
        )
        gl.enableVertexAttribArray(this.programInfo.attribLocations.a_textureCoordinate_location)

        //Uniform sampler2D u_image
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D,this.buffers.u_image_buffer)
        gl.uniform1i(this.programInfo.uniformLocations.u_image_location,0)
        
    },
    prepare:function(gl){
        this.program=createProgram(gl, this.vertex_shader_source, this.fragment_shader_source)
        this.programInfo={
            program:this.program,
            attribLocations:{
                a_position_location:gl.getAttribLocation(this.program,'a_position'),
                a_textureCoordinate_location:gl.getAttribLocation(this.program,'a_textureCoordinate')
            },
            uniformLocations:{
                u_image_location:gl.getUniformLocation(this.program,'u_image')
            },
        }
    }

}

function createEnvironment(){
    //var tmp_canvas=document.createElement('canvas')
    var tmp_canvas=document.getElementById("tmp")
    var gl=tmp_canvas.getContext('webgl')
    if(!gl){
        console.log("Unable to get WebGL context. ")
        return null;
    }

    blurProgramResource.prepare(gl)
    resizeProgramResource.prepare(gl)

    gl.clearColor(255, 0, 0, 1)//黑色，透明
	//应该1是不透明吧
    gl.clear(gl.COLOR_BUFFER_BIT)

    return {
        gl:gl,
    }
}


var environment=createEnvironment()

function blur(imagedata,radius){
    if(environment==null){
        environment=createEnvironment()
    }
    if(radius>maxR){
	console.log(`Radius too big. Max is ${maxR}. `)
	return null
    }
    let gl=environment.gl

    blurProgramResource.createBuffers(environment.gl,imagedata,radius)
    gl.useProgram(blurProgramResource.program)
    blurProgramResource.connect(gl,imagedata,radius)
    var primitiveType=gl.TRIANGLE_STRIP,
        offset=0,
        count=4
    gl.drawArrays(primitiveType, offset, count)
console.log("Done drawing")
    return getImageData(gl)

}

function resize(sourceImagedata,targetWidth,targetHeight){
    if(environment==null){
        environment=createEnvironment()
    }
    let gl=environment.gl

    resizeProgramResource.createBuffers(gl,sourceImagedata,targetWidth,targetHeight)
    gl.useProgram(resizeProgramResource.program)
    resizeProgramResource.connect(gl)
    var primitiveType=gl.TRIANGLE_STRIP,
        offset=0,
        count=4
    gl.drawArrays(primitiveType,offset,count)

    return getImageData(gl)
}


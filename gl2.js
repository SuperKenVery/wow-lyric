class Blur{
    constructor(){
    this.vertex_shader_source=`
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
        `
    this.fragment_shader_source=`
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
            
            for(int matrix_x=-${maxR};matrix_x<=${maxR};matrix_x++){
                for(int matrix_y=-${maxR};matrix_y<=${maxR};matrix_y++){
                    float weight=texture2D(matrix,vec2(0.5,0.5)+onePlace*vec2(matrix_x,matrix_y))[0];
                    vec4 pixel=texture2D(u_image,v_textureCoordinate+onePixel*vec2(matrix_x,matrix_y));
                    pixelSum+=pixel*(weight/matrix_sum);
                }
            }

        gl_FragColor=pixelSum;
        }
        `
    
    }
}

function createEnvironment(){
    let canvas=document.createElement('canvas')
    let gl=canvas.getContext('webgl')

    blur.array

}

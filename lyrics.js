async function Text(text,fontsize){
    var tmp_canvas=document.createElement('canvas')
    //var tmp_canvas=document.getElementById('tmp')
    var ctx=tmp_canvas.getContext('2d')

    ctx.textBaseline='top'
    ctx.font="700 "+String(fontsize)+"px Arial"

    var draw_prediction=ctx.measureText(text)
    tmp_canvas.height=fontsize
    tmp_canvas.width=draw_prediction.width

    ctx.textBaseline='top'
    ctx.font="700 "+String(fontsize)+"px Arial"
    ctx.fillText(text, 0, 0)
    var imagedata=ctx.getImageData(0, 0, tmp_canvas.width, tmp_canvas.height)
    return imagedata
}
async function blur(imagedata,r){
    //Generate gaussium matrix
    var gaussiumMatrix={},matrixWeightSum=0
    let p=0.5,
        rr=r**2,
        A=1-p**2,
        B=1/(2*Math.PI*rr*A**0.5),
        C=-1/(2*A)
    var t=0,f=0
    for(var x=-r;x<=r;x++){
        gaussiumMatrix[x]={}
        for(var y=-r;y<=r;y++){
            t=C*(x**2+y**2-p*x*y)/rr
            f=B*Math.exp(t)
            gaussiumMatrix[x][y]=f
            matrixWeightSum+=f
        }
    }

    //Convenience functions
    //Calculate address
    var addr=function(imagedata,x,y){
        let lineStart=y*(imagedata.width*4)
        let lineOffset=x*4
        return lineStart+lineOffset
    }
    //Get a specific pixel, as well as hendling edge cases
    var getPixelAt=function(imagedata,x,y){
        if(x<0||y<0||x>imagedata.width||y>imagedata.height){
            return [0,0,0,0]
        }else{
            var baseaddr=addr(imagedata,x,y)
            return [imagedata.data[baseaddr],imagedata.data[baseaddr+1],imagedata.data[baseaddr+2],imagedata.data[baseaddr+3]]
        }
    }

    //Some preparations
    var tmp_canvas=document.createElement('canvas')
    var ctx=tmp_canvas.getContext('2d')
    tmp_canvas.width=imagedata.width
    tmp_canvas.height=imagedata.height
    var result_imagedata=ctx.getImageData(0, 0, tmp_canvas.width, tmp_canvas.height)
    var result_pixels=result_imagedata.data

    //Blur!
    for(var x=0;x<imagedata.width;x++){
        for(var y=0;y<imagedata.width;y++){
            //Each pixel in the original picture
            var matrixPixelSum=[0,0,0,0]
            for(var matrix_x=-r;matrix_x<=r;matrix_x++){
                for(var matrix_y=-r;matrix_y<=r;matrix_y++){
                    //Each pixel in the matrix
                    var got=getPixelAt(imagedata,x+matrix_x,y+matrix_y)
                    matrixPixelSum[0]+=got[0]*gaussiumMatrix[matrix_x][matrix_y]//R
                    matrixPixelSum[1]+=got[1]*gaussiumMatrix[matrix_x][matrix_y]//G
                    matrixPixelSum[2]+=got[2]*gaussiumMatrix[matrix_x][matrix_y]//B
                    matrixPixelSum[3]+=got[3]*gaussiumMatrix[matrix_x][matrix_y]//A
                }
            }
            matrixPixelSum=[matrixPixelSum[0]/matrixWeightSum,matrixPixelSum[1]/matrixWeightSum,matrixPixelSum[2]/matrixWeightSum,matrixPixelSum[3]/matrixWeightSum]
            var baseaddr=addr(result_imagedata,x,y)
            result_pixels[baseaddr]=matrixPixelSum[0]//R
            result_pixels[baseaddr+1]=matrixPixelSum[1]//G
            result_pixels[baseaddr+2]=matrixPixelSum[2]//B
            result_pixels[baseaddr+3]=matrixPixelSum[3]//A
        }
    }
    return result_imagedata
}

class LyricLineCache{
    constructor(){
        this.maxText=null
        this.blurred=[]
    }
}

class LyricLine {
    constructor(content){
        this.content=content
        this.y=0 //position on screen
        this.create_cache()
    }
    async create_cache(){
        let max_font_size=56,min_font_size=40
        this.cache=new LyricLineCache()
        this.maxText=await Text(this.content,max_font_size)

    }
    put(context,y){
        let height=800
        var size=Math.floor(56-(y/height)*(56-40))
        context.drawImage(this.rendered[size],0,y)
    }
}


async function main(){
    var canvas=document.getElementById("lyric")
    var context=canvas.getContext('2d')

    var a=await Text('Hello, world',72)
    var b=await Text('转身离开 分手说不出来',72)
    var c=await blur(a,1)
    context.putImageData(a,0,50)
    context.putImageData(b,10,50+72)
    context.putImageData(c,0,50+2*72)

    //var shanhuhai=new LyricLine('转身离开 分手说不出来')
    //shanhuhai.put(context, 100)
}

var promise=main()


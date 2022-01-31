console.log("lyrics.js")
async function Text(text,fontsize){
    var tmp_canvas=document.createElement('canvas')
    //var tmp_canvas=document.getElementById('tmp')
    var ctx=tmp_canvas.getContext('2d')

    ctx.textBaseline='top'
    ctx.font="700 "+String(fontsize)+"px Arial"

    var draw_prediction=ctx.measureText(text)
    tmp_canvas.height=fontsize+8
    tmp_canvas.width=draw_prediction.width

    ctx.textBaseline='top'
    ctx.font="700 "+String(fontsize)+"px Arial"
    ctx.fillText(text, 0, 8)
    var imagedata=ctx.getImageData(0, 0, tmp_canvas.width, tmp_canvas.height)
    return imagedata
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
    context.putImageData(a,0,50)
    context.putImageData(b,10,50+72)
    for(var r=1;r<=10;r++){
        var c=blur(b,r)
        context.putImageData(c,1,50+100*(r+1))
    }

    //var shanhuhai=new LyricLine('转身离开 分手说不出来')
    //shanhuhai.put(context, 100)
}

var promise=main()


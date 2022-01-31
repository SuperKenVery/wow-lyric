async function Text([text,fontsize]){
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
    var bitmap=await createImageBitmap(tmp_canvas)
    postMessage(bitmap, [bitmap])
}

class LyricLine {
    constructor(content){
        this.content=content
        this.cache()
    }
    async cache(){
        this.rendered=[]
        for(var size=56;size>=40;size--){
            this.rendered[size]=await Text(this.content,size)
        }
    }
    put(context,y){
        let height=800
        var size=Math.floor(56-(y/height)*(56-40))
        context.drawImage(this.rendered[size],0,y)
    }
}

let actions={
    'Text': Text
}


function handleMessage(worker_event){
    toRun=actions[worker_event.actions]
    await toRun(worker_event.argumentList)
}
onmessage=handleMessage

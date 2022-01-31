class WorkerMessage{
    constructor(action,argumentList){
        this.action=action
        this.argumentList=argumentList
    }
}

async function Text(text,fontsize){
    var worker=new Worker('worker.js')
    var message=new WorkerMessage('Text',[text,fontsize])
    worker.postMessage(message)
    var result="Worker not done"
    worker.onmessage=function(worker_event){
        result=worker_event.data
    }
    return bitmap
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
        this.create_cache()
    }
    async create_cache(){
        let max_font_size=56,min_font_size=40
        this.cache=new LyricLineCache()

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
    context.drawImage(a,10,50)
    context.drawImage(b,10,50+72)

    var shanhuhai=new LyricLine('转身离开 分手说不出来')
    shanhuhai.put(context, 100)
}

var promise=main()


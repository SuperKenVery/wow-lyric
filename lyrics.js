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

class LyricLine {
    constructor(content,time){
        this.content=content
        this.lineIndex=0 //position on screen
        this.offset=0 //used for animation
        this.cache_progress=this.create_cache()
        this.time=time
    }
    async create_cache(){
        let max_font_size=56,min_font_size=40,lines=10
        this.cache=[]
        this.cache[0]=await Text(this.content,max_font_size)
        for(var line_index=1;line_index<=lines;line_index++){
            var blurred=blur(this.cache[0],line_index/lines*10)
            this.cache[line_index]=blurred
        }

    }
    /*
     * Put this line of lyric to a specific line. 
     *
     * line_index could be float (for animation) and is 0-based.
     */
    put(context){
        let height=100,screenXMiddle=1920/2
        var shrink=1-(this.lineIndex-this.offset)/50//1x~0.8x
        var blurred=this.cache[Math.floor(this.lineIndex-this.offset)]
        var resized=resize(blurred,blurred.width*shrink,blurred.height*shrink)
        context.putImageData(resized,screenXMiddle-resized.width/2,height*(this.lineIndex-this.offset))
    }
}

animation={
    time_to_position:function(x){
        /*
         * Takes time, and outputs the position in the animation at that time. 
         *
         * 0<=x<=d, where d is animation duration
         * 0<=f(x)<=h as LyricLine.put() takes line_index as input, so h=1. 
         */
        let d=300,h=1
        if(x<=0){
            return 0
        }else if(x<=d/2){
            return (2*(x/d)**2) * h
        }else if(x<=d){
            return (-2*(x/d-1)**2+1) * h
        }else{//x>d
            return h
        }
    }
}

class Lyrics{
    constructor(content){
        let linesCount=10
        this.linesCount=linesCount
        var validLines=content.split('\n\n')[1]
        var lines=validLines.split('\n')
        this.lyricLines=[]
        for(var line_index=0;line_index<lines.length;line_index++){
            var lyric_line_raw=lines[line_index],
                [time_raw, lyric_line_content]=lyric_line_raw.split(']'),
                time_string=time_raw.substring(1),
                [minute_string,second_string]=time_string.split(':'),
                [minute,second]=[Number(minute_string),Number(second_string)],
                timeOffset=minute*60+second
            this.lyricLines[line_index]=new LyricLine(lyric_line_content,timeOffset)
        }

        this.topLineIndex=0
    }
    put(context){
        /* Put all lyric lines according to LyricLine.line_index
         */
        for(var lyric_index=0;lyric_index<this.lyricLines.length;lyric_index++){
            let line=this.lyricLines[lyric_index]
            if(line.line_index<-1) continue //skip lines above screen
            line.put(context)
            if(line.line_index>this.linesCount) break //skip lines below screen
        }
    }
    move(context){
        var animation_function=function(timestamp){
            if(animation_function.starttime==undefined) animation_function.starttime=timestamp
            let elapsed=timestamp-animation_function.starttime
            let d=300 //duration for one line of lyric, ms
            let delay=50 //delay between lines
            if(elapsed>d+delay*(this.linesCount-1)){
                this.put(context)
                for(var lyric_index=0;lyric_index<this.linesCount;lyric_index++){
                    let line=this.lyricLines[lyric_index]
                    line.offset=0
                    line.lineIndex--
                }
            }else{
                for(var lyric_index=0;lyric_index<this.linesCount;lyric_index++){
                    let line=this.lyricLines[lyric_index]
                    line.offset=animation.time_to_position(elapsed - (lyric_index-this.topLineIndex)*delay)
                }
                this.put(context)
                requestAnimationFrame(animation_function)
            }
        }
        requestAnimationFrame(animation_function)
    }
}


async function main(){
    var canvas=document.getElementById("lyric")
    var context=canvas.getContext('2d')

    var lyric_data=`[ti:珊瑚海]
[ar:周杰伦/Lara]
[al:十一月的肖邦]
匹配时间为: 04 分 24 秒 的歌曲
[offset:0]

[00:00.00] 
[00:15.85]周杰伦/Lara - 珊瑚海
[00:18.80]男:海平面远方开始阴霾
[00:24.66]悲伤要怎么平静纯白
[00:30.81]我的脸上始终挟带
[00:37.08]淹没浅浅的无奈
[00:44.64]女:你用唇语说你要离开
[00:50.11]男:心不在
[00:51.95]合:她能不顾身般留下来
[00:56.72]汹涌潮水 你的明白
[01:03.44]不是来和谁泪海
[01:10.02]男:转身离开
[01:12.89](你有话)认真说不出来
[01:16.25]合:海鸟跟鱼相爱 只是一场意外
[01:22.74]男:我们的爱(给的爱)
[01:26.00]差异一直存在(回不来)
[01:30.75]男:永久真爱(等待)
[01:32.98]竟累积成伤害
[01:37.06]合:转身离开 分手说不出来
[01:42.32]蔚蓝的珊瑚海 错过瞬间苍白
[01:49.03]男:当初彼此(你有我的)
[01:52.32]不够成熟坦白(不应该)
[01:56.74]男:热情不改
[01:59.08](你的)笑容勉强不来
[02:02.57]合:爱上了珊瑚海
[02:10.94]男:毁坏的沙碉融合重来
[02:16.05]有裂痕的爱怎么重来
[02:22.48]只是一天 结束太快
[02:28.98]你说你无法释怀
[02:35.59]女:贝壳里隐藏什么期待
[02:41.57]男:融化而开
[02:43.41]合:我们也已经无心再猜
[02:48.13]女:脸上海风(脸上海风)
[02:52.34]咸咸的爱(咸咸的爱)
[02:55.49]合:沉不住还有未来
[03:00.71]男:转身离开
[03:03.95](你有话)认真说不出来
[03:07.60]合:海鸟跟鱼相爱 只是一场意外
[03:13.97]男:我们的爱(给的爱)
[03:17.24]差异一直存在(回不来)
[03:21.80]男:永久真爱(等待)
[03:24.42]竟累积成伤害
[03:28.07]转身离开 分手说不出来
[03:33.82]蔚蓝的珊瑚海 错过瞬间苍白
[03:40.04]男:当初彼此 (你有我的)
[03:43.98] 不够成熟坦白(不应该 )
[03:48.35]男:热情不改
[03:50.34](你的)笑容勉强不来
[03:53.62]爱深埋珊瑚海`
    var a=new Lyrics(lyric_data)
    for(var line_index=0;line_index<a.lyricLines.length;line_index++){
        let line=a.lyricLines[line_index]
        await line.cache_progress
    }

    a.put(context)
    //a.move(context)

}
console.log("Running")
var promise=main()


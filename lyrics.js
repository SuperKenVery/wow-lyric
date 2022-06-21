console.log("lyrics.js")
function Text(text,fontsize){
    if(text=="") text=" "
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
    ctx.fillStyle="white"
    ctx.fillText(text, 0, 8)
    var imagedata=ctx.getImageData(0, 0, tmp_canvas.width, tmp_canvas.height)
    return imagedata
}

async function main(){
    var canvas=document.getElementById("lyric")
    var context=canvas.getContext('2d')
    if(context==null){
	console.log("Failed to get 2d context")
    }

    var lyric_data=`[ti:珊瑚海]
[ar:周杰伦/Lara]
[al:十一月的肖邦]
匹配时间为: 04 分 24 秒 的歌曲
[offset:0]

[00:00.00]
[00:8.85]周杰伦/Lara - 珊瑚海
[00:10.20]男:海平面远方开始阴霾
[00:13.66]悲伤要怎么平静纯白
[00:16.81]我的脸上始终挟带
[00:25.08]淹没浅浅的无奈
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
	let player=new LyricPlayer(canvas,lyric_data)
	player.play()
}

async function main2(){
    var a=Text("还在为我的梦加油",75)
	var canvas=document.getElementById("lyric")
        var context=canvas.getContext('2d')
	context.putImageData(a,0,0)
	for(var i=1;i<=5;i++){
	    context.putImageData(blur(a,2*i),0,100*(i))
	}
}

async function main3(){
    var canvas=document.getElementById("lyric")
    var context=canvas.getContext('2d')
    let u=5,g=10
    let lines=[
        new LyricLine(0,"a",0,100,u,g,canvas),
	new LyricLine(1,"b",150,200,u,g,canvas),
    ]
    var springs=[]
    for(var a=0;a<lines.length-1;a++){
	springs.push(new FSSpring(lines[a],lines[a+1],150,u,g))
    }
    let starttime=(new Date()).getTime()
    var lasttime=starttime
    do{
	let now=(new Date()).getTime()
	let t=(now-starttime)/1000,
	    dt=(now-lasttime)/1000
	lasttime=now

	for(var x=0;x<springs.length;x++){
	    lines[x].move(dt)
	    springs[x].move(dt)
	}
	lines[lines.length-1].move()

	for(var l of lines){
	    l.render()
	}
    }while(t<10)
    console.log("done",lines,springs)
}
console.log("Running")
var promise=main()


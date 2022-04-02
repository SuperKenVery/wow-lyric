class State{
    constructor(value,prechange=[],postchange=[]){
	this.prechange=prechange
	this.postchange=postchange
	this.value=value
    }
    set(new_value){
	for(var pre of this.prechange){
	    pre(new_value)
	}
	this.value=new_value
	for(var post of this.postchange){
	    post()
	}
    }

}

class LyricLine{
    constructor(time,text="Empty line",y,height,u=0.5,g=10,canvas,exittime){
	this.time=time
	this.text=text
	this.height=height
	this.u=u
	this.g=g
	this.canvas=canvas
	this.ctx=canvas.getContext("2d")
	this.exittime=exittime

	this.renderedText=Text(text,height)
	this.renderResult=this.renderedText
	
	/*For v and y, we take downwards as positive and upwards as negative.*/
	this.v=new State(0)
	this.y=new State(y)
	this.y.prechange.push(function(w){
	    if(w==undefined||w>10000) this.a.bec()//produce an error. In this way we have a stack trace. 
	})
    }
    move(t){
	console.log("time since last call is",t)
	if(this.v.value>0) this.v.set(Math.max(this.v.value-this.u*this.g*t,0))
	else if(this.v.value<0) this.v.set(Math.min(this.v.value+this.u*this.g*t,0))

	this.y.set(this.y.value+this.v.value*t)
    }
    render(){
	if(this.y.value<this.canvas.height&&this.y.value>-this.renderResult.height){
	    console.log(this.text+" is rendered at", this.y.value)
	    let blurred=blur(this.renderedText,Math.trunc(Math.max(this.y.value,0)/this.canvas.height*10))
	    let resize_to=1-this.y.value/this.canvas.height*0.3,resized=resize(blurred,blurred.width*resize_to,blurred.height*resize_to)
	    let result=blurred
	    this.ctx.putImageData(result,this.canvas.width/2-result.width/2,this.y.value)
	}else{
	}
    }
}

class FSSpring{
    /* Fixed space spring
    Anchor --(FSSpring)--- Object
    1. This spring never pulls/pushes the anchor, only the object
    2. The k of this spring is adjustable, according to objects's position and speed
    3. This spring aims to keep a fixed space between two objects, while providing a fluent animation. It will gracefully pull the object to the desired position, without bouncing back and forth. 
    4. In many ways this is not a normal spring. We just call it this way, partly because apple has something called the "spring effect"(when introducing iPhone), whose spring is much like this spring. 
    */
    constructor(anchor,object,l,u=0.5,g=10){
	/* Create a Fixed space spring
	anchor,object: explained before
	l: The original length of the spring.
	   That is, the space to keep. 
	u: The coefficient of dynamic (动摩擦因数).Obviously the object won't stop going unless there is u. 
	g: The acceleration of gravity (重力加速度)
	*/
	this.anchor=anchor
	this.object=object
	this.l=l
	this.u=u
	this.g=g
	let fss=this
	this.anchor.y.postchange.push(function(){
	    //We assume the m of object is 1
	    let d=fss.object.y.value-fss.anchor.y.value
	    fss.k=2*fss.u*10/(d-fss.l)-fss.object.v.value**2/(d-fss.l)**2
	})
    }
    move(t){
	//t: time between last call and this call
	    let d=this.object.y.value-this.anchor.y.value,
	    a=this.k*(d-this.l)
	    this.object.v.set(this.object.v.value-a*t)

    }
    render(){
	//This thing is invisible
    }
}

class LyricPlayer{
    constructor(canvas,lyrics_string,lyric_height=100,space=80,u=0.5,g=10){
	/*
	param space: The space between lines
	*/
	this.canvas=canvas
	this.ctx=this.canvas.getContext("2d")
	this.lyrics_string=lyrics_string
	this.willplay_index=0
	this.u=u
	this.g=g
	this.objects=[]
	this.h=lyric_height
	this.space=lyric_height+space
	this.playing=false
	/*This space is different. It's the difference of y of each lyric line. */
	let lines=lyrics_string.split("\n\n")[1].split("\n")
        for(var line_index=0;line_index<lines.length;line_index++){
            var lyric_line_raw=lines[line_index],
                [time_raw, lyric_line_content]=lyric_line_raw.split(']'),
                time_string=time_raw.substring(1),
                [minute_string,second_string]=time_string.split(':'),
                [minute,second]=[Number(minute_string),Number(second_string)],
                time=minute*60+second
            this.objects[line_index*2]=new LyricLine(time,lyric_line_content,this.space*line_index,this.h,this.u,this.g,this.canvas)
	    if(line_index>=1){
		this.objects[line_index*2-1]=new FSSpring(this.objects[line_index*2-2],this.objects[line_index*2],space,0.5)
	    }
        }
	//TODO: support exittime
    }

    move(time){
	//time: time since started playing, in seconds
	let x=this.objects[this.willplay_index]
	if(time>=x.time){
	    x.v.set(x.v.value-(2*this.u*this.g*this.space)**0.5)
	    this.willplay_index++
	}
	for(var i of this.objects){
	    i.move(time-this.lasttime)
	}
	this.lasttime=time
    }

    render(){
	this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height)
	for(var i of this.objects) i.render()
    }

    play(time=0){
	/*
	param time: start playing from where?
	in seconds. 

	Internally, we use ms. 
	When passing things to move(), we use seconds, which can have decimal. 
	*/
	this.starttime=(new Date()).getTime()-time*1000
	this.lasttime=0
	let player=this
	let move_wrapper=function(timestamp){
	    let ms=(new Date()).getTime()-player.starttime
	    let time=ms/1000
	    try{
		player.move(time)
		player.render()
	    }catch(e){
		var err="Error:"+String(e)+"\n"+String(e.stack)
		console.log(err)
	    }

	    if(player.playing) window.requestAnimationFrame(move_wrapper)
	}
	this.playing=true
	window.requestAnimationFrame(move_wrapper)
    }

}



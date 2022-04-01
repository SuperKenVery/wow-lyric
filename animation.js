/*class State{
    constructor(value=null,prechange=[],postchange=[]){
	this.prechange=prechange
	this.postchange=postchange
	this.value=value
    }
    set(new_value){
	for(var pre in this.prechange){
	    pre(this.new_value)
	}
	this.value=new_value
	for(vat post in this.postchange){
	    post()
	}
    }

}*/

class LyricLine{
    constructor(time,text="Empty line",canvas,exittime=null){
	this.time=time
	this.text=text
	this.canvas=canvas
	this. exittime=exittime

	this.renderedText=Text(text)
	this.renderResult=this.renderedText
	
	/*For v and y, we take downwards as positive and upwards as negative.*/
	this.v=0
	this.y=0
    }
    move(){
	this.x+=this.v
    }
    render(){
	if(this.y<this.canvas.height&&this.y>-this.renderResult.height){
	    let blurred=blur(this.renderedText,Int(y/this.canvas.height*10))
	    let resize_to=1-y/this.canvas.height*0.3,resized=resize(blurred,blurred.width*resize_to,blurred.height*resize_to)
	    let result=resized
	    this.canvas.putImageData(result,this.canvas.width/2-result.width/2,this.y)
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
    constructor(anchor,object,l,u,g=10){
	/* Create a Fixed space spring
	anchor,object: explained before
	l: The original length of the spring.
	   That is, the space to keep. 
	   The space between anchor and object should be exactly l when calling this. 
	u: The coefficient of dynamic (动摩擦因数).Obviously the object won't stop going unless there is u. 
	g: The acceleration of gravity (重力加速度)
	*/
	this.anchor=anchor
	this.object=object
	this.l=l
	this.u=u
	this.g=g
    }
    move(){
	    let d=this.object.y-this.anchor.y,
	    a=2*this.u*this.g-this.object.v**2/(d-this.l)
	    object.v-=a

    }
    render(){
	//This thing is invisible
    }
}

class LyricPlayer{
    constructor(canvas,lyrics_string){
	this.canvas=canvas
	this.lyrics_string=lyrics_string
	this.objects=[]
	let lines=lyrics_string.split("\n\n")[1].split("\n")
        for(var line_index=0;line_index<lines.length;line_index++){
            var lyric_line_raw=lines[line_index],
                [time_raw, lyric_line_content]=lyric_line_raw.split(']'),
                time_string=time_raw.substring(1),
                [minute_string,second_string]=time_string.split(':'),
                [minute,second]=[Number(minute_string),Number(second_string)],
                timeOffset=minute*60+second
            this.objects[line_index*2]=new LyricLine(timeOffset,lyric_line_content,canvas)
	    if(line_index>=1){
		this.objects[line_index*2-1]
	    }
        }
	//TODO: support exittime

	this.springs=
    }

}



function main3(){


}

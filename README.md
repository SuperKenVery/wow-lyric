# Wow-Lyric

## Introduction
[Preview video (no sound)](https://user-images.githubusercontent.com/39673849/177709151-f3e54b48-4cb6-4a6b-b4ba-70028b2cd09a.webm)

Gorgeous lyric animation

If you've used Apple's Music app, you'll find it familiar.

## Usage

### Instant try:

[github.io](https://superkenvery.github.io/wow-lyric/)

[tencent cloud (might not me latest)](http://my-bucket-1252360629.cos-website.ap-guangzhou.myqcloud.com/)

### Host the site on your own:

1. Clone or download this repository
2. Open `index.html` using your browser
3. Upload the song file, lyric file and album art image file
4. Click `开始 Start` button

## Development

### GPU acceleration

The GPU acceleration part is a mess. It has mainly 2 functions:

- gaussium blur, as is extremely slow on CPU
- resize, as is not available to imagedata (but only drawImage())

These were originally implemented in gl.js, using bare WebGL. Then I soon found it impossible to maintain the code anymore. So I decided to switch to twgl, a tiny WebGL helper library, and re-wrote the blur part using twgl in blur.js. However the original one works just fine, so I decided to stay on the orginal one and didn't rewrite the resize part using twgl.js.

The blur implementation in gl.js uses a single GPU program which blurs at the max radius (and supports smaller radiuses by setting 0s in the weight matrix), which means the larger the max radius is, the slower ALL blur operations are. As the background requires a huge radius, it's not good to stay on gl.js anymore. But my blur implementation in blur.js creates a dedicated program for each radius. So I decided to switch to blur.js for blur. And I don't want to rewrite the resize part, so I left gl.js there, and commented out the blur function declaration (but all the shaders and other things are still there).

That's the whole story. Therefore, if you want to change the GPU acceleration part, I would recommend that you do that anywhere but gl.js, using twgl. Trust me. Twgl makes your life a lot easier.

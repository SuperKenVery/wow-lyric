/* jshint esversion: 9 */
import { LyricPlayer } from './animation.js'
import { Background } from './background.js'

export async function main() {
    const lyricContext = lyricCanvas.getContext('2d')
    if (lyricContext == null) {
        console.log("Failed to get 2d context of lyric canvas")
    }

    const bgContext = bgCanvas.getContext("webgl")
    if (bgContext == null) {
        console.log("Failed to get webgl context of background canvas")
    }

    startButton.innerHTML ="加载中 Loading"
    const background = new Background(artworkImageData, bgContext)
    background.play()

    const lyricPlayer = new LyricPlayer(lyricCanvas, lyrics)
    audioPlayer.play()
    lyricPlayer.play()

    const uploadControls=document.getElementById("upload-controls")
    uploadControls.style.display="none"

}

//var promise=main()



let lyrics = "", songurl = "", artworkImageData, lyricCanvas, bgCanvas, audioPlayer, lyricFileInput, songFileInput, artworkFileInput, startButton
document.addEventListener("DOMContentLoaded", () => {
    lyricCanvas = document.getElementById("lyric")
    bgCanvas = document.getElementById("background")
    audioPlayer = document.getElementById("song")
    lyricFileInput = document.getElementById("lyricfile")
    songFileInput = document.getElementById("songfile")
    artworkFileInput = document.getElementById("artworkfile")
    startButton = document.getElementById("start")

    let resize = function () {
        for(let i of [lyricCanvas,bgCanvas]){
            i.width=i.clientWidth*window.devicePixelRatio
            i.height=i.clientHeight*window.devicePixelRatio
        }
    }
    window.addEventListener("resize", resize)
    resize()

    let lyricFileInputHandler = function () {
        const file = lyricFileInput.files[0]
        if (file) {
            const reader = new FileReader()
            reader.addEventListener("load", () => {
                lyrics = reader.result
            })
            reader.readAsText(file)
        }
    }
    lyricFileInput.addEventListener("change", lyricFileInputHandler)
    lyricFileInputHandler()

    let songFileInputHandler = function () {
        const file = songFileInput.files[0]
        if (file) {
            if (songurl != "") URL.revokeObjectURL(songurl)
            songurl = URL.createObjectURL(file)
            audioPlayer.src = songurl
        }
    }
    songFileInput.addEventListener("change", songFileInputHandler)
    songFileInputHandler()

    let artworkFileInputHandler = function () {
        const file = artworkFileInput.files[0]
        if (file) {
            const imageurl = URL.createObjectURL(file)
            const img = new Image()
            img.src = imageurl
            img.onload = () => {
                const tmpCanvas = document.createElement("canvas")
                tmpCanvas.id="tmp canvas for reading the album image"
                tmpCanvas.width = img.width
                tmpCanvas.height = img.height
                const tmpCtx = tmpCanvas.getContext("2d")
                tmpCtx.drawImage(img, 0, 0)
                artworkImageData = tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height)
                tmpCanvas.remove()
                URL.revokeObjectURL(imageurl)
            }
        }
    }
    artworkFileInput.addEventListener("change", artworkFileInputHandler)
    artworkFileInputHandler()

    startButton.addEventListener("click", main)
})
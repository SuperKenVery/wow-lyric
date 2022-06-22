/* jshint esversion: 9 */
async function main() {
    const canvas = document.getElementById("lyric")
    const context = canvas.getContext('2d')
    if (context == null) {
        console.log("Failed to get 2d context")
    }

    const lyricPlayer = new LyricPlayer(canvas, lyrics)
    audioPlayer.play()
    lyricPlayer.play()
}

//var promise=main()

let lyrics=""
let audioPlayer=undefined
let lyricFileInput=undefined
let songFileInput=undefined
document.addEventListener("DOMContentLoaded", () => {
    lyricFileInput = document.getElementById("lyricfile")
    lyricFileInput.addEventListener("change", () => {
        const file = lyricFileInput.files[0]
        if (file) {
            const reader = new FileReader()
            reader.addEventListener("load", () => {
                lyrics = reader.result
            })
            reader.readAsText(file)
        }
    })

    songFileInput = document.getElementById("songfile")
    audioPlayer = document.getElementById("song")
    let songurl = ""
    songFileInput.addEventListener("change", () => {
        const file = songFileInput.files[0]
        if (file) {
            if (songurl != "") URL.revokeObjectURL(songurl)
            songurl = URL.createObjectURL(file)
            audioPlayer.src = songurl
        }
    })

    if (lyricFileInput.files[0]) {
        const reader = new FileReader()
        reader.addEventListener("load", () => {
            lyrics = reader.result
        })
        reader.readAsText(lyricFileInput.files[0])
    }
    if (songFileInput.files[0]) {
        songurl = URL.createObjectURL(songFileInput.files[0])
        audioPlayer.src = songurl
    }
})
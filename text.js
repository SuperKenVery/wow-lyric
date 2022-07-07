/* jshint esversion: 9 */
/* Thanks a lot to webglfundamentals.org !!
 * It really helped he a lot in learning webgl.
 * It tells everything so clearly.
 *
 * MDN failed to teach me this time, as it didn't
 * descript how to connect buffers, locations and
 * variables in shader sources well.
 */
import { lyric_line_blur_radius } from "./lyrics.js"
export function Text(text, fontsize, width) {
    let tmp_canvas = document.createElement('canvas')
    tmp_canvas.id = "tmp canvas for Text()"
    let ctx = tmp_canvas.getContext('2d')
    const setStyle = function () {
        const font = "700 " + String(fontsize) + "px Arial"
        ctx.textBaseline = 'top'
        ctx.font = font
        ctx.fillStyle = "white"
        ctx.textAlign = 'center'
    }

    tmp_canvas.width = width + 2 * lyric_line_blur_radius
    const lines = wrap(text, ctx, setStyle)
    setStyle()
    const measure = ctx.measureText(text)
    const height = measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent + 20 + 2 * lyric_line_blur_radius //The distance between each line's top line
    tmp_canvas.height = lines.length * height

    setStyle()
    const x = width / 2
    for (let line_index = 0; line_index < lines.length; line_index++) {
        const line = lines[line_index]
        ctx.fillText(line, x, height * line_index + measure.actualBoundingBoxAscent + lyric_line_blur_radius)
    }

    return ctx.getImageData(0, 0, tmp_canvas.width, tmp_canvas.height)
}

function wrap(text, ctx, styleSetter) {
    const width = ctx.canvas.width,
        measure = function (txt) {
            styleSetter()
            const metric = ctx.measureText(txt)
            const width = metric.actualBoundingBoxLeft + metric.actualBoundingBoxRight
            return width
        },
        words = text.split(" ")
    let lines = [], l = "", tl = l//l: line tl: test line
    for (let i = 0; i < words.length; i++) {
        tl += words[i]
        if (measure(tl) <= width) {
            tl += " "
            l = tl
        } else {
            if (l == "") {
                //The new line is empty
                //The word is longer than a whole line
                let nl //next line
                [l, nl] = splitAtWidth(words[i], measure, width)
                words.splice(i + 1, 0, nl)
            } else {
                i--
            }
            lines.push(l)
            l = ""
            tl = ""
        }
    }
    if (l != "") lines.push(l)
    return lines
}
function splitAtWidth(text, measure, width) {
    if (measure(text) <= width) {
        return [text, ""]
    } else {
        let a = "", ta = a//ta: test a
        for (let i = 0; i < text.length; i++) {
            ta += text[i]
            if (measure(ta) <= width) a = ta
            else {
                return [a, text.slice(i)]
            }
        }
    }

}
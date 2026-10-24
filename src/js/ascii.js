export const CHARS = "@%#*+=-:. ";

// RGBA pixel buffer -> array of text rows. Bright pixels get dense glyphs.
export function toAscii(pixels, width, height, chars = CHARS) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      const i = 4 * (x + y * width);
      const brightness = ((pixels[i] || 0) + (pixels[i + 1] || 0) + (pixels[i + 2] || 0)) / 3;
      row += chars.charAt(Math.floor((chars.length - 1) * (1 - brightness / 255)));
    }
    rows.push(row);
  }
  return rows;
}

export function charBrightness(char, chars = CHARS) {
  return (chars.indexOf(char) / (chars.length - 1)) * 255;
}

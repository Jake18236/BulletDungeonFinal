type BitmapTextAlign = "left" | "center" | "right";

export interface BitmapTextOptions {
  scale?: number;
  align?: BitmapTextAlign;
  letterSpacing?: number;
  baseline?: "top" | "middle" | "bottom";
}

interface GlyphRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const bitmapFontImage = new Image();
bitmapFontImage.src = "/sprites/bitmap-font.png";

const BITMAP_ATLAS_COLUMNS = 32;
const BITMAP_ATLAS_ROWS = 32;

// Atlas order should match the uploaded bitmap's glyph order.
// This includes the characters currently used by in-game canvas text.
const GLYPH_ORDER =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~";

const makeGlyphMap = (): Record<string, GlyphRect> => {
  const map: Record<string, GlyphRect> = {};
  const cellW = 1024 / BITMAP_ATLAS_COLUMNS;
  const cellH = 1024 / BITMAP_ATLAS_ROWS;

  for (let i = 0; i < GLYPH_ORDER.length; i++) {
    const col = i % BITMAP_ATLAS_COLUMNS;
    const row = Math.floor(i / BITMAP_ATLAS_COLUMNS);
    map[GLYPH_ORDER[i]] = {
      x: col * cellW,
      y: row * cellH,
      w: cellW,
      h: cellH,
    };
  }

  return map;
};

const glyphMap = makeGlyphMap();

const getTextWidth = (text: string, scale: number, letterSpacing: number) => {
  const baseAdvance = 32 * scale;
  if (!text.length) return 0;
  return text.length * baseAdvance + (text.length - 1) * letterSpacing;
};

export const drawBitmapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: BitmapTextOptions = {},
) => {
  if (!text) return;

  const {
    scale = 1,
    align = "left",
    letterSpacing = 0,
    baseline = "top",
  } = options;

  const glyphDrawSize = 32 * scale;
  const width = getTextWidth(text, scale, letterSpacing);

  let drawX = x;
  if (align === "center") drawX -= width / 2;
  if (align === "right") drawX -= width;

  let drawY = y;
  if (baseline === "middle") drawY -= glyphDrawSize / 2;
  if (baseline === "bottom") drawY -= glyphDrawSize;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const glyph = glyphMap[char];
    if (glyph && bitmapFontImage.complete && bitmapFontImage.naturalWidth > 0) {
      ctx.drawImage(
        bitmapFontImage,
        glyph.x,
        glyph.y,
        glyph.w,
        glyph.h,
        Math.round(drawX),
        Math.round(drawY),
        glyphDrawSize,
        glyphDrawSize,
      );
    } else {
      // Fallback path to avoid silently dropping characters when atlas is not loaded.
      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.max(10, Math.round(12 * scale))}px monospace`;
      ctx.textBaseline = "top";
      ctx.fillText(char, drawX + glyphDrawSize * 0.2, drawY + glyphDrawSize * 0.15);
    }

    drawX += glyphDrawSize + letterSpacing;
  }

  ctx.restore();
};


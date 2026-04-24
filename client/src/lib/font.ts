// font.ts

export type Glyph = {
  x: number;
  y: number;
  w: number;
  h: number;
  bearingX: number;
  bearingY: number;
  advance: number;
};

export type BitmapFont = {
  glyphs: Record<string, Glyph>;
  kernings: Record<string, number>;
  lineHeight: number;
  ascent: number; // important for baseline
};

/**
 * Builds a bitmap font from a Unity/TextMeshPro JSON file
 */
export function buildFont(json: any): BitmapFont {
  const glyphs: Record<string, Glyph> = {};
  const kernings: Record<string, number> = {};

  const glyphLookup: Record<number, any> = {};
  for (const g of json.m_GlyphTable) {
    glyphLookup[g.m_Index] = g;
  }

  for (const ch of json.m_CharacterTable) {
    const char = String.fromCharCode(ch.m_Unicode);
    const g = glyphLookup[ch.m_GlyphIndex];

    if (!g || !g.m_GlyphRect) continue;

    glyphs[char] = {
      x: g.m_GlyphRect.m_X,
      y: g.m_GlyphRect.m_Y,
      w: g.m_GlyphRect.m_Width,
      h: g.m_GlyphRect.m_Height,
      bearingX: g.m_Metrics.m_HorizontalBearingX,
      bearingY: g.m_Metrics.m_HorizontalBearingY,
      advance: g.m_Metrics.m_HorizontalAdvance
    };
  }

  // ✅ Kerning (if present)
  if (json.m_KerningTable?.m_KerningPairs) {
    for (const k of json.m_KerningTable.m_KerningPairs) {
      const key = `${k.m_FirstGlyph}-${k.m_SecondGlyph}`;
      kernings[key] = k.m_Offset;
    }
  }

  return {
    glyphs,
    kernings,
    lineHeight: Math.round(json.m_FaceInfo.m_LineHeight),
    ascent: Math.round(json.m_FaceInfo.m_AscentLine)
  };
}

export function measureText(
  font: BitmapFont,
  text: string,
  scale = 1,
  spacing = 0
) {
  let width = 0;
  let prev: string | null = null;

  for (const c of text) {
    const g = font.glyphs[c] ?? font.glyphs["?"];
    if (!g) continue;

    if (prev) {
      const key = `${prev.charCodeAt(0)}-${c.charCodeAt(0)}`;
      width += (font.kernings[key] ?? 0) * scale;
    }

    width += (g.advance + spacing) * scale;
    prev = c;
  }

  return width;
}

/**
 * Draws bitmap text using a font atlas + glyph metrics
 */
export function drawBitmapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: BitmapFont,
  image: HTMLImageElement,
  opts: {
    scale?: number;
    align?: "left" | "center" | "right";
    baseline?: "top" | "middle" | "bottom";
    letterSpacing?: number;
    color?: string;
  } = {}
) {
  const scale = opts.scale ?? 1;
  const spacing = opts.letterSpacing ?? 0;
  const color = opts.color;
  const align = opts.align ?? "left";
  const baseline = opts.baseline ?? "top";

  ctx.imageSmoothingEnabled = false;

  // --- measure ---
  const width = measureText(font, text, scale, spacing);

  if (align === "center") x -= width / 2;
  if (align === "right") x -= width;

  if (baseline === "middle") y -= (font.lineHeight * scale) / 2;
  if (baseline === "bottom") y -= font.lineHeight * scale;

  let cursorX = Math.round(x);
  let prev: string | null = null;

  // --- draw ---
  for (const c of text) {
    const g = font.glyphs[c] ?? font.glyphs["?"];
    if (!g) continue;

    // kerning
    if (prev) {
      const key = `${prev.charCodeAt(0)}-${c.charCodeAt(0)}`;
      cursorX += (font.kernings[key] ?? 0) * scale;
    }

    const srcY = image.height - (g.y + g.h);

    const dx = Math.round(cursorX + g.bearingX * scale);
    const dy = Math.round(y + (font.ascent - g.bearingY) * scale);

    ctx.drawImage(
      image,
      g.x,
      srcY,
      g.w,
      g.h,
      dx,
      dy,
      g.w * scale,
      g.h * scale
    );

    // optional color tint (cheaper version)
    if (color) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = color;
      ctx.fillRect(dx, dy, g.w * scale, g.h * scale);
      ctx.globalCompositeOperation = "source-over";
    }

    cursorX += (g.advance + spacing) * scale;
    prev = c;
  }
}

export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: BitmapFont,
  image: HTMLImageElement,
  opts: any = {}
) {
  const words = text.split(" ");
  let line = "";
  let offsetY = 0;
  const scale = opts.scale ?? 1;

  for (const word of words) {
    const test = line + word + " ";
    const w = measureText(font, test, scale, opts.letterSpacing);

    if (w > maxWidth && line !== "") {
      drawBitmapText(ctx, line, x, y + offsetY, font, image, opts);
      line = word + " ";
      offsetY += font.lineHeight * scale;
    } else {
      line = test;
    }
  }

  drawBitmapText(ctx, line, x, y + offsetY, font, image, opts);
}
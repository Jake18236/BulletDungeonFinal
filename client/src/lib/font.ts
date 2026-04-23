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
  lineHeight: number;
};

/**
 * Builds a bitmap font from a Unity/TextMeshPro JSON file
 */
export function buildFont(json: any): BitmapFont {
  const glyphs: Record<string, Glyph> = {};

  const glyphTable = json.m_GlyphTable;
  const charTable = json.m_CharacterTable;

  // ✅ Build lookup using m_Index (THIS is the fix)
  const glyphLookup: Record<number, any> = {};
  for (const g of glyphTable) {
    glyphLookup[g.m_Index] = g;
  }

  for (const ch of charTable) {
    const char = String.fromCharCode(ch.m_Unicode);
    const g = glyphLookup[ch.m_GlyphIndex];

    if (!g || !g.m_GlyphRect) {
      console.warn("Missing glyph:", char, ch.m_GlyphIndex);
      continue;
    }

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

  return {
    glyphs,
    lineHeight: Math.round(json.m_FaceInfo.m_LineHeight)
  };
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
    letterSpacing?: number;
    color?: string;
  } = {}
) {
  const scale = opts.scale ?? 1;
  const spacing = opts.letterSpacing ?? 1;
  const color = opts.color ?? "#00000000";
  ctx.imageSmoothingEnabled = false;

  // --- Measure width (for alignment) ---
  let width = 0;
  for (const c of text) {
    const g = font.glyphs[c] ?? font.glyphs["?"];
    if (!g) continue;
    width += g.advance + spacing;
  }

  if (opts.align === "center") x -= (width * scale) / 2;
  if (opts.align === "right") x -= width * scale;

  let cursorX = Math.round(x);
  
  // --- Draw each character ---
  for (const c of text) {
    const g = font.glyphs[c] ?? font.glyphs["?"];
    if (!g) continue;
    const srcY = image.height - (g.y + g.h); // flip Y because canvas has origin top-left, but font data is bottom-left
    ctx.save();
    ctx.drawImage(
      image,
      g.x,
      srcY,
      g.w,
      g.h,
      Math.round(cursorX + g.bearingX * scale),
      Math.round(y - g.bearingY * scale), // baseline alignment
      g.w * scale,
      g.h * scale
    );

    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = color;

    ctx.fillRect(
    Math.round(cursorX + g.bearingX * scale),
    Math.round(y - g.bearingY * scale),
    g.w * scale,
    g.h * scale
    );

ctx.restore();

    cursorX += (g.advance + spacing) * scale;
  }
}
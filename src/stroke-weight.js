export const strokeWeight=glyph=>glyph.strokeOverride ?? glyph.setStyle?.thickness ?? glyph.weight ?? 1.2;
export const libraryStyle=(glyph,style)=>glyph.insetConversion ? {...style,thickness:strokeWeight(glyph),rounding:0,endRounding:0} : {...style,...(glyph.strokeOverride!=null?{thickness:glyph.strokeOverride}:{})};

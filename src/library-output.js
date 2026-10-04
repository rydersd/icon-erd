export const OUTPUT_PROFILES={
  interface:{label:'Interface icons',size:24,sizes:[24],template:false},
  'menu-bar':{label:'macOS menu bar',size:18,sizes:[18,36],template:true},
  'mac-app':{label:'Mac app icon',size:1024,sizes:[16,32,64,128,256,512,1024],template:false},
  'pc-app':{label:'PC app icon',size:256,sizes:[16,24,32,48,64,128,256],template:false},
  custom:{label:'Custom',size:24,sizes:[24],template:false},
};
export const DEFAULT_OUTPUT={profile:'interface',variant:'source',familyView:false,colorMode:'original',fillColor:'#0267e0',strokeColor:'#1d2430',accentColor:'#ffb300',sizes:[24],useColorTokens:false,colorTokens:{fill:'--icon-fill',stroke:'--icon-stroke',accent:'--icon-accent'}};
export function validateOutput(input) {
  if(input==null)return null;
  if(input.colorTokens!==undefined && (!input.colorTokens || typeof input.colorTokens!=='object' || Array.isArray(input.colorTokens) || !['fill','stroke'].every(key=>typeof input.colorTokens[key]==='string')))throw Error('Invalid color tokens');
  const output={...DEFAULT_OUTPUT,...structuredClone(input),colorTokens:{...DEFAULT_OUTPUT.colorTokens,...input.colorTokens}};
  if(!OUTPUT_PROFILES[output.profile] || !['source','outline','solid','both','fill-stroke'].includes(output.variant) || !['original','single','multicolor'].includes(output.colorMode) || typeof output.familyView!=='boolean')throw new Error('Invalid library output options');
  if(!['fillColor','strokeColor','accentColor'].every(key=>/^#[0-9a-f]{6}$/i.test(output[key])))throw new Error('Output colors must be six-digit hex colors');
  if(typeof output.useColorTokens!=='boolean' || !output.colorTokens || !['fill','stroke','accent'].every(key=>/^--[a-z_][a-z0-9_-]{0,127}$/i.test(output.colorTokens[key])))throw new Error('Color tokens must be CSS custom property names, such as --icon-fill');
  if(!Array.isArray(output.sizes) || !output.sizes.length || output.sizes.length>16 || output.sizes.some(size=>!Number.isInteger(size) || size<8 || size>4096))throw new Error('Output sizes must be 8–4096 pixels (at most 16 sizes)');
  output.sizes=[...new Set(output.sizes)].sort((a,b)=>a-b);return output;
}
export function paintColors(layer,glyph,{mode='baked',mono=false,colors={},fallback='currentColor',useColorTokens=false}={}) {
  const output=glyph.output,primary=colors[layer.role] || fallback;
  const original=layer.color || primary;
  if(mono || output?.profile==='menu-bar')return {fill:'#000000',stroke:'#000000'};
  let paint=output?.colorMode==='single' ? {fill:output.fillColor,stroke:output.fillColor} : output?.colorMode==='multicolor' ? {fill:output.fillColor,stroke:output.strokeColor} : {fill:layer.fillColor || original,stroke:layer.strokeColor || original};
  if(output?.colorMode==='multicolor' && layer.role==='accent')paint={fill:output.accentColor||DEFAULT_OUTPUT.accentColor,stroke:output.accentColor||DEFAULT_OUTPUT.accentColor};
  if(useColorTokens && output?.useColorTokens)paint={fill:`var(${output.colorTokens.fill}, ${paint.fill})`,stroke:`var(${output.colorMode==='single'?output.colorTokens.fill:output.colorTokens.stroke}, ${paint.stroke})`};
  if(useColorTokens && output?.useColorTokens && output.colorMode==='multicolor' && layer.role==='accent')paint={fill:`var(${output.colorTokens.accent||DEFAULT_OUTPUT.colorTokens.accent}, ${output.accentColor||DEFAULT_OUTPUT.accentColor})`,stroke:`var(${output.colorTokens.accent||DEFAULT_OUTPUT.colorTokens.accent}, ${output.accentColor||DEFAULT_OUTPUT.accentColor})`};
  return paint;
}

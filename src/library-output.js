export const OUTPUT_PROFILES={
  interface:{label:'Interface icons',size:24,sizes:[24],template:false},
  'menu-bar':{label:'macOS menu bar',size:18,sizes:[18,36],template:true},
  'mac-app':{label:'Mac app icon',size:1024,sizes:[16,32,64,128,256,512,1024],template:false},
  'pc-app':{label:'PC app icon',size:256,sizes:[16,24,32,48,64,128,256],template:false},
  custom:{label:'Custom',size:24,sizes:[24],template:false},
};
export const DEFAULT_OUTPUT={profile:'interface',variant:'source',familyView:false,colorMode:'original',fillColor:'#0267e0',strokeColor:'#1d2430',sizes:[24],useColorTokens:false,colorTokens:{fill:'--icon-fill',stroke:'--icon-stroke'}};
export function validateOutput(input) {
  if(input==null)return null;
  const output={...DEFAULT_OUTPUT,...structuredClone(input)};
  if(!OUTPUT_PROFILES[output.profile] || !['source','outline','solid','both','fill-stroke'].includes(output.variant) || !['original','single','multicolor'].includes(output.colorMode) || typeof output.familyView!=='boolean')throw new Error('Invalid library output options');
  if(!['fillColor','strokeColor'].every(key=>/^#[0-9a-f]{6}$/i.test(output[key])))throw new Error('Output colors must be six-digit hex colors');
  if(typeof output.useColorTokens!=='boolean' || !output.colorTokens || !['fill','stroke'].every(key=>/^--[a-z_][a-z0-9_-]{0,127}$/i.test(output.colorTokens[key])))throw new Error('Color tokens must be CSS custom property names, such as --icon-fill');
  if(!Array.isArray(output.sizes) || !output.sizes.length || output.sizes.length>16 || output.sizes.some(size=>!Number.isInteger(size) || size<8 || size>4096))throw new Error('Output sizes must be 8–4096 pixels (at most 16 sizes)');
  output.sizes=[...new Set(output.sizes)].sort((a,b)=>a-b);return output;
}
export function paintColors(layer,glyph,{mode='baked',mono=false,colors={},fallback='currentColor',useColorTokens=false}={}) {
  const output=glyph.output,primary=colors[layer.role] || fallback;
  const original=layer.color || primary;
  if(mono || output?.profile==='menu-bar')return {fill:'#000000',stroke:'#000000'};
  let paint=output?.colorMode==='single' ? {fill:output.fillColor,stroke:output.fillColor} : output?.colorMode==='multicolor' ? {fill:output.fillColor,stroke:output.strokeColor} : {fill:layer.fillColor || original,stroke:layer.strokeColor || original};
  if(useColorTokens && output?.useColorTokens)paint={fill:`var(${output.colorTokens.fill}, ${paint.fill})`,stroke:`var(${output.colorMode==='single'?output.colorTokens.fill:output.colorTokens.stroke}, ${paint.stroke})`};
  return paint;
}

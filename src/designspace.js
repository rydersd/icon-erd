const finite = value => typeof value === 'number' && Number.isFinite(value);

export function validateDesignspace(value) {
  if(value == null)return null;
  if(!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 1)throw Error('Invalid designspace version');
  const opticalSize=value.opticalSize;
  if(!opticalSize || typeof opticalSize !== 'object' || Array.isArray(opticalSize) || !finite(opticalSize.reference) || opticalSize.reference<8 || opticalSize.reference>4096)throw Error('Invalid optical size reference');
  if(!Array.isArray(opticalSize.curve) || !opticalSize.curve.length)throw Error('Invalid optical size curve');
  const seen=new Set(),curve=opticalSize.curve.map(entry=>{
    if(!Array.isArray(entry) || entry.length!==2 || !finite(entry[0]) || !finite(entry[1]))throw Error('Invalid optical size curve');
    const [size,multiplier]=entry;
    if(size<8 || size>4096 || multiplier<=0 || multiplier>8 || seen.has(size))throw Error('Invalid optical size curve');
    seen.add(size);return [size,multiplier];
  }).sort((a,b)=>a[0]-b[0]);
  return {version:1,opticalSize:{reference:opticalSize.reference,curve}};
}

const multiplier=(curve,points)=>{
  if(points<=curve[0][0])return curve[0][1];
  if(points>=curve.at(-1)[0])return curve.at(-1)[1];
  for(let index=1;index<curve.length;index++)if(points<=curve[index][0]){
    const [leftSize,leftMultiplier]=curve[index-1],[rightSize,rightMultiplier]=curve[index];
    return leftMultiplier+(rightMultiplier-leftMultiplier)*(Math.log(points)-Math.log(leftSize))/(Math.log(rightSize)-Math.log(leftSize));
  }
  return curve.at(-1)[1];
};

export function opticalScale(designspace,points) {
  if(designspace == null)return 1;
  const {reference,curve}=validateDesignspace(designspace).opticalSize;
  return multiplier(curve,points)/multiplier(curve,reference);
}

export const pointSize=(profile,px)=>profile==='menu-bar' && px===36 ? px/2 : px;

export function atSize(glyph,designspace,points) {
  const scale=opticalScale(designspace,points);
  if(designspace == null || Math.abs(scale-1)<=1e-12)return glyph;
  const result=structuredClone(glyph),multiply=(object,key)=>{if(finite(object?.[key]))object[key]*=scale;};
  multiply(result,'weight');
  multiply(result.setStyle,'thickness');
  multiply(result,'strokeOverride');
  multiply(result.insetConversion,'stroke');
  result.layers?.forEach(layer=>multiply(layer,'strokeWidth'));
  return result;
}

import {validateOutput} from './library-output.js';
export const TOKEN_FIELDS = {
  thickness:{label:'Thickness',min:0.1,max:8,match:/thickness|stroke.?width/i},
  rounding:{label:'Corner radius',min:0,max:6,match:/corner|rounding/i},
  endRounding:{label:'End radius',min:0,max:6,match:/end.*(radius|round)|cap.*radius/i},
};
export function numberTokens(document) {
  if(!document || typeof document!=='object' || Array.isArray(document))throw new Error('Expected a JSON tokens object');
  const entries=new Map();
  const walk=(group,path=[],type)=>{
    if(!group || typeof group!=='object' || Array.isArray(group))return;
    if(Object.hasOwn(group,'$value')){entries.set(path.join('.'),{value:group.$value,type:group.$type || type});return;}
    for(const [name,value] of Object.entries(group))if(!name.startsWith('$'))walk(value,[...path,name],group.$type || type);
  };walk(document);
  const resolve=(name,seen=new Set())=>{
    if(seen.has(name))throw new Error(`Circular token reference: ${name}`);
    const entry=entries.get(name);if(!entry)throw new Error(`Missing token reference: ${name}`);
    if(entry.type && entry.type!=='number')return null;
    seen.add(name);
    const ref=typeof entry.value==='string' && entry.value.match(/^\{([^{}]+)\}$/);
    if(ref)return resolve(ref[1],seen);
    return (!entry.type || entry.type==='number') && Number.isFinite(entry.value)?entry.value:null;
  };
  const result=Object.fromEntries([...entries.keys()].map(name=>[name,resolve(name)]).filter(([,value])=>value!==null));
  if(!Object.keys(result).length)throw new Error('No numeric design tokens found. Drawing values use number tokens in canvas units.');
  return result;
}
export function tokenStyle(properties) {
  const values={...properties.values};
  const tokens=properties.source ? numberTokens(properties.source.document) : {};
  for(const [key,field] of Object.entries(TOKEN_FIELDS)) {
    const binding=properties.bindings?.[key];
    if(binding){if(!Object.hasOwn(tokens,binding))throw new Error(`Missing ${field.label} token: ${binding}`);values[key]=tokens[binding];}
    const value=values[key];
    if(value!=null && (!Number.isFinite(value) || value<field.min || value>field.max))throw new Error(`${field.label} must be ${field.min}–${field.max} canvas units`);
  }
  return {thickness:values.thickness??null,rounding:values.rounding??0,endRounding:values.endRounding??0};
}
export function validateLibraryProperties(input) {
  if(input==null)return null;
  if(typeof input!=='object' || Array.isArray(input) || !input.values || typeof input.values!=='object' || Array.isArray(input.values))throw new Error('Invalid library properties');
  const properties=structuredClone(input);
  if(properties.output!=null)properties.output=validateOutput(properties.output);
  if(properties.source && (typeof properties.source.name!=='string' || properties.source.name.length>256))throw new Error('Invalid tokens filename');
  if(properties.bindings && (typeof properties.bindings!=='object' || Array.isArray(properties.bindings)))throw new Error('Invalid token bindings');
  for(const key of Object.keys(TOKEN_FIELDS))if(properties.bindings?.[key]!=null && typeof properties.bindings[key]!=='string')throw new Error('Invalid token binding');
  tokenStyle(properties);return properties;
}
export function linkedLibraryProperties(document,name,current) {
  const tokens=numberTokens(document),bindings={};
  for(const [key,field] of Object.entries(TOKEN_FIELDS)) {
    const previous=current?.bindings?.[key];
    if(previous && !Object.hasOwn(tokens,previous))throw new Error(`Updated tokens file is missing ${previous}. Disconnect it before choosing different bindings.`);
    bindings[key]=previous && Object.hasOwn(tokens,previous) ? previous : Object.keys(tokens).find(path=>field.match.test(path) && (key!=='rounding' || !TOKEN_FIELDS.endRounding.match.test(path))) || '';
  }
  return validateLibraryProperties({...current,values:current?.values || {thickness:null,rounding:0,endRounding:0},source:{name,document},bindings});
}

export function validateSolidConstruction(value) {
  if(value==null)return null;
  if(!value||!['expanded','cutout'].includes(value.treatment)||!Number.isFinite(value.padding)||value.padding<0||value.padding>24||(value.cornerRounding!=null&&(!Number.isFinite(value.cornerRounding)||value.cornerRounding<0||value.cornerRounding>24)))throw Error('Invalid solid construction');
  return {...value};
}

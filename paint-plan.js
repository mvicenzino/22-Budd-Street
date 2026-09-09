// Benjamin Moore digital swatch metadata (bmc_color_hex), verified September 9, 2026.
// These are display colors; real paint appearance depends on light, finish and the screen.
export const HOUSE_PALETTE = [
  {id:'paleoak', name:'Pale Oak', code:'OC-20', brand:'Benjamin Moore', color:'#DDD9CE', source:'https://www.benjaminmoore.com/en-us/paint-colors/color/oc-20/pale-oak'},
  {id:'seapearl', name:'Seapearl', code:'OC-19', brand:'Benjamin Moore', color:'#E7E4D9', source:'https://www.benjaminmoore.com/en-us/paint-colors/color/oc-19/seapearl'},
  {id:'classicgray', name:'Classic Gray', code:'OC-23', brand:'Benjamin Moore', color:'#E3E0D7', source:'https://www.benjaminmoore.com/en-us/paint-colors/color/oc-23/classic-gray'},
];
export function defaultWall(room) {
  if (['kitchen', 'rear', 'sunroom', 'basement'].includes(room)) return 'seapearl';
  if (['bath', 'powder'].includes(room)) return 'classicgray';
  if (room === 'porch') return 'dove';
  return 'paleoak';
}

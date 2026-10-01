export const newDoc=()=>({stage:0,drawing:null,base:{h:1,w:1,hs:0,ws:0},layers:[],fill:[],frost:[],deco:[],write:[],candles:[],out:[],lit:false});
export function apply(d,m){const t=m.t;
 if(t==='stage'){if(m.v>d.stage)d.stage=m.v}
 else if(t==='drawing')d.drawing=d.drawing||m.v;
 else if(t==='base')Object.assign(d.base,m.v);
 else if(t==='add')d[m.k].push(m.v);
 else if(t==='undo')d[m.k].pop();
 else if(t==='out'){if(!d.out.includes(m.v))d.out.push(m.v)}
 else if(t==='lit')d.lit=true;
 else if(t==='reset')Object.assign(d,newDoc());
 return d}

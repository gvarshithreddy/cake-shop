import {createServer} from 'http';import {readFile} from 'fs';import path from 'path';import {Server} from 'socket.io';
import {apply,newDoc} from '../shared/apply.js';
const dist=path.resolve('dist'),types={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
const http=createServer((q,r)=>{const u=q.url.split('?')[0];const f=path.join(dist,path.extname(u)?u:'index.html');
 if(!f.startsWith(dist)){r.writeHead(403);return r.end()}
 readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end('not found')}r.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});r.end(d)})});
const io=new Server(http,{cors:{origin:true}});const rooms=new Map();
const pub=r=>r.users.map(u=>({name:u.name,on:!!u.id}));
io.on('connection',s=>{let R=null,slot=-1;
 s.on('join',({room,name,create},ack)=>{name=String(name||'Baker').slice(0,14);let r=rooms.get(room);
  if(!r){if(!create)return ack({error:'Room not found 🌸'});r={users:[],doc:newDoc()};rooms.set(room,r)}
  let i=r.users.findIndex(u=>u.name===name&&(!u.id||!io.sockets.sockets.has(u.id)));
  if(i<0&&r.users.length<2){r.users.push({name,id:null});i=r.users.length-1}
  if(i<0)return ack({error:'This room already has two bakers 💕'});
  r.users[i].id=s.id;R=room;slot=i;s.join(room);
  ack({slot:i,doc:r.doc,users:pub(r)});s.to(room).emit('users',pub(r))});
 s.on('act',m=>{const r=rooms.get(R);if(!r)return;const had=r.doc.drawing;
  if(m.t==='drawing'&&had)return s.emit('state',r.doc);apply(r.doc,m);s.to(R).emit('act',m)});
 s.on('cur',m=>{if(R)s.volatile.to(R).emit('cur',{...m,s:slot})});
 s.on('disconnect',()=>{const r=rooms.get(R);if(r&&r.users[slot]?.id===s.id){r.users[slot].id=null;s.to(R).emit('users',pub(r))}});
});
http.listen(process.env.PORT||3000,()=>console.log('🍰 cake shop on',process.env.PORT||3000));

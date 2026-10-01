# 🍰 Our Little Cake Shop
Two people, one cake. Vite + TypeScript + Three.js client, Node + Socket.IO server. No accounts, no paid services.

## Local dev (two terminals)
```
npm install
npm run dev:server   # http://localhost:3000 (sockets)
npm run dev          # http://localhost:5173 (open this; proxies sockets)
```
Open the app in two browser windows; create a room in one, open the invite link in the other.

## Production
```
npm install && npm run build && npm start
```
The server serves `dist/` and sockets on `PORT` (default 3000).

## Free deployment (Render / Railway / Fly free tiers)
Create a Node web service from this repo: build `npm install && npm run build`, start `npm start`. Share the public URL; invite links use the page origin. Rooms live in server memory (a restart clears them).

## How it works
The shared `CakeDocument` lives on the server (`shared/apply.js` is the single reducer used by both sides). Clients send small actions (`drawing`, `base`, `add`, `undo`, `out`, ...); cursors are ephemeral volatile events. The cake mesh is built from the drawn points only: smooth, close, triangulate, extrude, bevel (`makeGeo`). The guide is just dotted points and never feeds geometry.

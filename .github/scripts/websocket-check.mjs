// CI check on the running stack: a notification WebSocket, opened the way the dashboard opens it,
// stays open past the channel layer's 5-second Redis wait and still receives a notification.
//
// usage: node --experimental-strip-types .github/scripts/websocket-check.mjs <ws url> <access token> <seconds>
// The workflow sends a notification after <seconds>; this exits 0 once it arrives on the same socket.
//
// Node's WebSocket checks subprotocols the way browsers do, and the subprotocol comes from the
// dashboard's own code, so a token the browser would refuse fails here too.
import { tokenSubprotocol } from "../../frontend/lib/wsProtocols.ts";

const [url, token, holdSeconds] = process.argv.slice(2);
const holdMs = Number(holdSeconds) * 1000;
const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
const fail = (why) => {
  console.error(`FAIL after ${elapsed()}: ${why}`);
  process.exit(1);
};

const ws = new WebSocket(url, ["notifications", tokenSubprotocol(token)]);
setTimeout(() => fail("no notification arrived"), holdMs + 30_000);
ws.onopen = () => console.log(`open (subprotocol "${ws.protocol}")`);
ws.onerror = () => fail("the WebSocket failed (refused handshake or dropped connection)");
ws.onclose = (event) => fail(`the socket closed (code ${event.code})`);
ws.onmessage = (event) => {
  if (Date.now() - started < holdMs) fail(`a notification came before ${holdSeconds} s: ${event.data}`);
  console.log(`still open after ${elapsed()}, received ${event.data}`);
  process.exit(0);
};

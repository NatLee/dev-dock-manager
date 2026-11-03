// WebSocket subprotocols the backend reads (src/xterm/consumers.py, token_from_subprotocols).
//
// A subprotocol has to be an RFC 7230 token, and browsers throw a SyntaxError on anything else
// before a connection is even attempted. A JWT already is one (base64url parts joined by dots),
// so it goes in unchanged. Encoding it again with btoa() adds "=" padding and "/", which broke
// the dashboard for every account whose token came out the wrong length (user ids 10-99).
//
// No imports on purpose: CI loads this file straight into Node to check the real thing.
export function tokenSubprotocol(token: string): string {
  return "token." + token;
}

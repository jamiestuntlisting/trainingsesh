import { randomBytes } from "crypto";

// Unguessable per-(session, contact) token. Because a token is minted only
// when you invite someone for a specific session, and it is bound to that one
// session row, nobody can sign up early or for future weeks — there is simply
// no token for a session you haven't created and invited yet.
export function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

import { base } from "./base.mjs";

export const channelNe = ({ tc }) => base(`
  <h1>Channel ${tc} is not in our channel list</h1>
  <p>If your channel exists in telegram, it will be added to our list soonly.</p>
  <p><a href="/${tc}/info">Reload this page.</a></p>
`);
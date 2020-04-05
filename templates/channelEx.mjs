import { base } from "./base.mjs";

export const channelEx = ({ tc, host }) => {
  const link = `http://${host}/${tc}/rss.xml`;
  return base(`
  <h1>Channel ${tc}</h1>
  <p>Copy this link in your favorite rss reader:</p>
  <a href="${link}">${link}</a>
  `);
};
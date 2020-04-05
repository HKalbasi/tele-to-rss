import { base } from "./base.mjs";

export const rootPage = ({ count }) => base(`
  <h1>Welcome to tele-to-rss</h1>
  <p>There is rss feed for ${count} telegram channels.</p>
  <input type="text" id="tc" placeholder="Enter channel id"></input>
  <button onclick="window.location='/'+document.getElementById('tc').value+'/info'">
    go
  </button>
`);
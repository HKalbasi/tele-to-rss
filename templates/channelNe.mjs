import { base } from "./base.mjs";

export const channelNe = ({ tc }) => base(`
  <h1>Channel ${tc} is not in our channel list</h1>
  <p>Add it by entering the last message id of channel here:</p>
  <input type="text" id="tc" placeholder="Enter last message id"></input>
  <button onclick="window.location='add/'+document.getElementById('tc').value">
    add channel
  </button>
  
`);
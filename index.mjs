import RSS from "rss";
import http from "http";
import fs from "fs";
import { promisify } from "util";
import { rootPage } from "./templates/root.mjs";
import { channelNe } from "./templates/channelNe.mjs";
import { channelEx } from "./templates/channelEx.mjs";
import fetch from "node-fetch";
import { base } from "./templates/base.mjs";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

let db = {};

const readDB = async () => {
  db = JSON.parse((await readFile('backup.json')).toString());
};

const readConfig = async () => JSON.parse((await readFile('config.json')).toString());

const writeDB = async () => {
  await writeFile('backup.json', JSON.stringify(db));
};

const builder = ({ host, tc, messages }) => {
  const feed = new RSS({
    title: `telegram @${tc}`,
    description: `rss feed for telegram channel @${tc}`,
    site_url: `http://${host}/${tc}`,
    feed_url: `http://${host}/${tc}/rss.xml`,
  });
  messages.forEach(({ id, text }) => feed.item({
    title: `#${id}`,
    description: text,
    url: `https://t.me/${tc}/${id}`,
  }));
  return feed.xml();
};

const getMeta = (property) => (html) => {
  const s = `<meta property="${property}" content="`;
  return html.split(s)[1].split('"')[0];
};

const getDescription = getMeta('og:description');

const fetchMessage = async ({ tc, id }) => {
  const res = await (await fetch(`https://t.me/${tc}/${id}`)).text();
  return getDescription(res);
};

const fetchUpdates = async ({ tc, from }) => {
  const failText = await fetchMessage({ tc, id: 100000000});
  const ar = [];
  let cntFail = 0;
  for (let id = from; id < from + 50; id += 1) {
    const text = await fetchMessage({ tc, id });
    if (text !== failText) {
      cntFail = 0;
      ar.push({
        id, text,
      });
    }
    else {
      if (cntFail === 5) {
        return { last: id - cntFail - 1, messages: ar };
      }
      cntFail += 1;
    }
  }
  return { last: from + 40, messages: ar };
};

const findLastId = async ({ tc }) => {
  const failText = await fetchMessage({ tc, id: 100000000});
  let l = 1, r = 1e6;
  while (r - l > 1) {
    const mid = Math.floor((l + r) / 2);
    console.log(mid);
    const ids = [mid, mid+1, mid+2, mid+3, mid+4];
    const test = await Promise.all(ids.map(id => fetchMessage({ tc, id })));
    if (test.filter(x => x !== failText).length === 0) {
      r = mid;
    }
    else {
      l = mid;
    }
  }
  return l;
};

//findLastId({tc:'sharif_prm'}).then(console.log);

const doUpdates = async (tc) => {
  try {
    const f = db[tc];
    const res = await fetchUpdates({ tc, from: f.last+1 });
    if (res.messages.length === 0) return;
    console.log(`New message @${tc}`);
    f.last = res.last;
    f.messages = f.messages.concat(res.messages);
    if (f.messages.length > 20) {
      f.messages = f.messages.slice(-20);
    }
  }
  catch (e) {
    console.log(e);
  }
};

const serverBuilder = ({ host }) => http.createServer((req, res) => {
  if (req.url === '/') {
    res.end(rootPage({ count: Object.keys(db).length }));
  }
  const [, tc, q, param] = req.url.split('/');
  if (q === 'info') {
    const x = db[tc];
    if (x === undefined) {
      res.end(channelNe({ tc }));
      return;
    }
    res.end(channelEx({ host, ...db[tc] }));
    return;  
  }
  if (q === 'rss.xml') {
    const x = db[tc];
    if (x === undefined) {
      res.writeHead(404, {'Content-Type': 'text/plain'});
      res.end('Not found');
      return;
    }
    res.end(builder({ host, ...x }));
    return;
  }
  if (q === 'add') {
    if (db[tc] !== undefined) {
      res.end(base('We have your channel'));
    }
    db[tc] = {
      tc,
      last: Number(param)-1,
      messages: [],
    };
    res.end(base('Your channel added'));
    return;
  }
  res.end('404');
});

const delay = (ms) => new Promise((res)=>setTimeout(res, ms));

const main = async () => {
  const { host, port, updateTime } = await readConfig();
  await readDB();
  serverBuilder({ host }).listen(port);
  while (true) {
    await delay(updateTime * 60000);
    await Promise.all(Object.keys(db).map(doUpdates));
    await writeDB();
  }
};

main();

const exitHandler = (options) => async (exitCode) => {
  console.log('writing');
  await writeDB();
  console.log('done');
  if (options.cleanup) console.log('clean');
  if (exitCode || exitCode === 0) console.log(exitCode);
  if (options.exit) process.exit();
};

//catches ctrl+c event
process.on('SIGINT', exitHandler({exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler({exit:true}));
process.on('SIGUSR2', exitHandler({exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler({exit:true}));

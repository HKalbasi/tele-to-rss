import RSS from "rss";
import http from "http";
import fs from "fs";
import { promisify } from "util";
import { rootPage } from "./templates/root.mjs";
import { channelNe } from "./templates/channelNe.mjs";
import { channelEx } from "./templates/channelEx.mjs";

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
  const text = getDescription(res);
  if (text === `You can view and join @${tc} right away.`) {
    return { success: false };
  }
  return { success: true, text };
};

const fetchUpdates = async ({ tc, from }) => {
  const ar = [];
  let cntFail = 0;
  for (let id = from;; id += 1) {
    const x = await fetchMessage({ tc, id });
    if (x.success) {
      cntFail = 0;
      ar.push({
        id,
        text: x.text,
      });
    }
    else {
      if (cntFail === 5) {
        return { last: id - cntFail, messages: ar };
      }
      cntFail += 1;
    }
  }
};

const doUpdates = async (tc) => {
  const f = db[tc];
  const res = await fetchUpdates({ tc, from: f.last+1 });
  if (f.last === res.last) return;
  console.log(`New message @${tc}`);
  f.last = res.last;
  f.messages = f.messages.concat(res.messages);
  if (f.messages.length > 20) {
    f.messages = f.messages.slice(-20);
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
    res.end(channelEx({ host, tc }));
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
      res.end('We have your channel');
    }
    db[tc] = {
      tc,
      last: Number(param)-1,
      messages: [],
    };
    res.end('Your channel added');
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
    await delay(updateTime * 60);
    await Promise.all(Object.keys(db).map(doUpdates));
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

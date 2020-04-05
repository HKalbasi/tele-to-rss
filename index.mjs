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
const host = '127.0.0.1:14587';

const readDB = async () => {
  db = JSON.parse((await readFile('backup.json')).toString());
};

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
        return ar;
      }
      cntFail += 1;
    }
  }
};

const server = http.createServer((req, res) => {
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
      last: Number(param),
      messages: [],
    };
    res.end('Your channel added');
    return;
  }
  res.end('404');
});

const main = async () => {
  await readDB();
  server.listen(14587);
};

main();
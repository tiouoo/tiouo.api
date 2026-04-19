import express from 'express';
import api from './src/api/@index.js';
import { setupSwagger } from './src/service/swagger.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  next();
});

const filename = fileURLToPath(import.meta.url);
const _dirname = dirname(filename);

app.set('view engine', 'ejs');
app.set('views', path.join(_dirname, 'src', 'views'));

// 配置静态文件服务
app.use('/static', express.static(path.join(_dirname, 'static')));

app.use(express.json());

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const parts = [`[${req.method}]`, req.url, `IP:${ip}`];
  if (Object.keys(req.query).length) parts.push(`Query:${JSON.stringify(req.query)}`);
  if (req.body && Object.keys(req.body).length) parts.push(`Body:${JSON.stringify(req.body)}`);
  console.log(...parts);
  next();
});

app.use('/api', api);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

setupSwagger(app);

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`app listening on http://localhost:${port}`);
});

export default app;

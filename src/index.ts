import { koaConfig } from './config/base';
import { server } from "./frpServer";
import * as Datastore from 'nedb';
import * as path from 'path'
import * as Koa from 'koa';
import * as koaBodyParser from 'koa-bodyparser';
import { promisfy } from './utils';
import * as koaStatic from 'koa-static';

server.serve();

interface ITokenDBDoc {
  token: string;
  createTime: number;
  ip: string;
  user: string;
}

const tokenDB = new Datastore<ITokenDBDoc>({ filename: path.resolve(__dirname, '../db/token.dat'), autoload: true });

const app = new Koa();

function messageFac(msg: string) {
  return JSON.stringify({
    message: msg
  });
}
function dataFac(d: any) {
  return JSON.stringify({
    data: d
  });
}
const insertToken = promisfy(tokenDB.insert, tokenDB);
const findToken = promisfy<ITokenDBDoc[]>(tokenDB.find, tokenDB);

findToken({ token: /.*/ }).then(docs => {
  docs.forEach(doc => {
    server.addToken(doc.token);
  });
})

function createToken() {
  return Math.random().toString(16).substr(2) + Math.random().toString(16).substr(2);
}

app.use(koaStatic(path.join(__dirname, '../public')));
app.use(koaBodyParser());
app.use(async (ctx, next) => {
  const body = ctx.request.body;
  console.log(body)
  if (body.user) {
    if (ctx.method.toLowerCase() === 'post') {
      switch (ctx.request.path) {
        case '/getmytoken':
          const result = await findToken({ user: body.user });
          if (result.length) {
            ctx.body = dataFac(result.map(doc => ({ token: doc.token, createTime: doc.createTime }))[0]);
          } else {
            const token = createToken();
            await insertToken({ token, ip: ctx.ip, user: body.user, createTime: Date.now() });
            server.addToken(token);
            ctx.body = dataFac({ token, createTime: Date.now() });
          }
          break;
        case '/getmybinds':
          if (body.token) {
            const binds = server.getBindsByToken(body.token)
            ctx.body = dataFac(binds);
          }
          break;
        default:
          break;
      }
    }
  }
  await next();
});

app.listen(koaConfig.port, koaConfig.host);
console.log(`front end server is listensing on: http://${koaConfig.host}:${koaConfig.port}`);
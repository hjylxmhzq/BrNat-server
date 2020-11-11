"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const base_1 = require("./config/base");
const frpServer_1 = require("./frpServer");
const Datastore = require("nedb");
const path = require("path");
const Koa = require("koa");
const koaBodyParser = require("koa-bodyparser");
const utils_1 = require("./utils");
const koaStatic = require("koa-static");
frpServer_1.server.serve();
const tokenDB = new Datastore({ filename: path.resolve(__dirname, '../db/token.dat'), autoload: true });
const app = new Koa();
function messageFac(msg) {
    return JSON.stringify({
        message: msg
    });
}
function dataFac(d) {
    return JSON.stringify({
        data: d
    });
}
const insertToken = utils_1.promisfy(tokenDB.insert, tokenDB);
const findToken = utils_1.promisfy(tokenDB.find, tokenDB);
findToken({ token: /.*/ }).then(docs => {
    docs.forEach(doc => {
        frpServer_1.server.addToken(doc.token);
    });
});
function createToken() {
    return Math.random().toString(16).substr(2) + Math.random().toString(16).substr(2);
}
app.use(koaStatic(path.join(__dirname, '../public')));
app.use(koaBodyParser());
app.use(async (ctx, next) => {
    const body = ctx.request.body;
    console.log(body);
    if (body.user) {
        if (ctx.method.toLowerCase() === 'post') {
            switch (ctx.request.path) {
                case '/getmytoken':
                    const result = await findToken({ user: body.user });
                    if (result.length) {
                        ctx.body = dataFac(result.map(doc => ({ token: doc.token, createTime: doc.createTime }))[0]);
                    }
                    else {
                        const token = createToken();
                        await insertToken({ token, ip: ctx.ip, user: body.user, createTime: Date.now() });
                        frpServer_1.server.addToken(token);
                        ctx.body = dataFac({ token, createTime: Date.now() });
                    }
                    break;
                case '/getmybinds':
                    if (body.token) {
                        const binds = frpServer_1.server.getBindsByToken(body.token);
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
app.listen(base_1.koaConfig.port, base_1.koaConfig.host);
console.log(`front end server is listensing on: http://${base_1.koaConfig.host}:${base_1.koaConfig.port}`);
//# sourceMappingURL=index.js.map
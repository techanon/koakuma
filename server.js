try { Object.assign(process.env, require('./.env.json')); } catch (e) { }
//*/
const noop = () => { };
const fs = require('fs');
const Koa = require('koa');
const Pug = require('koa-pug');
const glob = require('glob');
const CSRF = require('koa-csrf');
// const Redis = require('koa-redis');
const Router = require('koa-router');
const Session = require('koa-session2');
const FileSend = require('koa-send');
const UserAgent = require('koa-useragent');
const DetectAjax = require('koa-isajax');
const BodyParser = require('koa-bodyparser');

// const Config = require('./config');
const Config = { secret: 'meh' };
/*/
import Koa from 'koa';
import Router from 'koa-router';
import Pug from 'koa-pug';
import Session from 'koa-session2';
import CSRF from 'koa-csrf';
// import Redis from 'koa-redis';
import FileSend from 'koa-send';
import UserAgent from 'koa-useragent';
import BodyParser from 'koa-bodyparser';
import DetectAjax from 'koa-isajax';

import * as config from './config';
//*/

function LOG(level, err) { console.log(`[${level.toUpperCase()}]`, err.message || err) }

(async _ => {

    const DEV = process.env.NODE_ENV == 'development' || false;

    const app = new Koa();
    app.proxy = true;
    app.env = process.env.NODE_ENV;
    app.keys = ['reeeee normies get out of my code', Config.secret];

    app.on('error', LOG.bind(null, 'error'));
    app.on('warn', LOG.bind(null, 'warning'));
    app.on('notice', LOG.bind(null, 'notice'));
    app.on('info', LOG.bind(null, 'info'));

    LOG('up', 'Starting server...');

    const pug = new Pug({
        app,
        viewPath: './views',
        debug: DEV,
        noCache: DEV,
        compileDebug: DEV,
        pretty: DEV,
        locals: {},
        helperPath: []
    });

    app.use(BodyParser());
    app.use(UserAgent);
    app.use(DetectAjax());

    app.use(Session({
        key: 'sid',
        cookie: {
            path: '/',
            httpOnly: true,
            secure: true,
            maxAge: 1000 * 60 * 60 * 24 * 3
        }
    }));


    const root = new Router();

    app.context.cache = null;

    root.get('/files/:file.:ext', (ctx, next) => {
        let f = ctx.params.file + '.' + ctx.params.ext;
        let opts = {
            root: process.cwd() + '/public/'
        };
        ctx.set('X-Sent', true);
        ctx.set('X-Timestamp', ctx.state.NOW);
        return FileSend(ctx, f, options);
    });

    app.emit('info', 'Synchronizing view folders...');

    let apps = glob.sync('apps/*/');
    let sym = glob.sync('views/**/', { symlinks: true });
    console.log('apps',apps);
    console.log('sym',sym);

    sym.shift(); // ignore ref to containing folder
    sym.forEach(i => { // remove any broken view symlinks
        let uri = i.slice(i.indexOf('/')+1, i.lastIndexOf('/'));
        if (fs.existsSync(`views/${uri}`) && !fs.existsSync(`apps/${uri}/views`))
            fs.unlinkSync(i);
    });
    apps.forEach(i => { // create view symlinks that should be present but aren't.
        let uri = i.slice(i.indexOf('/')+1, i.lastIndexOf('/'));
        if (!fs.existsSync(`views/${uri}`))
            if (fs.existsSync(`apps/${uri}/views`))
                fs.symlinkSync(process.cwd() + `/apps/${uri}/views`, `views/${uri}`, 'junction');
            else app.emit('notice', `Views directory does not exist for /${uri}, Skipping.`);
    });
    app.emit('info', 'Views have been synchronized.')

    // remove apps that don't have any loadable file.
    apps = apps.filter(i => {
        try { require.resolve(`./${i}`); return false; } 
        catch (e) { app.emit('warn', e.message); return true; }
    });

    const appcache = {};

    let thrown = 0;
    let stacks = 0;
    let errorToThrow = null;
    Error.stackTraceLimit = 5;

    function requires(caller) {
        let failure = `App ${caller} failed waiting for`;
        return uri => new Promise((res, rej) => {
            if (uri in appcache)
                if (appcache[uri] instanceof Error) {
                    app.emit('error', `${failure} -> /${uri}`); // dependancy error log
                    rej(appcache[uri]);
                } else res(appcache[uri]);
            else if (!apps.filter(i => i.startsWith(`apps/${uri}`)).length)
                return rej(new Error(`Unable to find dependancy: /${uri}`));
            else {
                app.once(`require/${uri}`, data => {
                    appcache[uri] = data;
                    app.removeAllListeners(`failure/${uri}`);
                    app.emit('info',`App /${uri} has been successfully loaded.`);
                    res(data);
                });
                app.once(`failure/${uri}`, e => {
                    if (!(uri in appcache)) appcache[uri] = e;
                    app.removeAllListeners(`require/${uri}`);
                    app.emit('warn', `${failure} -> /${uri}`); // dependancy error log
                    rej(e);
                });
            }
        });
    };

    // Load all apps.
    await Promise.all(apps.map(async i => {
        let route = new Router();
        let uri = i.slice(i.indexOf('/')+1, i.lastIndexOf('/'));
        let success = data => {
            root.use(route.routes(), route.allowedMethods());
            app.emit(`require/${uri}`, data);
        };
        let err = e => {
            if (!(e instanceof Error)) e = new Error(e);
            app.emit(`failure/${uri}`, e);
            if (!e.thrown) { // Initial error log
                app.emit('error', `App /${uri} failed to load: ${e.message}`);
                e.thrown = true;
                if (!stacks) errorToThrow = e;
                stacks++;
            }
            thrown++;
        };
        console.log('check '+ uri);
        try {
            route.require = requires(uri);
            route.prefix(uri);
            let res = require(`./apps/${uri}`);
            if (typeof res == 'function') res = res(app, route);
            if (res instanceof Promise) res = await res;
            success(res);
        } catch (e) { err(e); }
    }));

    if (errorToThrow) {
        app.emit('warn', `${thrown} apps failed to load.`);
        if (stacks > 1) app.emit('notice', `${stacks - 1} additional errors thrown. Resolve existing error to see others.`);
        throw errorToThrow.stack;
    }

    app.use(root.routes(), root.allowedMethods());

    app.listen(8086, _ => LOG('up', 'Running on port 8086.'));

})().catch(e => LOG('down', e));
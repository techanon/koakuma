# Kuma CMS
### Inspired by [ElefantCMS](https://elefantcms.com)
#### Powered by the [Koa](http://koajs.com/) framework.
##### Routing powered by the [Koa-Router](https://www.npmjs.com/package/koa-router) package.
##### Templates powered by the [Koa-Pug](https://www.npmjs.com/package/koa-pug) package. ([Pug docs](https://pugjs.org/))

All views are synced into the global /views folder.
Automatic App discovery is determined by a folder in the apps directory that contains an index.js.
App specific views are searched for in the /apps/*/views.

- /apps/blog/index.js
- /apps/users/index.js
- /apps/database/index.js

When an app is loaded, it can export whatever it wants (arbitrary data).
if the app exports a Promise, the Promise is awaited for resolution.
If the app exports a function (async or normal), the function is called with the koa instance and app specific router instance.
If either the Promise or function resolves to another Promise or function, that too will be resolved or called like before.
This will continue until a non resolvable object or primitive is returned.
Once the app has been fully resolved, the resulting data will be made available to other apps that are depending on itself.
An app can declare a dependancy on another app by calling `await route.require('app')`.
This is intended to mimic commonJS' `require()`, but specifically for referencing other CMS apps instead of modules.
The `await` is recommended to ensure that the dependancy is loaded. If `await` is not used, you must handle the returned promise yourself.
You can also import the arbitrary data from other apps simply by assigning the result of the `await` to a variable.

## Examples

Exporting recommended standard async function (partial pseudo-code):
```javascript
// pseudo-location: apps/blog/index.js

function index(ctx){ ... }
function getPost(ctx){ ... }
function viewPost(ctx){ ... }
function editPost(ctx){ ... }

function embedPost(id){ ... }

module.exports = async (app, route) => {
    let user = await route.require('users');

    // routes are implicitly prefixed with /blog
    route.get('/',index);
    route.get('/:post',viewPost);
    route.get('/:post/edit',user.auth('blog/edit'),getPost);
    route.post('/:post/edit',user.auth('blog/edit'),editPost):

    return {embedPost};
};
```

Exporting non-resolvable data:
```javascript
// pseudo-location: apps/config/index.js

const fs = require('fs');
const yml = require('read-yaml').sync;

let config = {};
let cache = {};

config.secret = 'reeeeeeeeeeeee get out of my code';
config.get = (app){ return cache[uri] || (cache[uri] = yml(`apps/${app}/config.yml`)) };

module.exports = config;
```

Exporting an async function that returns a promise that returns some non-resolveable data:
```javascript
// pseudo-location: apps/twitter/index.js

const axios = require('axios');

module.exports = async (app, route) => {
    let config = await route.require('config');

    return axios.get(config.get('twitter').apiEndpoint).then(x=>JSON.parse(x));

};

```
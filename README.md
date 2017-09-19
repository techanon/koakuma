# Kuma CMS
### Inspired by [ElefantCMS](https://elefantcms.com)
#### Powered by the [Koa](http://koajs.com/) framework and related packages. 

All views are synced into the global /views folder.
Automatic App discovery is determined by a folder in the apps directory that contains an index.js.
All of the following directories are considered valid apps:

- /apps/blog/index.js
- /apps/users/index.js
- /apps/database/index.js
- /apps/database/postgres/index.js

App specific views are searched for in the /apps/*/views.

When an app is loaded, it can export whatever it wants (arbitrary data).
if the app exports a Promise, the Promise is awaited for resolution.
If the app exports a function (async or normal), the function is called with the koa instance and app specific router instance.
If either the Promise or function resolves to another Promise or function, that too will be resolved or called like before.
This will continue until a non resolvable object or primitive is returned.
Once the app has been fully resolved, the resulting data will be made available to other apps that are depending on itself.
An app can declare a dependancy on another app by calling `await route.requires('app');`. 
The `await` is required to ensure that the dependancy is loaded.
You can also import the arbitrary data from other apps simply by assigning the result of the `await` to a variable.
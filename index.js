const express = require('express');
const cors = require('cors');
const { camelCaseToRouterCase, camelCaseToLodashCase } = require('./lib/utils/tool');
// Global variables
global._ = require('lodash');
global.config = require('config');
global.Logger = require('./lib/logger');
global.mongoose = require('mongoose');
global.fs = require('fs');
global.moment = require('moment');
global.async = require('async');
global.ms = require('ms');
global.MailUtil = require('./lib/utils/mail');
global.logger = Logger(`${__dirname}/logs`);

// Load models
fs.readdirSync(`${__dirname}/lib/models`).forEach((file) => {
  global[_.upperFirst(_.camelCase(file.replace('.js', 'Model')))] = require(`./lib/models/${file}`);
});

// Middleware
const bodyParser = require('body-parser');
const tokenToUserMiddleware = require('./lib/middleware/tokenToUser');
const verifyTokenMiddleware = require('./lib/middleware/verifyToken');
const validPermissionMiddleware = require('./lib/middleware/validPermission');

// Socket.IO
const socketManager = require('./lib/socket/socketManager');

// Handle routes
const UserHandle = require('./lib/routes/user');
const UserAdminHandle = require('./lib/routes/admin/user');
const PermissionAdminHandle = require('./lib/routes/admin/permission');


// Start server
const app = express();
app.set('trust proxy', true);
const server = require('http').Server(app);

// Initialize Socket.IO with our custom manager
socketManager.initialize(server);
global.io = socketManager.io; // For backward compatibility

// Middleware setup
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static('public'));

// Define route declaration function
const declareRoute = (method, routeName, middlewares = [], destinationRoute) => {
  if (!destinationRoute || !routeName) {
    return;
  }

  Object.keys(destinationRoute).forEach((version) => {
    app[method](`/api/${version}${routeName}`, middlewares, destinationRoute[version]);
  });
};

// Health check endpoint
// API Routes - Example routes for the template
declareRoute('post', '/user/login', [], UserHandle.login);
declareRoute('post', '/user/logout', [tokenToUserMiddleware], UserHandle.logout);
declareRoute('post', '/user/get', [tokenToUserMiddleware], UserHandle.get);
declareRoute('post', '/user/change-password', [tokenToUserMiddleware], UserHandle.changePassword);
declareRoute('post', '/user/change-password-level2', [tokenToUserMiddleware], UserHandle.changePasswordLevel2);
declareRoute('post', '/user/create-password-level2', [tokenToUserMiddleware], UserHandle.createPasswordLevel2);
declareRoute('post', '/user/check-password-level2', [tokenToUserMiddleware], UserHandle.checkPasswordLevel2);

declareRoute('post', '/admin/user/list', [tokenToUserMiddleware, validPermissionMiddleware('user_list')], UserAdminHandle.list);
declareRoute('post', '/admin/user/create', [tokenToUserMiddleware, validPermissionMiddleware('user_create')], UserAdminHandle.create);
declareRoute('post', '/admin/user/update', [tokenToUserMiddleware, validPermissionMiddleware('user_update')], UserAdminHandle.update);
declareRoute('post', '/admin/user/inactive', [tokenToUserMiddleware, validPermissionMiddleware('user_delete')], UserAdminHandle.inactive);
declareRoute('post', '/admin/user/get', [tokenToUserMiddleware, validPermissionMiddleware('user_read')], UserAdminHandle.get);
declareRoute('post', '/admin/user/reset-password', [tokenToUserMiddleware, validPermissionMiddleware('user_reset_password')], UserAdminHandle.resetPassword);

// Permission Management Routes
declareRoute('post', '/admin/permission/list', [tokenToUserMiddleware, validPermissionMiddleware('permission_list')], PermissionAdminHandle.list);
declareRoute('post', '/admin/permission/create', [tokenToUserMiddleware, validPermissionMiddleware('permission_create')], PermissionAdminHandle.create);
declareRoute('post', '/admin/permission/update', [tokenToUserMiddleware, validPermissionMiddleware('permission_update')], PermissionAdminHandle.update);
declareRoute('post', '/admin/permission/delete', [tokenToUserMiddleware, validPermissionMiddleware('permission_delete')], PermissionAdminHandle.delete);
declareRoute('post', '/admin/permission/get', [tokenToUserMiddleware, validPermissionMiddleware('permission_read')], PermissionAdminHandle.get);
declareRoute('post', '/admin/permission/list-by-group', [tokenToUserMiddleware, validPermissionMiddleware('permission_list')], PermissionAdminHandle.listByGroup);
declareRoute('post', '/admin/permission/groups', [tokenToUserMiddleware, validPermissionMiddleware('permission_list')], PermissionAdminHandle.groups);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const port = _.get(config, 'port', 3000);
server.listen(port, () => {
  logger.logInfo('Server listening at port:', port);
});

process.on('uncaughtException', (err) => {
  logger.logError('uncaughtException', err);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.logError('Unhandled Rejection at:', promise, 'reason:', reason);
});

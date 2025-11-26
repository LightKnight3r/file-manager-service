const socketIo = require('socket.io');
const _ = require('lodash');
const User = require('../models/user');
const redisConnections = require('../connections/redis');

/**
 * Xác thực token từ Redis (tương tự logic trong tokenToUser middleware)
 * @param {String} token - Token cần xác thực
 * @param {String} appName - Tên app (optional)
 * @returns {Promise} Promise resolve với user object hoặc reject với error
 */
const verifyTokenFromRedis = (token, appName = '') => {
  return new Promise((resolve, reject) => {
    if (!token) {
      return reject(new Error('No token provided'));
    }

    let stringToken = 'user';
    if (appName && appName !== 'cms') {
      stringToken = appName;
    }

    console.log('[Socket] Verifying token:', token.substring(0, 50) + '...');

    redisConnections('master').getConnection().get(`${stringToken}:${token}`, (err, result) => {
      if (err) {
        console.error('[Socket] Redis error:', err);
        return reject(new Error('System error'));
      }

      if (!result) {
        return reject(new Error('Token expired or invalid'));
      }

      try {
        const objSign = JSON.parse(result);
        if (!_.has(objSign, 'id')) {
          return reject(new Error('Invalid token format'));
        }

        resolve(objSign);
      } catch (e) {
        console.error('[Socket] Token parse error:', e);
        reject(new Error('Token parse failed'));
      }
    });
  });
};

/**
 * Socket Manager cho hệ thống real-time notifications
 * Quản lý connections, rooms và gửi notifications
 */
class SocketManager {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socket info
    this.userRooms = new Map(); // userId -> Set of rooms
    this.roomUsers = new Map(); // roomName -> Set of userIds
  }

  /**
   * Khởi tạo Socket.IO server
   * @param {Object} server - HTTP server instance
   */
  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    console.log('[Socket] Socket.IO server initialized');
  }

  /**
   * Setup authentication middleware
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.query.token || socket.handshake.headers.token;
        const appName = socket.handshake.query.appName || socket.handshake.headers.appName || '';

        if (!token) {
          return next(new Error('No token provided'));
        }

        // Xác thực token từ Redis sử dụng logic tương tự tokenToUser middleware
        const userTokenData = await verifyTokenFromRedis(token, appName);

        if (!userTokenData || !userTokenData.id) {
          return next(new Error('Invalid token or user not found'));
        }

        // Lấy thông tin user từ database
        const user = await User.findById(userTokenData.id)
          .populate('units', 'name')
          .populate('areas', 'name')
          .populate('positions', 'name')
          .lean();

        if (!user || user.status !== 1) {
          return next(new Error('User not found or inactive'));
        }

        // Gán thông tin user vào socket
        socket.userId = user._id.toString();
        socket.user = user;
        socket.userTokenData = userTokenData; // Lưu thêm thông tin từ token (permissions, etc.)

        console.log(`[Socket] User authenticated: ${user.name} (${user._id})`);
        next();
      } catch (error) {
        console.error('[Socket] Authentication error:', error.message);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);

      socket.on('join_room', (data) => this.handleJoinRoom(socket, data));
      socket.on('leave_room', (data) => this.handleLeaveRoom(socket, data));
      socket.on('join_statistics_dashboard', () => this.handleJoinStatisticsDashboard(socket));
      socket.on('leave_statistics_dashboard', () => this.handleLeaveStatisticsDashboard(socket));
      socket.on('disconnect', () => this.handleDisconnection(socket));
    });
  }

  /**
   * Xử lý khi user connect
   * @param {Object} socket - Socket instance
   */
  handleConnection(socket) {
    const userId = socket.userId;
    const user = socket.user;

    // Lưu thông tin connection
    this.connectedUsers.set(userId, {
      socketId: socket.id,
      socket: socket,
      user: user,
      connectedAt: Date.now(),
      rooms: new Set()
    });

    // Auto join user vào room của đơn vị và khu vực
    this.autoJoinUserRooms(socket);

    console.log(`[Socket] User connected: ${user.name} (${userId})`);

    // Gửi welcome message
    socket.emit('connected', {
      message: 'Kết nối thành công',
      userId: userId,
      timestamp: Date.now()
    });
  }

  /**
   * Tự động join user vào các room dựa trên đơn vị và khu vực
   * @param {Object} socket - Socket instance
   */
  autoJoinUserRooms(socket) {
    const user = socket.user;
    const userId = socket.userId;

    // Join room theo đơn vị
    if (user.units && user.units.length > 0) {
      user.units.forEach(unit => {
        const roomName = `unit_${unit._id}`;
        this.joinRoom(socket, roomName);
      });
    }

    // Join room theo khu vực
    if (user.areas && user.areas.length > 0) {
      user.areas.forEach(area => {
        const roomName = `area_${area._id}`;
        this.joinRoom(socket, roomName);
      });
    }

    // Join room theo positions (nếu có quyền xem thống kê)
    if (user.positions && user.positions.length > 0) {
      user.positions.forEach(position => {
        const roomName = `position_${position._id}`;
        this.joinRoom(socket, roomName);
      });
    }

    // Join room chung cho tất cả users
    this.joinRoom(socket, 'all_users');
  }

  /**
   * Xử lý join room
   * @param {Object} socket - Socket instance
   * @param {Object} data - Room data
   */
  handleJoinRoom(socket, data) {
    const { roomName } = data;
    if (!roomName) return;

    this.joinRoom(socket, roomName);

    socket.emit('room_joined', {
      roomName,
      message: `Đã tham gia room: ${roomName}`,
      timestamp: Date.now()
    });
  }

  /**
   * Xử lý leave room
   * @param {Object} socket - Socket instance
   * @param {Object} data - Room data
   */
  handleLeaveRoom(socket, data) {
    const { roomName } = data;
    if (!roomName) return;

    this.leaveRoom(socket, roomName);

    socket.emit('room_left', {
      roomName,
      message: `Đã rời room: ${roomName}`,
      timestamp: Date.now()
    });
  }

  /**
   * Xử lý join statistics dashboard
   * @param {Object} socket - Socket instance
   */
  handleJoinStatisticsDashboard(socket) {
    this.joinRoom(socket, 'statistics_dashboard');

    // Join các room thống kê cụ thể
    const statisticsRooms = [
      'statistics_on_duty_officers',
      'statistics_attendance',
      'statistics_officer_summary',
      'statistics_officers_by_area'
    ];

    statisticsRooms.forEach(room => {
      this.joinRoom(socket, room);
    });

    socket.emit('statistics_dashboard_joined', {
      message: 'Đã tham gia dashboard thống kê',
      rooms: ['statistics_dashboard', ...statisticsRooms],
      timestamp: Date.now()
    });

    console.log(`[Socket] User ${socket.userId} joined statistics dashboard`);
  }

  /**
   * Xử lý leave statistics dashboard
   * @param {Object} socket - Socket instance
   */
  handleLeaveStatisticsDashboard(socket) {
    this.leaveRoom(socket, 'statistics_dashboard');

    const statisticsRooms = [
      'statistics_on_duty_officers',
      'statistics_attendance',
      'statistics_officer_summary',
      'statistics_officers_by_area'
    ];

    statisticsRooms.forEach(room => {
      this.leaveRoom(socket, room);
    });

    socket.emit('statistics_dashboard_left', {
      message: 'Đã rời dashboard thống kê',
      timestamp: Date.now()
    });
  }

  /**
   * Xử lý khi user disconnect
   * @param {Object} socket - Socket instance
   */
  handleDisconnection(socket) {
    const userId = socket.userId;

    if (userId && this.connectedUsers.has(userId)) {
      const userInfo = this.connectedUsers.get(userId);

      // Remove user từ tất cả rooms
      if (userInfo.rooms) {
        userInfo.rooms.forEach(roomName => {
          this.leaveRoom(socket, roomName, false);
        });
      }

      // Remove user khỏi connected users
      this.connectedUsers.delete(userId);

      console.log(`[Socket] User disconnected: ${userId}`);
    }
  }

  /**
   * Join user vào room
   * @param {Object} socket - Socket instance
   * @param {String} roomName - Tên room
   */
  joinRoom(socket, roomName) {
    const userId = socket.userId;

    socket.join(roomName);

    // Update user rooms
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId).rooms.add(roomName);
    }

    // Update room users
    if (!this.roomUsers.has(roomName)) {
      this.roomUsers.set(roomName, new Set());
    }
    this.roomUsers.get(roomName).add(userId);

    console.log(`[Socket] User ${userId} joined room: ${roomName}`);
  }

  /**
   * Remove user khỏi room
   * @param {Object} socket - Socket instance
   * @param {String} roomName - Tên room
   * @param {Boolean} emitLeave - Có emit leave event không
   */
  leaveRoom(socket, roomName, emitLeave = true) {
    const userId = socket.userId;

    if (emitLeave) {
      socket.leave(roomName);
    }

    // Update user rooms
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId).rooms.delete(roomName);
    }

    // Update room users
    if (this.roomUsers.has(roomName)) {
      this.roomUsers.get(roomName).delete(userId);

      // Remove room nếu không còn user nào
      if (this.roomUsers.get(roomName).size === 0) {
        this.roomUsers.delete(roomName);
      }
    }

    console.log(`[Socket] User ${userId} left room: ${roomName}`);
  }

  // ==================== NOTIFICATION METHODS ====================

  /**
   * Gửi notification cho một user cụ thể
   * @param {String} userId - User ID
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   */
  sendToUser(userId, eventName, data) {
    if (!this.connectedUsers.has(userId)) {
      console.warn(`[Socket] User ${userId} not connected`);
      return false;
    }

    const userInfo = this.connectedUsers.get(userId);
    userInfo.socket.emit(eventName, data);

    console.log(`[Socket] Sent to user ${userId}: ${eventName}`);
    return true;
  }

  /**
   * Gửi notification cho nhiều users
   * @param {Array} userIds - Mảng User IDs
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   */
  sendToMultipleUsers(userIds, eventName, data) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.warn('[Socket] No user IDs provided');
      return 0;
    }

    let sentCount = 0;
    userIds.forEach(userId => {
      if (this.sendToUser(userId, eventName, data)) {
        sentCount++;
      }
    });

    console.log(`[Socket] Sent to ${sentCount}/${userIds.length} users: ${eventName}`);
    return sentCount;
  }

  /**
   * Gửi notification cho một room
   * @param {String} roomName - Tên room
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   */
  sendToRoom(roomName, eventName, data) {
    if (!this.io) {
      console.error('[Socket] Socket.IO not initialized');
      return false;
    }

    this.io.to(roomName).emit(eventName, data);

    const userCount = this.roomUsers.get(roomName)?.size || 0;
    console.log(`[Socket] Sent to room ${roomName} (${userCount} users): ${eventName}`);
    return true;
  }

  /**
   * Gửi notification cho tất cả users
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   * @param {Object} filters - Bộ lọc (units, areas, permissions)
   */
  sendToAll(eventName, data, filters = {}) {
    if (!this.io) {
      console.error('[Socket] Socket.IO not initialized');
      return false;
    }

    if (Object.keys(filters).length === 0) {
      // Gửi cho tất cả users
      this.io.emit(eventName, data);
      console.log(`[Socket] Sent to all users: ${eventName}`);
    } else {
      // Gửi có filter
      const filteredUsers = this.getFilteredUsers(filters);
      this.sendToMultipleUsers(filteredUsers, eventName, data);
    }

    return true;
  }

  /**
   * Gửi notification cho users theo đơn vị
   * @param {Array} unitIds - Mảng Unit IDs
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   */
  sendToUnits(unitIds, eventName, data) {
    if (!Array.isArray(unitIds) || unitIds.length === 0) {
      console.warn('[Socket] No unit IDs provided');
      return 0;
    }

    let totalSent = 0;
    unitIds.forEach(unitId => {
      const roomName = `unit_${unitId}`;
      if (this.sendToRoom(roomName, eventName, data)) {
        totalSent += this.roomUsers.get(roomName)?.size || 0;
      }
    });

    console.log(`[Socket] Sent to ${unitIds.length} units (${totalSent} users): ${eventName}`);
    return totalSent;
  }

  /**
   * Gửi notification cho users theo khu vực
   * @param {Array} areaIds - Mảng Area IDs
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   */
  sendToAreas(areaIds, eventName, data) {
    if (!Array.isArray(areaIds) || areaIds.length === 0) {
      console.warn('[Socket] No area IDs provided');
      return 0;
    }

    let totalSent = 0;
    areaIds.forEach(areaId => {
      const roomName = `area_${areaId}`;
      if (this.sendToRoom(roomName, eventName, data)) {
        totalSent += this.roomUsers.get(roomName)?.size || 0;
      }
    });

    console.log(`[Socket] Sent to ${areaIds.length} areas (${totalSent} users): ${eventName}`);
    return totalSent;
  }

  /**
   * Lọc users theo điều kiện
   * @param {Object} filters - Bộ lọc
   * @returns {Array} Mảng user IDs
   */
  getFilteredUsers(filters) {
    const filteredUsers = [];

    this.connectedUsers.forEach((userInfo, userId) => {
      const user = userInfo.user;
      let shouldInclude = true;

      // Filter theo units
      if (filters.units && filters.units.length > 0) {
        const userUnitIds = user.units?.map(u => u._id.toString()) || [];
        const hasMatchingUnit = filters.units.some(unitId => userUnitIds.includes(unitId));
        if (!hasMatchingUnit) shouldInclude = false;
      }

      // Filter theo areas
      if (filters.areas && filters.areas.length > 0) {
        const userAreaIds = user.areas?.map(a => a._id.toString()) || [];
        const hasMatchingArea = filters.areas.some(areaId => userAreaIds.includes(areaId));
        if (!hasMatchingArea) shouldInclude = false;
      }

      // Filter theo permissions (cần implement permission check)
      if (filters.permissions && filters.permissions.length > 0) {
        // TODO: Implement permission check
        // const hasPermission = user.permissions?.some(p => filters.permissions.includes(p));
        // if (!hasPermission) shouldInclude = false;
      }

      if (shouldInclude) {
        filteredUsers.push(userId);
      }
    });

    return filteredUsers;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Lấy thông tin về connected users
   * @returns {Object} Thống kê users
   */
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      totalRooms: this.roomUsers.size,
      roomDetails: Array.from(this.roomUsers.entries()).map(([roomName, users]) => ({
        roomName,
        userCount: users.size
      }))
    };
  }

  /**
   * Lấy danh sách users trong room
   * @param {String} roomName - Tên room
   * @returns {Array} Danh sách user IDs
   */
  getUsersInRoom(roomName) {
    return Array.from(this.roomUsers.get(roomName) || []);
  }

  /**
   * Lấy danh sách rooms của user
   * @param {String} userId - User ID
   * @returns {Array} Danh sách room names
   */
  getUserRooms(userId) {
    const userInfo = this.connectedUsers.get(userId);
    return userInfo ? Array.from(userInfo.rooms) : [];
  }

  /**
   * Kiểm tra user có online không
   * @param {String} userId - User ID
   * @returns {Boolean}
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Disconnect user
   * @param {String} userId - User ID
   * @param {String} reason - Lý do disconnect
   */
  disconnectUser(userId, reason = 'Server disconnect') {
    if (this.connectedUsers.has(userId)) {
      const userInfo = this.connectedUsers.get(userId);
      userInfo.socket.emit('force_disconnect', { reason });
      userInfo.socket.disconnect(true);
      console.log(`[Socket] Force disconnected user ${userId}: ${reason}`);
    }
  }
}

module.exports = new SocketManager();

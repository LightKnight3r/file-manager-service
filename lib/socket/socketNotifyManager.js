const socketManager = require('./socketManager');
const statisticsService = require('../services/statisticsService');

/**
 * Socket Notify Manager
 * Wrapper để thay thế NotifyManager cũ với socket system mới
 * Tương thích với interface cũ nhưng sử dụng Socket.IO internal
 */
class SocketNotifyManager {

  /**
   * Mapping từ affectedTypes sang method tính toán thống kê tương ứng
   */
  getStatisticsMethodMapping() {
    return {
      'on_duty_officers': 'getOnDutyOfficers',
      'attendance': 'getAttendanceStats',
      'officer_summary': 'getOfficerSummaryStats',
      'officers_by_area': 'getOfficersByAreaStats',
      'reports_summary': 'getReportsSummaryStats',
      'reports_by_area': 'getReportsByAreaStats',
      'reports_status': 'getReportsStatusStats',
      'reports_incidents_highlight': 'getIncidentsHighlightStats',
      'reports_incidents_other': 'getIncidentsOtherStats',
      'latest_incidents': 'getLatestIncidents',
      'documents_summary': 'getDocumentsSummaryStats'
    };
  }

  /**
   * Gửi notification cho một user cụ thể
   * @param {String} userId - User ID
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   * @param {Array} platforms - Platforms (tương thích với API cũ)
   */
  sendViaSocket(userId, eventName, data, platforms = ['web', 'mobile']) {
    try {
      // Nếu userId là 'all', gửi cho tất cả
      if (userId === 'all') {
        return socketManager.sendToAll(eventName, data);
      }

      // Nếu là array userIds
      if (Array.isArray(userId)) {
        return socketManager.sendToMultipleUsers(userId, eventName, data);
      }

      // Gửi cho user cụ thể
      return socketManager.sendToUser(userId, eventName, data);

    } catch (error) {
      console.error('[SocketNotifyManager] Error in sendViaSocket:', error);
      return false;
    }
  }

  /**
   * Gửi notification cho nhiều users
   * @param {Array} userIds - Mảng User IDs
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   * @param {Array} platforms - Platforms
   */
  sendViaSocketToMultipleUsers(userIds, eventName, data, platforms = ['web', 'mobile']) {
    try {
      return socketManager.sendToMultipleUsers(userIds, eventName, data);
    } catch (error) {
      console.error('[SocketNotifyManager] Error in sendViaSocketToMultipleUsers:', error);
      return 0;
    }
  }

  /**
   * Gửi notification cho một room
   * @param {String} roomName - Tên room
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   * @param {Array} platforms - Platforms
   */
  sendViaSocketToRoom(roomName, eventName, data, platforms = ['web', 'mobile']) {
    try {
      return socketManager.sendToRoom(roomName, eventName, data);
    } catch (error) {
      console.error('[SocketNotifyManager] Error in sendViaSocketToRoom:', error);
      return false;
    }
  }

  /**
   * Gửi notification cho tất cả users
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   * @param {Array} platforms - Platforms
   * @param {Object} filters - Bộ lọc
   */
  sendViaSocketToAll(eventName, data, platforms = ['web', 'mobile'], filters = {}) {
    try {
      return socketManager.sendToAll(eventName, data, filters);
    } catch (error) {
      console.error('[SocketNotifyManager] Error in sendViaSocketToAll:', error);
      return false;
    }
  }

  /**
   * Gửi notification cho users theo đơn vị
   * @param {Array} unitIds - Mảng Unit IDs
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   * @param {Array} platforms - Platforms
   */
  sendViaSocketToUnits(unitIds, eventName, data, platforms = ['web', 'mobile']) {
    try {
      return socketManager.sendToUnits(unitIds, eventName, data);
    } catch (error) {
      console.error('[SocketNotifyManager] Error in sendViaSocketToUnits:', error);
      return 0;
    }
  }

  /**
   * Gửi notification cho users theo khu vực
   * @param {Array} areaIds - Mảng Area IDs
   * @param {String} eventName - Tên event
   * @param {Object} data - Dữ liệu gửi kèm
   * @param {Array} platforms - Platforms
   */
  sendViaSocketToAreas(areaIds, eventName, data, platforms = ['web', 'mobile']) {
    try {
      return socketManager.sendToAreas(areaIds, eventName, data);
    } catch (error) {
      console.error('[SocketNotifyManager] Error in sendViaSocketToAreas:', error);
      return 0;
    }
  }

  // ==================== STATISTICS SPECIFIC METHODS ====================

  /**
   * Gửi notification khi thống kê được cập nhật
   * Tính toán và gửi kèm dữ liệu thống kê đầy đủ cho client
   * @param {Array} affectedTypes - Các loại thống kê bị ảnh hưởng
   * @param {Array} events - Danh sách events
   */
  async sendStatisticsUpdated(affectedTypes, events = []) {
    try {
      console.log(`[SocketNotifyManager] Starting statistics calculation for: ${affectedTypes.join(', ')}`);

      // Tính toán dữ liệu thống kê cho từng loại bị ảnh hưởng
      const statisticsData = await this.calculateStatisticsData(affectedTypes);

      // Tạo notification data với dữ liệu thống kê đầy đủ
      const notificationData = {
        types: affectedTypes,
        timestamp: Date.now(),
        eventCount: events.length,
        message: `Dữ liệu thống kê đã được cập nhật: ${affectedTypes.join(', ')}`,
        statistics: statisticsData.success ? statisticsData.data : null,
        calculationSuccess: statisticsData.success,
        calculationErrors: statisticsData.errors || []
      };

      // Gửi cho room statistics dashboard với dữ liệu đầy đủ
      socketManager.sendToRoom('statistics_dashboard', 'statistics_updated', notificationData);

      // Gửi cho từng loại thống kê cụ thể với dữ liệu riêng biệt
      affectedTypes.forEach(type => {
        const typeSpecificData = {
          type,
          timestamp: Date.now(),
          data: statisticsData.success && statisticsData.data[type] ? statisticsData.data[type] : null,
          success: statisticsData.success && statisticsData.data[type] !== undefined,
          error: statisticsData.errors && statisticsData.errors[type] ? statisticsData.errors[type] : null
        };

        socketManager.sendToRoom(`statistics_${type}`, 'statistics_type_updated', typeSpecificData);
      });

      // Gửi cho tất cả users có quyền xem thống kê
      socketManager.sendToAll('statistics_updated', notificationData, {
        permissions: ['xem-thong-ke', 'quan-ly-thong-ke']
      });

      console.log(`[SocketNotifyManager] Sent statistics updates for: ${affectedTypes.join(', ')}`);
      console.log(`[SocketNotifyManager] Calculation success: ${statisticsData.success}`);

      return true;

    } catch (error) {
      console.error('[SocketNotifyManager] Error sending statistics updates:', error);

      // Fallback: gửi notification cơ bản nếu có lỗi
      try {
        const fallbackData = {
          types: affectedTypes,
          timestamp: Date.now(),
          eventCount: events.length,
          message: `Dữ liệu thống kê đã được cập nhật: ${affectedTypes.join(', ')}`,
          statistics: null,
          calculationSuccess: false,
          error: error.message
        };

        socketManager.sendToAll('statistics_updated', fallbackData, {
          permissions: ['xem-thong-ke', 'quan-ly-thong-ke']
        });

        console.log('[SocketNotifyManager] Sent fallback notification');
      } catch (fallbackError) {
        console.error('[SocketNotifyManager] Error sending fallback notification:', fallbackError);
      }

      return false;
    }
  }

  /**
   * Tính toán dữ liệu thống kê với tùy chọn timeRange và cache
   * @param {Array} affectedTypes - Các loại thống kê cần tính toán
   * @param {Object} options - Tùy chọn tính toán
   * @param {String} options.timeRange - Khoảng thời gian: 'day', 'week', 'month'
   * @param {Boolean} options.useCache - Có sử dụng cache không
   * @returns {Object} Kết quả tính toán
   */
  async calculateStatisticsData(affectedTypes, options = {}) {
    const { timeRange = 'day', useCache = false } = options;

    try {
      const methodMapping = this.getStatisticsMethodMapping();
      const results = {};
      const errors = {};
      let hasErrors = false;

      // Tính toán song song cho tất cả các loại thống kê
      const calculations = affectedTypes.map(async (type) => {
        try {
          const methodName = methodMapping[type];
          if (!methodName || !statisticsService[methodName]) {
            throw new Error(`Method không hợp lệ cho loại thống kê: ${type}`);
          }

          console.log(`[SocketNotifyManager] Calculating ${type} with timeRange: ${timeRange}...`);

          const result = await statisticsService[methodName]({
            timeRange,
            useCache
          });

          if (result?.success && result.data) {
            results[type] = {
              ...result.data,
              calculatedAt: Date.now(),
              timeRange,
              type
            };
            console.log(`[SocketNotifyManager] Successfully calculated ${type} for ${timeRange}`);
          } else {
            throw new Error(result?.message?.body || `Lỗi khi tính toán ${type}`);
          }

        } catch (error) {
          console.error(`[SocketNotifyManager] Error calculating ${type}:`, error);
          errors[type] = {
            message: error.message,
            timestamp: Date.now(),
            timeRange
          };
          hasErrors = true;
        }
      });

      await Promise.all(calculations);

      return {
        success: !hasErrors || Object.keys(results).length > 0,
        data: results,
        errors: hasErrors ? errors : null,
        calculatedTypes: Object.keys(results),
        failedTypes: Object.keys(errors),
        timeRange,
        calculatedAt: Date.now()
      };

    } catch (error) {
      console.error('[SocketNotifyManager] Error in calculateStatisticsData:', error);
      return {
        success: false,
        data: {},
        errors: { general: { message: error.message, timestamp: Date.now() } },
        calculatedTypes: [],
        failedTypes: affectedTypes,
        timeRange,
        calculatedAt: Date.now()
      };
    }
  }

  /**
   * Gửi notification cho dashboard real-time
   * @param {String} dashboardType - Loại dashboard
   * @param {Object} data - Dữ liệu dashboard
   */
  async sendDashboardUpdate(dashboardType, data) {
    try {
      const notificationData = {
        dashboardType,
        data,
        timestamp: Date.now()
      };

      // Gửi cho room dashboard cụ thể
      socketManager.sendToRoom(`dashboard_${dashboardType}`, 'dashboard_updated', notificationData);

      // Gửi cho room dashboard chung
      socketManager.sendToRoom('main_dashboard', 'dashboard_updated', notificationData);

      console.log(`[SocketNotifyManager] Sent dashboard update: ${dashboardType}`);
      return true;

    } catch (error) {
      console.error('[SocketNotifyManager] Error sending dashboard update:', error);
      return false;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Lấy thống kê socket connections
   * @returns {Object} Thống kê
   */
  getSocketStats() {
    return socketManager.getStats();
  }

  /**
   * Lấy danh sách users trong room
   * @param {String} roomName - Tên room
   * @returns {Array} Danh sách user IDs
   */
  getUsersInRoom(roomName) {
    return socketManager.getUsersInRoom(roomName);
  }

  /**
   * Kiểm tra user có online không
   * @param {String} userId - User ID
   * @returns {Boolean}
   */
  isUserOnline(userId) {
    return socketManager.isUserOnline(userId);
  }

  /**
   * Disconnect user
   * @param {String} userId - User ID
   * @param {String} reason - Lý do
   */
  disconnectUser(userId, reason) {
    return socketManager.disconnectUser(userId, reason);
  }

  /**
   * Gửi system notification
   * @param {String} type - Loại notification
   * @param {String} message - Nội dung
   * @param {Object} options - Tùy chọn
   */
  async sendSystemNotification(type, message, options = {}) {
    try {
      const notificationData = {
        type,
        message,
        timestamp: Date.now(),
        priority: options.priority || 'normal',
        ...options.data
      };

      // Gửi theo target
      if (options.target === 'all') {
        socketManager.sendToAll('system_notification', notificationData);
      } else if (options.target === 'admins') {
        socketManager.sendToAll('system_notification', notificationData, {
          permissions: ['admin', 'super-admin']
        });
      } else if (options.target && Array.isArray(options.target)) {
        socketManager.sendToMultipleUsers(options.target, 'system_notification', notificationData);
      } else if (options.room) {
        socketManager.sendToRoom(options.room, 'system_notification', notificationData);
      }

      console.log(`[SocketNotifyManager] Sent system notification: ${type}`);
      return true;

    } catch (error) {
      console.error('[SocketNotifyManager] Error sending system notification:', error);
      return false;
    }
  }

  /**
   * Broadcast emergency notification
   * @param {String} message - Nội dung khẩn cấp
   * @param {Object} data - Dữ liệu kèm theo
   */
  async broadcastEmergency(message, data = {}) {
    try {
      const emergencyData = {
        type: 'emergency',
        message,
        timestamp: Date.now(),
        priority: 'high',
        ...data
      };

      // Gửi cho tất cả users
      socketManager.sendToAll('emergency_notification', emergencyData);

      console.log(`[SocketNotifyManager] Broadcast emergency: ${message}`);
      return true;

    } catch (error) {
      console.error('[SocketNotifyManager] Error broadcasting emergency:', error);
      return false;
    }
  }
}

module.exports = new SocketNotifyManager();

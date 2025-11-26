module.exports = {
  CODE: {
    SUCCESS: 200,
    FAIL: 300,
    WRONG_PARAMS: 400,
    ACCESS_DENINED: 403,
    SYSTEM_ERROR: 500,
    TOKEN_EXPIRE: 1993,
    ORDER_EXPIRE: 1999,
    ROLE_BLOCK: 403,
  },
  USER_STATUS: {
    INACTIVE: 0,
    ACTIVE: 1,
  },
  USER_ROLES: {
    USER: 'user',
    ADMIN: 'admin',
  },
  ORDER_STATUS: {
    WAIT_FOR_CONFIRM: -1, // Chờ xác nhận
    FINDING: 0, // Đang tìm thợ
    FOUND_WORKER: 1, // Đã nhận
    MOVING: 2, // Đang di chuyển
    CHECKING: 3, // Đang thỏa thuận
    WORKING: 4, // Đang làm việc
    COMPLETED: 5, // Hoàn thành
    CANCELLED: 6, // đã hủy
    CANNOT_FIND_WORKER: 7, // Không tìm được thợ
  },
  ORDER_HIREDRIVER_STATUS: {
    WAIT_FOR_CREATE: -2,
    WAIT_FOR_PAYMENT: -1,
    FINDING_DRIVER: 0,
    FOUND_DRIVER: 1,
    DRIVING: 2,
    DONE: 3,
    CAN_NOT_FIND_DRIVER: 4,
    REJECT: 5,
    CAN_NOT_TAKE_ORDER: 6,
    RETURNING: 7,
    RETURN_DONE: 8,
  },
  PRICE_STATUS: {
    NONE: 0, // Chưa báo giá
    WAITING_CUSTOMER_ACCEPT: 1, // Đã báo giá, chờ khách hàng duyệt
    CUSTOMER_ACCEPTED: 2, // Khách hàng đã duyệt
    CUSTOMER_REJECTED: 3, // Khách hàng đã từ chối
  },
  ORDER_LOG: {
    CONFIRM: -1,
    CREATE: 0,
    ACCEPT: 1,
    START_MOVING: 2,
    START_CHECKING: 3,
    START_WORKING: 4,
    COMPLETE: 5,
    CANCEL: 6,
    CANNOT_FIND_WORKER: 7,
    RETRY: 8,
    UPDATE_INFO: 9,
    ASSIGN_WORKER: 10,
    SWITCH_WORKER: 11,
    SWITCH_LEADER: 12,
  },
  CONFIG_TYPE: {
    CREATE_ORDER: 1,
    BOOK_ORDER: 3,
    CONTACT: 4,
    ADMIN_AUTHEN_ONLINE: 5,
    WARNING_AUTHEN: 6,
    POINT: 7,
    MIN_MONEY: 8,
    MAX_SERVICE_CHARGE: 9,
    PAYMENT_METHOD: 10,
    PAYMENT_INAPP: 11,
    TIME_ACCEPT_ORDER: 12,
    HOTLINE: 13,
    AUTHEN: 14,
    REMOVE_ACCOUNT: 15,
    BENEFIT_MERCHANT: 23
  },
  TRANSACTION_TYPE: {
    TOPUP: 1,
    SERVICE_CHARGE: 2,
  },
  WORKER_AUTHEN_STATUS: {
    WAIT_FOR_APPROVE: 0, // Đang chờ duyệt
    APPROVED: 1, // Đã xác thực
    REJECTED: -1, // Bị từ chối
    NOT_SUBMITTED: -2, // Chưa thực hiện
  },
  WORKER_AUTHEN_STEP: {
    START: 0, // Bắt đầu
    INFORMATION: 1, // Thông tin cá nhân
    TRAINING: 2, // Đào tạo
    FINISH: 3, // Hoàn thành
  },
  JOB_TYPE: {
    CONFIRM_ORDER: 1, // Schema Order status = WAIT_FOR_CONFIRM
    COORDINATION_ORDER: 2, // Schema Order status = FINDING
    MOVE_REMIDER: 3, // Schema Order status = FOUND_WORKER and acceptInf.time + 15 minutes || status = MOVING and startMovingInf.time + 30 minutes
    DEALING_REMIDER: 4, // Schema Order status = CHECKING and startCheckingInf.time + 30 minutes
    DONE_REMIDER: 5, // Schema Order status = WORKING and startWorkingInf.time + estimatedTime
    CONTACT_REMIDER: 6, // Schema Order status = FOUND_WORKER + !hasCalled && !hasMessage && !customerHasCalled
    CANCEL_CARE: 7, // Schema Order status = CANCELLED
    NOT_FOUND_CARE: 8, //Schema Order status = CANNOT_FIND_WORKER
    FIRST_ORDER_CARE_FOR_WORKER: 9, // Schema Order status = FOUND_WORKER for first order of worker
    FIRST_PROMOTE_CARE_FOR_WORKER: 10, // Schema Order status = FOUND_WORKER + promote $ne null for first promote of worker
    FEEDBACK: 11, // Schema Feedback
    RATING_ORDER: 12, // Schema Rating Order approved = 0
    HIRE_DRIVER_NEED_CONTACT: 13, // Schema Order Hire Driver status = FOUND_DRIVER !hasCalled || !hasMessage || !customerHasCalled || !customerHasMessage
    HIRE_DRIVER_NEED_MOVING: 14, // Schema Order Hire Driver status = FOUND_DRIVER  && takeOrderInf.time + 30 minutes
    HIRE_DRIVER_NEED_DONE: 15, // Schema Order Hire Driver status = DRIVING && takeOrderInf.time + 150 minutes
    HIRE_DRIVER_CANCEL_CARE: 16, // Schema Order Hire Driver status = REJECT
    HIRE_DRIVER_NOT_FOUND_CARE: 17, // Schema Order Hire Driver status = CAN_NOT_FIND_DRIVER
    HIRE_DRIVER_FIRST_ORDER_CARE: 18, // Schema Rating Hire Driver approved = 0
    FIRST_PROMOTE_CARE_FOR_DRIVER: 19, // Schema Order status = FOUND_DRIVER + promote $ne null for first promote of driver
    HIRE_DRIVER_RATING: 20, // Schema Rating Hire Driver approved = 0
  },
  JOB_STATUS: {
    REJECTED: -1,
    PENDING: 0,
    PROCESSING: 1,
    COMPLETED: 2,
    FAILED: 3,
  },
  JOB_ACTION: {
    REGISTER: 'REGISTER', // Đăng ký công việc mới
    RE_REGISTER: 'RE_REGISTER', // Đăng ký lại công việc đã bị reject
    PENDING: 'PENDING', // Chuyển sang trạng thái chờ
    COMPLETE_JOB: 'COMPLETE_JOB', // Hoàn thành công việc
    REJECT: 'REJECT', // Từ chối/Hủy đăng ký công việc
    FAIL_JOB: 'FAIL_JOB', // Đánh dấu công việc thất bại
    NOTE: 'NOTE', // Thêm ghi chú cho công việc
  },
  JOB_LOG_ACTION: {
    REGISTER: 'Đăng ký công việc',
    RE_REGISTER: 'Đăng ký lại công việc',
    PENDING: 'Chuyển sang trạng thái chờ',
    UPDATE_STATUS: 'Cập nhật trạng thái',
    COMPLETE_JOB: 'Hoàn thành công việc',
    REJECT: 'Từ chối công việc',
    FAIL_JOB: 'Hủy công việc',
    NOTE: 'Thêm ghi chú',
  },
  FEEDBACK_STATUS: {
    NEW: 0,
    RESOLVED: 1,
  },
  RATING_STATUS: {
    NEW: 0,
    RESOLVED: 1,
  },
};

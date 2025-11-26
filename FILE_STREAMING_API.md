# File Streaming API

## Mô tả
API này cho phép stream nội dung file trực tiếp từ server mà không cần tải về máy. File sẽ được hiển thị inline trong trình duyệt.

## Endpoints

### 1. Stream File (Phiên bản đầy đủ)
```
GET /api/v1.0/files/:id/view
```

**Mô tả**: Stream file với xử lý lỗi đầy đủ và kiểm tra quyền truy cập chi tiết.

**Headers yêu cầu**:
- `Authorization: Bearer <token>`

**Middleware**:
- `tokenToUserMiddleware`: Xác thực user từ token
- `requireLevel2Verified`: Yêu cầu xác thực cấp 2
- `validPermissionMiddleware('CRUD-folder-file')`: Kiểm tra quyền CRUD file/folder

**Response**:
- **200**: Stream file thành công
- **404**: File không tồn tại
- **403**: Không có quyền truy cập
- **500**: Lỗi server

### 2. Simple Stream File (Phiên bản đơn giản)
```
GET /api/v1.0/files/:id/simple-view
```

**Mô tả**: Phiên bản đơn giản hóa của API stream file, tương tự như ví dụ bạn cung cấp.

**Headers tương tự như trên**

## Cách sử dụng

### 1. Trong trình duyệt
```html
<!-- Hiển thị ảnh -->
<img src="/api/v1.0/files/file_id_here/view" alt="Image" />

<!-- Hiển thị PDF trong iframe -->
<iframe src="/api/v1.0/files/pdf_file_id/view"></iframe>

<!-- Video player -->
<video controls>
  <source src="/api/v1.0/files/video_file_id/view" type="video/mp4">
</video>
```

### 2. Download programmatically
```javascript
// Sử dụng fetch để lấy file
fetch('/api/v1.0/files/file_id/view', {
  headers: {
    'Authorization': 'Bearer your_token_here'
  }
})
.then(response => response.blob())
.then(blob => {
  // Xử lý blob data
  const url = URL.createObjectURL(blob);
  // Có thể mở trong tab mới hoặc gán cho element
});
```

### 3. Curl command
```bash
curl -H "Authorization: Bearer your_token" \
     "http://localhost:3000/api/v1.0/files/file_id/view" \
     -o downloaded_file.ext
```

## Tính năng

### Bảo mật
- Xác thực user qua token JWT
- Yêu cầu xác thực cấp 2 (level 2 password)
- Kiểm tra quyền truy cập file/folder
- Kiểm tra quyền owner hoặc accessUsers

### File Handling
- Tự động detect MIME type
- Support nhiều loại file: PDF, Word, Excel, PowerPoint, Images, Videos, Audio
- Stream file thay vì load toàn bộ vào memory
- Xử lý lỗi file không tồn tại hoặc bị lỗi

### Response Headers
- `Content-Type`: MIME type của file
- `Content-Disposition`: Luôn set là "inline" để hiển thị trong trình duyệt

## Cấu trúc thư mục files
```
public/
  uploads/
    folder_id_1/
      file1.pdf
      file2.jpg
    folder_id_2/
      file3.docx
```

## Models liên quan

### File Model
- `name`: Tên file gốc
- `ownerId`: ID của user sở hữu
- `folderId`: ID của folder chứa file
- `url`: Đường dẫn relative (/uploads/folder_id/filename)
- `mimeType`: MIME type của file
- `size`: Kích thước file
- `accessUsers`: Array các user ID có quyền truy cập

### Folder Model
- `ownerId`: ID của user sở hữu
- `accessUsers`: Array các user ID có quyền truy cập

## Utility Functions

### `getFileStream(filePath)`
Tạo read stream cho file tại đường dẫn cho trước.

### `canViewFile(user, file)`
Kiểm tra xem user có quyền xem file hay không.

### `getMimeType(filename)`  
Lấy MIME type dựa trên extension của file.

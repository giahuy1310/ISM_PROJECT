import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const globalPool = globalThis as typeof globalThis & {
  __ismDbPool?: mysql.Pool;
};
// Đọc file chứng chỉ SSL (ca.pem) từ thư mục gốc của project
// process.cwd() giúp Next.js luôn tìm đúng thư mục gốc dù chạy ở môi trường nào
const sslCertPath = path.join(process.cwd(), 'ca.pem');

const pool =
  globalPool.__ismDbPool ??
  mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT ?? 1),
    timezone: '+00:00',
    // Thêm cấu hình SSL bắt buộc cho Aiven
    ssl: {
      ca: fs.readFileSync(sslCertPath),
      // Bỏ qua cảnh báo xác thực (giúp tránh lỗi khi chạy localhost nối lên cloud)
      rejectUnauthorized: false 
    },
  });

if (!globalPool.__ismDbPool) {
  globalPool.__ismDbPool = pool;
}

export default pool;
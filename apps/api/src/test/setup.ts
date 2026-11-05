process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://smartcampus:smartcampus@localhost:5432/smart_campus_test?schema=public';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-change-me-min-32-chars';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-change-me-min-32!!';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

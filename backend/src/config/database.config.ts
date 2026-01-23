import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function getTypeOrmConfig(): TypeOrmModuleOptions {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set in .env file. Please configure your database connection.\n' +
      'Example: DATABASE_URL=postgresql://user:password@localhost:5432/time_tracker'
    );
  }

  return {
    type: 'postgres',
    url: databaseUrl,
    autoLoadEntities: true,
    synchronize: true, // dev only; disable in production
    ssl: databaseUrl.includes('amazonaws.com') || databaseUrl.includes('supabase') || databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false } 
      : false,
    logging: true, // Enable database query logging
    retryAttempts: 3,
    retryDelay: 3000,
  };
}

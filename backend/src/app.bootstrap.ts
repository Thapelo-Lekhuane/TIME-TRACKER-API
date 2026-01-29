import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './modules/users/users.service';
import { EventTypesService } from './modules/event-types/event-types.service';
import { LeaveService } from './modules/leave/leave.service';

const logger = new Logger('Bootstrap');

export async function bootstrapAdmin(app: INestApplication) {
  try {
    const config = app.get(ConfigService);
    const usersService = app.get(UsersService);
    const eventTypesService = app.get(EventTypesService);
    const leaveService = app.get(LeaveService);

    const email = config.get<string>('admin.email');
    const password = config.get<string>('admin.password');
    const timeZone =
      config.get<string>('admin.timeZone') ?? 'Africa/Johannesburg';

    if (!email || !password) {
      logger.warn('Admin credentials not found in .env file. Skipping admin creation.');
      logger.warn('Please set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file.');
      return;
    }

    logger.log(`Creating admin user with email: ${email}`);
    const admin = await usersService.createAdmin(email, password, timeZone);
    logger.log(`Admin user ${admin.email} created successfully`);

    logger.log('Seeding default event types...');
    await eventTypesService.seedDefaultEventTypes();
    logger.log('Default event types seeded successfully');

    logger.log('Seeding default leave types...');
    await leaveService.seedDefaultLeaveTypes();
    logger.log('Default leave types seeded successfully');
  } catch (error) {
    logger.error('Error during bootstrap:', error);
    throw error;
  }
}

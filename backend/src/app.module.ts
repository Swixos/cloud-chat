import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { RocketchatModule } from './rocketchat/rocketchat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RocketchatModule,
    AuthModule,
    ChatModule,
  ],
})
export class AppModule {}

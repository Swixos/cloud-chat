import { Module, Global } from '@nestjs/common';
import { RocketchatService } from './rocketchat.service';

@Global()
@Module({
  providers: [RocketchatService],
  exports: [RocketchatService],
})
export class RocketchatModule {}

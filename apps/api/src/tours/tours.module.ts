import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminToursController } from './admin-tours.controller.js';
import { TourVersion } from './tour.entity.js';
import { ToursController } from './tours.controller.js';
import { ToursService } from './tours.service.js';
import { UserTourState } from './user-tour-state.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([TourVersion, UserTourState])],
  controllers: [ToursController, AdminToursController],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}

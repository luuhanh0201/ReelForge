import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from '../media/media.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TtsModule } from '../tts/tts.module.js';
import { RenderConfigService } from './render-config.service.js';
import { Render } from './render.entity.js';
import { RendersController } from './renders.controller.js';
import { RendersService } from './renders.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Render]),
    ProjectsModule,
    MediaModule,
    TtsModule,
  ],
  controllers: [RendersController],
  providers: [RendersService, RenderConfigService],
  exports: [RendersService],
})
export class RendersModule {}

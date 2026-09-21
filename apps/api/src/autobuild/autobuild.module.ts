import { Module } from '@nestjs/common';
import { AiModelsModule } from '../ai-models/ai-models.module.js';
import { CrawlerModule } from '../crawler/crawler.module.js';
import { MediaModule } from '../media/media.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TtsModule } from '../tts/tts.module.js';
import { VoicesModule } from '../voices/voices.module.js';
import { AutobuildController } from './autobuild.controller.js';
import { AutobuildService } from './autobuild.service.js';
import { SCRIPT_PROVIDER, TemplateScriptProvider } from './script-provider.js';

/**
 * Dựng video tự động — tầng điều phối, không sở hữu dữ liệu nào của riêng mình.
 *
 * `SCRIPT_PROVIDER` là chỗ đổi bộ sinh kịch bản: thay `TemplateScriptProvider` bằng bản
 * dùng LLM là xong, không đụng tới service điều phối.
 */
@Module({
  imports: [
    ProjectsModule,
    MediaModule,
    CrawlerModule,
    VoicesModule,
    TtsModule,
    AiModelsModule,
  ],
  controllers: [AutobuildController],
  providers: [
    AutobuildService,
    TemplateScriptProvider,
    { provide: SCRIPT_PROVIDER, useExisting: TemplateScriptProvider },
  ],
})
export class AutobuildModule {}

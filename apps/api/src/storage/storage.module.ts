import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';

/** Global vì media, TTS và render đều cần đẩy file lên cùng một nơi. */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}

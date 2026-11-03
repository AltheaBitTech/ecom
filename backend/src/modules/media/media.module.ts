import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { MediaController, StorefrontMediaController } from './media.controller';
import { MediaStorageService } from './media-storage.service';
import { MediaService } from './media.service';

@Module({ imports: [BillingModule], controllers: [MediaController, StorefrontMediaController], providers: [MediaStorageService, MediaService], exports: [MediaService] })
export class MediaModule {}

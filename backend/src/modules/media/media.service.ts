import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { MediaStatus } from '@prisma/client';

import { AppException } from '../../common/errors/app-exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import type { CompleteMediaUploadDto, CreateMediaUploadDto } from './dto/media.dto';
import { MediaStorageService } from './media-storage.service';

@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService, private readonly billing: BillingService, private readonly storage: MediaStorageService) {}

  async list(tenantId: string) {
    const assets = await this.prisma.forTenant(tenantId, (tx) => tx.mediaAsset.findMany({ where: { status: { not: MediaStatus.ARCHIVED } }, orderBy: { createdAt: 'desc' } }));
    return Promise.all(assets.map((asset) => this.view(asset, asset.status === MediaStatus.READY ? this.storage.downloadUrl(asset.objectKey) : undefined)));
  }

  async createUpload(tenantId: string, dto: CreateMediaUploadDto) {
    const used = await this.prisma.forTenant(tenantId, (tx) => tx.mediaAsset.aggregate({ where: { status: { not: MediaStatus.ARCHIVED } }, _sum: { sizeBytes: true } }));
    const limit = await this.billing.limitFor(tenantId, 'mediaBytes');
    if (limit !== -1 && (used._sum.sizeBytes ?? 0) + dto.size_bytes > limit) throw AppException.limitExceeded('Your media storage limit has been reached');

    const extension = dto.mime_type === 'image/jpeg' ? 'jpg' : dto.mime_type.split('/')[1];
    const objectKey = `tenants/${tenantId}/storefront/${randomUUID()}.${extension}`;
    const asset = await this.prisma.forTenant(tenantId, (tx) => tx.mediaAsset.create({ data: {
      tenantId, objectKey, filename: dto.filename.trim(), mimeType: dto.mime_type, sizeBytes: dto.size_bytes, altText: dto.alt_text?.trim() || null,
    } }));
    return { asset: await this.view(asset), upload_url: await this.storage.uploadUrl(objectKey, dto.mime_type), expires_in: 900 };
  }

  async complete(tenantId: string, id: string, dto: CompleteMediaUploadDto) {
    const asset = await this.prisma.forTenant(tenantId, (tx) => tx.mediaAsset.findUnique({ where: { id } }));
    if (!asset || asset.status === MediaStatus.ARCHIVED) throw AppException.notFound('Media asset not found');
    await this.storage.verify(asset.objectKey, asset.sizeBytes, asset.mimeType);
    const ready = await this.prisma.forTenant(tenantId, (tx) => tx.mediaAsset.update({ where: { id }, data: { status: MediaStatus.READY, width: dto.width, height: dto.height } }));
    return this.view(ready, this.storage.downloadUrl(ready.objectKey));
  }

  async archive(tenantId: string, id: string) {
    const [asset, settings] = await this.prisma.forTenant(tenantId, (tx) => Promise.all([
      tx.mediaAsset.findUnique({ where: { id } }), tx.tenantSettings.findUnique({ where: { tenantId } }),
    ]));
    if (!asset) throw AppException.notFound('Media asset not found');
    if (JSON.stringify(settings?.theme).includes(id) || JSON.stringify(settings?.draftTheme).includes(id)) throw AppException.conflict('media_in_use', 'Remove this image from the draft and published design before deleting it');
    await this.prisma.forTenant(tenantId, (tx) => tx.mediaAsset.update({ where: { id }, data: { status: MediaStatus.ARCHIVED } }));
  }

  async deliveryUrl(tenantId: string, id: string) {
    const asset = await this.prisma.forTenant(tenantId, (tx) => tx.mediaAsset.findUnique({ where: { id } }));
    if (!asset || asset.status !== MediaStatus.READY) throw AppException.notFound('Media asset not found');
    return this.storage.downloadUrl(asset.objectKey);
  }

  private async view(asset: { id: string; filename: string; mimeType: string; sizeBytes: number; altText: string | null; width: number | null; height: number | null; status: MediaStatus; createdAt: Date }, url?: Promise<string>) {
    return { id: asset.id, filename: asset.filename, mime_type: asset.mimeType, size_bytes: asset.sizeBytes, alt_text: asset.altText, width: asset.width, height: asset.height, status: asset.status, created_at: asset.createdAt.toISOString(), url: url ? await url : null };
  }
}

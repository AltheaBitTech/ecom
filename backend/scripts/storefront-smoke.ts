/** Local integration check in a disposable tenant. Run with --keep for browser QA, then --cleanup. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Product } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StorefrontService } from '../src/modules/storefront/storefront.service';
import { settingsSchema } from '../src/modules/storefront/storefront.schemas';
import { PERMISSIONS } from '../src/modules/roles/permissions.catalog';
const sessionFile = join(tmpdir(), 'storefront-smoke-session.json');
const prisma = new PrismaService();
async function main() {
  assert(['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL!).hostname), 'Local databases only');
  if (process.argv.includes('--cleanup')) {
    const saved = JSON.parse(readFileSync(sessionFile,'utf8')) as { tenantId:string };
    await prisma.tenant.deleteMany({where:{id:saved.tenantId,slug:{startsWith:'storefront-smoke-'}}});
    unlinkSync(sessionFile); console.log('Removed test tenant and session'); return;
  }
  const slug = `storefront-smoke-${randomUUID()}`;
  const tenant = await prisma.tenant.create({data:{name:'Oven Grains · Preview',slug,status:'ACTIVE',storefront:settingsSchema.parse({headline:'A little joy, fresh from the oven.',tagline:'The everyday bakery collection',description:'From your first morning bite to a well-earned afternoon treat. Discover something delicious, made for the little moments.',announcement:'A little treat for you · Explore our current offers',shippingCents:5000,freeShippingThresholdCents:50000,supportEmail:'hello@example.invalid',address:'Test pickup address',pickupEnabled:true})}});
  try {
    const user=await prisma.user.create({data:{tenantId:tenant.id,email:`${slug}@example.invalid`}});
    const role=await prisma.role.create({data:{tenantId:tenant.id,name:'Test owner',permissions:Object.values(PERMISSIONS)}});
    await prisma.userRole.create({data:{userId:user.id,roleId:role.id}});
    const sources=await prisma.product.findMany({where:{tenant:{slug:process.env.STOREFRONT_TENANT_SLUG}},take:8,orderBy:{createdAt:'asc'}});
    const products: Product[]=[];
    for(let i=0;i<8;i++) products.push(await prisma.product.create({data:{tenantId:tenant.id,sku:`TEST-${i}`,name:sources[i]?.name ?? `Bakery favourite ${i+1}`,description:'A thoughtfully made favourite for your everyday moments.',imageUrl:sources[i]?.imageUrl,images:sources[i]?.imageUrl?[sources[i].imageUrl!]:[],category:['Breads','Pastries','Sandwiches'][i%3],featured:i<4,priceCents:10000+i*1000,compareAtCents:i<3?15000+i*1000:null,publishedAt:new Date(Date.now()-i*86400000),inventory:{create:{tenantId:tenant.id,quantityOnHand:i===7?0:10}}}}));
    const variant=await prisma.productVariant.create({data:{tenantId:tenant.id,productId:products[0].id,label:'Large',priceCents:20000,compareAtCents:25000}});
    const service=new StorefrontService(prisma,new ConfigService({STOREFRONT_TENANT_SLUG:slug}) as never,{} as never,{} as never);
    const offer=await service.saveCoupon(tenant.id,undefined,{code:'TREAT10',title:'Your next favourite, for a little less.',description:'Enjoy 10% off when you spend ₹200 or more.',kind:'percent',value:10,minimumCents:20000,startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+604800000).toISOString()});
    await service.saveCoupon(tenant.id,undefined,{code:'EXPIRED',title:'Expired code',kind:'fixed',value:1000,startsAt:new Date(Date.now()-172800000).toISOString(),endsAt:new Date(Date.now()-86400000).toISOString()});
    const items=[{productId:products[0].id,variantId:variant.id,quantity:2}];
    const quote=await service.quote({items,couponCode:'treat10'});assert.equal(quote.discountCents,4000);assert.equal(quote.totalCents,41000);
    await assert.rejects(service.quote({items,couponCode:'EXPIRED'}));
    const buyer=await prisma.customer.create({data:{tenantId:tenant.id,name:'Test buyer',email:'buyer@example.invalid'}});
    const order=await prisma.order.create({data:{tenantId:tenant.id,customerId:buyer.id,status:'FULFILLED',subtotalCents:20000,totalCents:20000,items:{create:{productId:products[0].id,variantId:variant.id,quantity:1,unitPriceCents:20000,lineTotalCents:20000}},payment:{create:{tenantId:tenant.id,providerOrderId:randomUUID(),amountCents:20000,status:'PAID'}}}});
    const reviewData={productId:products[0].id,orderId:order.id,email:'buyer@example.invalid',displayName:'Test buyer',rating:5,body:'Test review: a freshly baked favourite. This review exists only in the isolated QA store.'};
    await assert.rejects(service.submitReview({...reviewData,email:'wrong@example.invalid'}));
    await service.submitReview(reviewData);
    let home=await service.home();assert.equal(home.reviews.length,0);assert.equal(home.offers.length,1);assert.equal(home.products.find((p)=>p.id===products[0].id)?.sold,1);
    const review=await prisma.review.findFirstOrThrow({where:{tenantId:tenant.id}});
    await service.moderateReview(tenant.id,review.id,{published:true});home=await service.home();assert.equal(home.reviews.length,1);
    const other=await prisma.tenant.findFirstOrThrow({where:{id:{not:tenant.id}}});
    assert.equal(await prisma.forTenant(other.id).coupon.findFirst({where:{id:offer.id}}),null);
    assert.equal(await prisma.forTenant(other.id).productVariant.findFirst({where:{id:variant.id}}),null);
    const token=new JwtService().sign({sub:user.id,tenantId:tenant.id,email:user.email},{secret:process.env.JWT_ACCESS_SECRET,expiresIn:'1h'});
    const response=await fetch('http://localhost:4000/storefront/admin/preview',{headers:{Authorization:`Bearer ${token}`}});
    assert.equal(response.status,200);assert.equal((await response.json() as {id:string}).id,tenant.id);
    assert.equal((await fetch('http://localhost:4000/storefront/admin/preview')).status,401);
    writeFileSync(sessionFile,JSON.stringify({tenantId:tenant.id,token,productId:products[0].id,variantId:variant.id,offerId:offer.id}),{mode:0o600});
    console.log('PASS: variant pricing, coupons, best sellers, review verification/moderation, tenant isolation, authenticated preview.');
    if(!process.argv.includes('--keep')) {await prisma.tenant.delete({where:{id:tenant.id}});unlinkSync(sessionFile);}
  }catch(error){await prisma.tenant.delete({where:{id:tenant.id}});throw error;}
}
main().catch((error)=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());

import { ServiceUnavailableException } from '@nestjs/common';
import { StorefrontService } from './storefront.service';
import { settingsSchema, quoteSchema, checkoutSchema, couponSchema, parse } from './storefront.schemas';
import { priceCart } from './pricing';
import type { Coupon } from '@prisma/client';

const product = { id:'p1', name:'Bread', priceCents:10000, currency:'INR', publishedAt:new Date(), archivedAt:null, gstRateBps:0, inventory:{quantityOnHand:5}, variants:[{id:'v1',label:'Large',priceCents:20000,archivedAt:null}] };
const request = parse(quoteSchema, {items:[{productId:'p1',variantId:'v1',quantity:2}],couponCode:'SAVE10'});
const settings = settingsSchema.parse({shippingCents:5000, freeShippingThresholdCents:40000});
const coupon:Coupon = {id:'c1',tenantId:'t1',code:'SAVE10',title:'Save',description:'',kind:'percent',value:10,minimumCents:10000,maximumDiscountCents:null,active:true,maxRedemptions:null,perCustomerLimit:null,startsAt:new Date('2026-01-01'),endsAt:new Date('2027-01-01'),createdAt:new Date()};
const now = new Date('2026-09-06');

describe('storefront quote and trust boundaries',()=>{
  it('prices the selected variant, applies the coupon, then calculates delivery',()=>{
    expect(priceCart([product],request,settings,coupon,now)).toMatchObject({subtotalCents:40000,discountCents:4000,shippingCents:5000,totalCents:41000,remainingForFreeShippingCents:4000});
  });
  it('caps fixed and percentage discounts at the cart subtotal and configured cap',()=>{
    expect(priceCart([product],request,settings,{...coupon,value:90,maximumDiscountCents:1000},now).discountCents).toBe(1000);
    expect(priceCart([product],request,settings,{...coupon,kind:'fixed',value:99999},now).discountCents).toBe(40000);
  });
  it('rejects expired, future, disabled, invalid and below-minimum codes',()=>{
    for(const c of [null,{...coupon,active:false},{...coupon,endsAt:now},{...coupon,startsAt:new Date('2027-01-01')},{...coupon,minimumCents:50000}]) expect(()=>priceCart([product],request,settings,c,now)).toThrow();
  });
  it('rejects drafts and missing variants instead of falling back to the base price',()=>{
    expect(()=>priceCart([{...product,publishedAt:null}],request,settings,coupon,now)).toThrow(/available/);
    expect(()=>priceCart([product],{...request,items:[{productId:'p1',quantity:1}]},settings,coupon,now)).toThrow(/option/);
  });
  it('counts stock across duplicate lines and different options',()=>{
    expect(()=>priceCart([product],{...request,items:[{productId:'p1',variantId:'v1',quantity:3},{productId:'p1',variantId:'v1',quantity:3}]},settings,coupon,now)).toThrow(/stock/);
  });
  it('offers free shipping only after the discounted subtotal meets the threshold',()=>{
    expect(priceCart([product],{...request,couponCode:undefined},settings,null,now).shippingCents).toBe(0);
    expect(()=>priceCart([product],{...request,fulfillment:'pickup'},settings,coupon,now)).toThrow(/Pickup/);
    expect(priceCart([product],{...request,fulfillment:'pickup'},{...settings,pickupEnabled:true},coupon,now).shippingCents).toBe(0);
  });
  it('validates variants, addresses, quantity, and coupon rules at the request boundary',()=>{
    expect(()=>parse(checkoutSchema,{...request,customerName:'Buyer',customerEmail:'buyer@example.com',address:{line:'123 Main',city:'City',state:'State',postalCode:'123456'}})).not.toThrow();
    expect(()=>parse(checkoutSchema,{...request,customerName:'Buyer',customerEmail:'buyer@example.com'})).toThrow(/address/);
    expect(()=>parse(quoteSchema,{items:[{productId:'p1',quantity:1.5}]})).toThrow();
    expect(()=>parse(couponSchema,{...coupon,value:101})).toThrow();
  });
  it('refuses unconfigured and suspended stores',async()=>{
    const unconfigured = new StorefrontService({} as never,{get:()=>undefined} as never,{} as never,{} as never);
    await expect(unconfigured.listProducts()).rejects.toBeInstanceOf(ServiceUnavailableException);
    const suspended = new StorefrontService({tenant:{findUnique:async()=>({id:'t1',status:'SUSPENDED'})}} as never,{get:()=> 'store'} as never,{} as never,{} as never);
    await expect(suspended.listProducts()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('serves the store named by the request over the env default, and never a non-ACTIVE one',async()=>{
    const looked: string[] = [];
    const prisma = { tenant:{findUnique:async({where}:{where:{slug:string}})=>(looked.push(where.slug),{id:where.slug,status:where.slug==='pending'?'PENDING_VERIFICATION':'ACTIVE',storefront:{}})}, forTenant:()=>({product:{findMany:async()=>[]},orderItem:{groupBy:async()=>[]}}) };
    const service = new StorefrontService(prisma as never,{get:()=> 'oven-grains'} as never,{} as never,{} as never);
    await service.listProducts(undefined,'acme');
    await service.listProducts();
    expect(looked).toEqual(['acme','oven-grains']);
    await expect(service.listProducts(undefined,'pending')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

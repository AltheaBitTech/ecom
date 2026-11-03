import { defaultStoreDesign, normalizeStoreDesign, parseStoreDesign, templateAccess } from './store-design';

describe('store design', () => {
  it('validates the greenbasket design, unique sections, legacy fallback, and access', () => {
    const design = defaultStoreDesign();
    expect(design.templateId).toBe('greenbasket');
    expect(parseStoreDesign(design)).toEqual(design);
    expect(() => parseStoreDesign({ ...design, sections: [design.sections[0], design.sections[0]] })).toThrow();
    expect(normalizeStoreDesign({ template: 'luxury' }).templateId).toBe('greenbasket');
    expect(templateAccess('greenbasket', {})).toBe(true);
  });
});

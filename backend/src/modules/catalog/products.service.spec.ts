import { AppException } from '../../common/errors/app-exception';

import { validateMerchandising, validatePublication } from './products.service';

describe('catalog publication rules', () => {
  it('requires a category and image before publishing', () => {
    expect(() => validatePublication('ACTIVE', null, ['https://cdn.example/item.jpg'])).toThrow(AppException);
    expect(() => validatePublication('ACTIVE', 'category-1', [])).toThrow(AppException);
    expect(() => validatePublication('ACTIVE', 'category-1', ['https://cdn.example/item.jpg'])).not.toThrow();
    expect(() => validatePublication('DRAFT', null, [])).not.toThrow();
  });

  it('accepts only a compare-at price above the selling price', () => {
    expect(() => validateMerchandising(1000, 1000)).toThrow(AppException);
    expect(() => validateMerchandising(1000, 999)).toThrow(AppException);
    expect(() => validateMerchandising(1000, 1500)).not.toThrow();
    expect(() => validateMerchandising(1000, null)).not.toThrow();
  });
});

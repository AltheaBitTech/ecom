import { ValidationPipe } from '@nestjs/common';
import { ListProductsDto } from './list-products.dto';

// The admin products page always sends includeArchived; the app-wide pipe rejects undeclared query keys.
describe('ListProductsDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const validate = (q: object) => pipe.transform(q, { type: 'query', metatype: ListProductsDto });

  it('accepts the exact query the admin products page sends', async () => {
    await expect(validate({ sortBy: 'createdAt', sortDir: 'desc', includeArchived: 'true' })).resolves.toBeDefined();
  });

  it('still rejects unknown query keys', async () => {
    await expect(validate({ bogus: '1' })).rejects.toThrow();
  });
});

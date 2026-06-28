import { AuthService } from '../services/auth.service.js';

describe('AuthService Smoke Test', () => {
  it('should instantiate AuthService', () => {
    const mockPrisma = {} as any;
    const mockRedis = {} as any;
    const service = new AuthService(mockPrisma, mockRedis);
    expect(service).toBeDefined();
  });
});

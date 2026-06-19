import { USER_ERROR_CODE } from '@/common/constants';
import type { UsersRepository } from './user.repository';
import { UserService } from './user.service';

describe('UserService', () => {
  it('uses USER_NOT_FOUND when the user does not exist', async () => {
    const service = new UserService({
      findById: jest.fn().mockResolvedValue(null),
    } as unknown as UsersRepository);

    await expect(service.findById('missing-user')).rejects.toMatchObject({
      response: {
        code: USER_ERROR_CODE.USER_NOT_FOUND,
      },
      status: 404,
    });
  });
});
